// Express 应用：静态托管前端 + 提供商机管理 API
const express = require("express");
const path = require("path");
const {
  STAGES,
  STAGE_KEYS,
  getStageProbability,
  isValidStage,
  readData,
  writeData,
  generateId,
} = require("./store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

// ============ 健康检查 ============
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============ 商机 CRUD ============

// 商机列表（支持 ?stage= 和 ?keyword= 筛选）
app.get("/api/opportunities", (req, res) => {
  const { stage, keyword } = req.query;
  let list = readData().opportunities;

  if (stage && isValidStage(stage)) {
    list = list.filter((o) => o.stage === stage);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(kw) ||
        o.customer.toLowerCase().includes(kw) ||
        (o.owner && o.owner.toLowerCase().includes(kw))
    );
  }
  res.json(list);
});

// 商机详情
app.get("/api/opportunities/:id", (req, res) => {
  const data = readData();
  const opp = data.opportunities.find((o) => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: "商机不存在" });
  res.json(opp);
});

// 新建商机
app.post("/api/opportunities", (req, res) => {
  const { name, customer, amount, stage, owner, expectedCloseDate } = req.body;
  if (!name || !customer || amount == null) {
    return res.status(400).json({ error: "缺少必填字段：name, customer, amount" });
  }
  const targetStage = stage || "lead";
  if (!isValidStage(targetStage)) {
    return res.status(400).json({ error: "非法阶段" });
  }

  const now = new Date().toISOString();
  const opp = {
    id: generateId("opp"),
    name,
    customer,
    amount: Number(amount),
    stage: targetStage,
    owner: owner || "",
    expectedCloseDate: expectedCloseDate || "",
    createdAt: now,
    updatedAt: now,
  };

  const data = readData();
  data.opportunities.push(opp);
  // 新建时记录初始日志
  if (targetStage !== "lead") {
    data.stageLogs.push({
      id: generateId("log"),
      opportunityId: opp.id,
      fromStage: "lead",
      toStage: targetStage,
      operator: owner || "system",
      timestamp: now,
    });
  }
  writeData(data);
  res.status(201).json(opp);
});

// 更新商机（非阶段字段）
app.put("/api/opportunities/:id", (req, res) => {
  const data = readData();
  const opp = data.opportunities.find((o) => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: "商机不存在" });

  const { name, customer, amount, owner, expectedCloseDate } = req.body;
  if (name !== undefined) opp.name = name;
  if (customer !== undefined) opp.customer = customer;
  if (amount !== undefined) opp.amount = Number(amount);
  if (owner !== undefined) opp.owner = owner;
  if (expectedCloseDate !== undefined) opp.expectedCloseDate = expectedCloseDate;
  opp.updatedAt = new Date().toISOString();

  writeData(data);
  res.json(opp);
});

// 删除商机（同时清理关联日志）
app.delete("/api/opportunities/:id", (req, res) => {
  const data = readData();
  const idx = data.opportunities.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "商机不存在" });

  data.opportunities.splice(idx, 1);
  data.stageLogs = data.stageLogs.filter((l) => l.opportunityId !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// ============ 阶段流转 ============
app.patch("/api/opportunities/:id/stage", (req, res) => {
  const { toStage, operator } = req.body;
  if (!isValidStage(toStage)) {
    return res.status(400).json({ error: "非法目标阶段" });
  }

  const data = readData();
  const opp = data.opportunities.find((o) => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: "商机不存在" });

  const fromStage = opp.stage;
  if (fromStage === toStage) {
    return res.json({ opportunity: opp, log: null, message: "阶段未变化" });
  }

  const now = new Date().toISOString();
  opp.stage = toStage;
  opp.updatedAt = now;

  const log = {
    id: generateId("log"),
    opportunityId: opp.id,
    fromStage,
    toStage,
    operator: operator || "system",
    timestamp: now,
  };
  data.stageLogs.push(log);
  writeData(data);

  res.json({ opportunity: opp, log });
});

// ============ 阶段变更日志 ============
app.get("/api/opportunities/:id/logs", (req, res) => {
  const data = readData();
  const logs = data.stageLogs
    .filter((l) => l.opportunityId === req.params.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

// ============ 销售预测 ============
app.get("/api/forecast", (req, res) => {
  const data = readData();
  const opps = data.opportunities;

  const byStage = STAGES.filter((s) => s.key !== "lost").map((s) => {
    const stageOpps = opps.filter((o) => o.stage === s.key);
    const amount = stageOpps.reduce((sum, o) => sum + Number(o.amount), 0);
    const forecast = Math.round(amount * s.probability);
    return { stage: s.key, stageName: s.name, count: stageOpps.length, amount, forecast };
  });

  const totalAmount = opps.reduce((sum, o) => sum + Number(o.amount), 0);
  const totalForecast = byStage.reduce((sum, b) => sum + b.forecast, 0);

  res.json({
    totalForecast,
    byStage,
    totalAmount,
    totalCount: opps.length,
  });
});

// ============ 阶段元信息 ============
app.get("/api/stages", (req, res) => {
  res.json(STAGES);
});

// 启动服务（直接运行时）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CRM] 商机管理服务已启动: http://localhost:${PORT}`);
    console.log(`[CRM] 商机管理页面: http://localhost:${PORT}/opportunities.html`);
  });
}

module.exports = app;
