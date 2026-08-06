// 数据持久化层：JSON 文件读写，演示级实现
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

// 阶段定义（概率用于销售预测加权计算）
const STAGES = [
  { key: "lead", name: "线索", probability: 0.1 },
  { key: "confirmed", name: "需求确认", probability: 0.3 },
  { key: "proposal", name: "方案报价", probability: 0.5 },
  { key: "negotiation", name: "谈判", probability: 0.7 },
  { key: "won", name: "成交", probability: 1.0 },
  { key: "lost", name: "流失", probability: 0.0 },
];

const STAGE_KEYS = STAGES.map((s) => s.key);

function getStageProbability(stageKey) {
  const stage = STAGES.find((s) => s.key === stageKey);
  return stage ? stage.probability : 0;
}

function isValidStage(stageKey) {
  return STAGE_KEYS.includes(stageKey);
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    // 文件不存在或解析失败时返回空结构
    return { opportunities: [], stageLogs: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  STAGES,
  STAGE_KEYS,
  getStageProbability,
  isValidStage,
  readData,
  writeData,
  generateId,
};
