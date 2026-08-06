// 商机管理前端交互逻辑
// 数据访问：优先调后端 API，不可达时降级 localStorage

const STAGES = [
  { key: "lead", name: "线索", probability: 0.1, color: "#9e9e9e" },
  { key: "confirmed", name: "需求确认", probability: 0.3, color: "#2364aa" },
  { key: "proposal", name: "方案报价", probability: 0.5, color: "#bd7b16" },
  { key: "negotiation", name: "谈判", probability: 0.7, color: "#2e7d89" },
  { key: "won", name: "成交", probability: 1.0, color: "#1f8a70" },
  { key: "lost", name: "流失", probability: 0.0, color: "#b84a4a" },
];

// 看板展示前 5 列（不含 lost）
const BOARD_STAGES = STAGES.filter((s) => s.key !== "lost");

const STORAGE_KEY = "crm_opportunities_v1";

// ============ 数据访问层 ============
const api = {
  _online: true,

  async _fetch(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async getOpportunities(stage, keyword) {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (keyword) params.set("keyword", keyword);
    return this._fetch(`/api/opportunities?${params}`);
  },

  async getOpportunity(id) {
    return this._fetch(`/api/opportunities/${id}`);
  },

  async createOpp(data) {
    return this._fetch(`/api/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updateOpp(id, data) {
    return this._fetch(`/api/opportunities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async deleteOpp(id) {
    return this._fetch(`/api/opportunities/${id}`, { method: "DELETE" });
  },

  async transitionStage(id, toStage, operator) {
    return this._fetch(`/api/opportunities/${id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage, operator }),
    });
  },

  async getLogs(id) {
    return this._fetch(`/api/opportunities/${id}/logs`);
  },

  async getForecast() {
    return this._fetch(`/api/forecast`);
  },

  // localStorage 降级方案
  _localGet() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { opportunities: [], stageLogs: [] };
    } catch {
      return { opportunities: [], stageLogs: [] };
    }
  },

  _localSave(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  _localId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  },
};

// ============ 工具函数 ============
function formatMoney(n) {
  return "¥" + Number(n).toLocaleString("zh-CN");
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function stageName(key) {
  const s = STAGES.find((x) => x.key === key);
  return s ? s.name : key;
}

function stageBadge(key) {
  return `<span class="stage-badge badge-${key}">${stageName(key)}</span>`;
}

// ============ 状态 ============
let allOpportunities = [];

// ============ 渲染：销售预测概览 ============
async function renderForecast() {
  try {
    const f = await api.getForecast();
    document.getElementById("forecastTotal").textContent = formatMoney(f.totalForecast);
    document.getElementById("forecastTotalAmount").textContent = formatMoney(f.totalAmount);
    document.getElementById("forecastCount").textContent = f.totalCount;
    const winRate = f.totalAmount > 0 ? Math.round((f.totalForecast / f.totalAmount) * 100) : 0;
    document.getElementById("forecastWinRate").textContent = winRate + "%";
  } catch {
    // 降级：本地计算
    const data = api._localGet();
    const totalAmount = data.opportunities.reduce((s, o) => s + Number(o.amount), 0);
    let totalForecast = 0;
    BOARD_STAGES.forEach((st) => {
      const opps = data.opportunities.filter((o) => o.stage === st.key);
      totalForecast += opps.reduce((s, o) => s + Number(o.amount) * st.probability, 0);
    });
    document.getElementById("forecastTotal").textContent = formatMoney(Math.round(totalForecast));
    document.getElementById("forecastTotalAmount").textContent = formatMoney(totalAmount);
    document.getElementById("forecastCount").textContent = data.opportunities.length;
    const winRate = totalAmount > 0 ? Math.round((totalForecast / totalAmount) * 100) : 0;
    document.getElementById("forecastWinRate").textContent = winRate + "%";
  }
}

// ============ 渲染：看板视图 ============
function renderBoard() {
  const board = document.getElementById("kanbanBoard");
  board.innerHTML = "";

  BOARD_STAGES.forEach((stage) => {
    const opps = allOpportunities.filter((o) => o.stage === stage.key);
    const colAmount = opps.reduce((s, o) => s + Number(o.amount), 0);

    const col = document.createElement("div");
    col.className = `kanban-column stage-${stage.key}`;
    col.dataset.stage = stage.key;

    col.innerHTML = `
      <div class="kanban-col-head">
        <h3><span class="stage-dot" style="background:${stage.color}"></span>${stage.name}</h3>
        <span class="kanban-col-count">${opps.length}</span>
      </div>
      <div class="kanban-col-amount">${formatMoney(colAmount)}</div>
      <div class="kanban-col-body" data-stage-body="${stage.key}"></div>
    `;

    const body = col.querySelector(".kanban-col-body");
    opps.forEach((opp) => {
      body.appendChild(createCard(opp));
    });

    // 拖拽目标事件
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const oppId = e.dataTransfer.getData("text/plain");
      const targetStage = col.dataset.stage;
      handleDrop(oppId, targetStage);
    });

    board.appendChild(col);
  });
}

function createCard(opp) {
  const card = document.createElement("div");
  card.className = "opp-card";
  card.draggable = true;
  card.dataset.oppId = opp.id;
  card.innerHTML = `
    <h4>${escapeHtml(opp.name)}</h4>
    <div class="card-customer">${escapeHtml(opp.customer)}</div>
    <div class="card-amount">${formatMoney(opp.amount)}</div>
    <div class="card-meta">
      <span>${escapeHtml(opp.owner || "未分配")}</span>
      <span>${formatDate(opp.expectedCloseDate)}</span>
    </div>
  `;
  // 点击打开详情
  card.addEventListener("click", (e) => {
    if (!card.classList.contains("dragging")) openDetail(opp.id);
  });
  // 拖拽事件
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", opp.id);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

// ============ 拖拽流转处理 ============
async function handleDrop(oppId, toStage) {
  const opp = allOpportunities.find((o) => o.id === oppId);
  if (!opp) return;
  if (opp.stage === toStage) return;

  const operator = prompt(`将「${opp.name}」从「${stageName(opp.stage)}」流转到「${stageName(toStage)}」\n请输入操作人姓名：`, opp.owner || "");
  if (operator === null) return; // 用户取消

  try {
    await api.transitionStage(oppId, toStage, operator || "system");
    opp.stage = toStage;
    opp.updatedAt = new Date().toISOString();
    renderBoard();
    renderForecast();
  } catch {
    // 降级 localStorage
    const data = api._localGet();
    const localOpp = data.opportunities.find((o) => o.id === oppId);
    if (localOpp) {
      data.stageLogs.push({
        id: api._localId("log"),
        opportunityId: oppId,
        fromStage: localOpp.stage,
        toStage,
        operator: operator || "system",
        timestamp: new Date().toISOString(),
      });
      localOpp.stage = toStage;
      localOpp.updatedAt = new Date().toISOString();
      api._localSave(data);
    }
    opp.stage = toStage;
    renderBoard();
    renderForecast();
  }
}

// ============ 渲染：列表视图 ============
function renderList() {
  const tbody = document.getElementById("oppTbody");
  const stageFilter = document.getElementById("listStageFilter").value;
  const keyword = document.getElementById("listSearch").value.trim().toLowerCase();

  let list = allOpportunities;
  if (stageFilter) list = list.filter((o) => o.stage === stageFilter);
  if (keyword) {
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(keyword) ||
        o.customer.toLowerCase().includes(keyword) ||
        (o.owner && o.owner.toLowerCase().includes(keyword))
    );
  }

  tbody.innerHTML = "";
  document.getElementById("oppEmpty").style.display = list.length === 0 ? "block" : "none";

  list.forEach((opp) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(opp.name)}</strong></td>
      <td>${escapeHtml(opp.customer)}</td>
      <td>${formatMoney(opp.amount)}</td>
      <td>${stageBadge(opp.stage)}</td>
      <td>${escapeHtml(opp.owner || "-")}</td>
      <td>${formatDate(opp.expectedCloseDate)}</td>
      <td class="col-actions">
        <button class="btn small secondary" data-edit="${opp.id}">编辑</button>
        <button class="btn small danger" data-del="${opp.id}">删除</button>
      </td>
    `;
    // 点击行打开详情（排除按钮区域）
    tr.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      openDetail(opp.id);
    });
    // 编辑按钮
    tr.querySelector('[data-edit]').addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(opp.id);
    });
    // 删除按钮
    tr.querySelector('[data-del]').addEventListener("click", (e) => {
      e.stopPropagation();
      handleDelete(opp.id);
    });
    tbody.appendChild(tr);
  });
}

// ============ 详情弹窗 ============
async function openDetail(oppId) {
  const opp = allOpportunities.find((o) => o.id === oppId);
  if (!opp) return;

  document.getElementById("detailTitle").textContent = opp.name;
  const body = document.getElementById("detailBody");

  let logs = [];
  try {
    logs = await api.getLogs(oppId);
  } catch {
    const data = api._localGet();
    logs = data.stageLogs
      .filter((l) => l.opportunityId === oppId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  let timelineHtml;
  if (logs.length === 0) {
    timelineHtml = '<div class="timeline-empty">暂无阶段变更记录</div>';
  } else {
    timelineHtml = logs
      .map(
        (log) => `
      <div class="timeline-item">
        <div class="timeline-stage">${stageName(log.fromStage)} → ${stageName(log.toStage)}</div>
        <div class="timeline-meta">${escapeHtml(log.operator)} · ${formatDateTime(log.timestamp)}</div>
      </div>
    `
      )
      .join("");
  }

  body.innerHTML = `
    <div class="detail-section">
      <h4>基本信息</h4>
      <div class="detail-grid">
        <div class="detail-item"><label>商机名称</label><strong>${escapeHtml(opp.name)}</strong></div>
        <div class="detail-item"><label>关联客户</label><strong>${escapeHtml(opp.customer)}</strong></div>
        <div class="detail-item"><label>商机金额</label><strong>${formatMoney(opp.amount)}</strong></div>
        <div class="detail-item"><label>当前阶段</label>${stageBadge(opp.stage)}</div>
        <div class="detail-item"><label>负责人</label><strong>${escapeHtml(opp.owner || "未分配")}</strong></div>
        <div class="detail-item"><label>预计成交</label><strong>${formatDate(opp.expectedCloseDate)}</strong></div>
        <div class="detail-item"><label>创建时间</label><strong>${formatDateTime(opp.createdAt)}</strong></div>
        <div class="detail-item"><label>更新时间</label><strong>${formatDateTime(opp.updatedAt)}</strong></div>
      </div>
    </div>
    <div class="detail-section">
      <h4>阶段变更历史</h4>
      <div class="timeline">${timelineHtml}</div>
    </div>
  `;

  showModal("detailModal");
}

// ============ 新增/编辑弹窗 ============
function openAddModal() {
  document.getElementById("oppModalTitle").textContent = "新增商机";
  document.getElementById("oppForm").reset();
  document.getElementById("oppId").value = "";
  fillStageSelect("oppStage", "lead");
  showModal("oppModal");
}

async function openEditModal(oppId) {
  const opp = allOpportunities.find((o) => o.id === oppId);
  if (!opp) return;

  document.getElementById("oppModalTitle").textContent = "编辑商机";
  document.getElementById("oppId").value = opp.id;
  document.getElementById("oppName").value = opp.name;
  document.getElementById("oppCustomer").value = opp.customer;
  document.getElementById("oppAmount").value = opp.amount;
  document.getElementById("oppOwner").value = opp.owner || "";
  document.getElementById("oppCloseDate").value = opp.expectedCloseDate || "";
  fillStageSelect("oppStage", opp.stage);
  showModal("oppModal");
}

function fillStageSelect(selectId, currentValue) {
  const select = document.getElementById(selectId);
  select.innerHTML = STAGES.map(
    (s) => `<option value="${s.key}" ${s.key === currentValue ? "selected" : ""}>${s.name}（${Math.round(s.probability * 100)}%）</option>`
  ).join("");
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("oppId").value;
  const data = {
    name: document.getElementById("oppName").value.trim(),
    customer: document.getElementById("oppCustomer").value.trim(),
    amount: Number(document.getElementById("oppAmount").value),
    stage: document.getElementById("oppStage").value,
    owner: document.getElementById("oppOwner").value.trim(),
    expectedCloseDate: document.getElementById("oppCloseDate").value,
  };

  if (!data.name || !data.customer || !data.amount) {
    document.getElementById("oppFormError").textContent = "请填写商机名称、客户和金额";
    return;
  }

  try {
    if (id) {
      await api.updateOpp(id, data);
    } else {
      await api.createOpp(data);
    }
    hideModal("oppModal");
    await loadData();
  } catch (err) {
    // 降级 localStorage
    const local = api._localGet();
    if (id) {
      const opp = local.opportunities.find((o) => o.id === id);
      if (opp) Object.assign(opp, data, { updatedAt: new Date().toISOString() });
    } else {
      const now = new Date().toISOString();
      local.opportunities.push({
        id: api._localId("opp"),
        ...data,
        createdAt: now,
        updatedAt: now,
      });
    }
    api._localSave(local);
    hideModal("oppModal");
    await loadData();
  }
}

async function handleDelete(oppId) {
  if (!confirm("确认删除该商机？删除后不可恢复。")) return;
  try {
    await api.deleteOpp(oppId);
  } catch {
    const local = api._localGet();
    local.opportunities = local.opportunities.filter((o) => o.id !== oppId);
    local.stageLogs = local.stageLogs.filter((l) => l.opportunityId !== oppId);
    api._localSave(local);
  }
  await loadData();
}

// ============ Modal 工具 ============
function showModal(id) {
  document.getElementById(id).classList.add("open");
  document.getElementById(id).setAttribute("aria-hidden", "false");
}

function hideModal(id) {
  document.getElementById(id).classList.remove("open");
  document.getElementById(id).setAttribute("aria-hidden", "true");
}

// ============ 数据加载 ============
async function loadData() {
  try {
    allOpportunities = await api.getOpportunities();
    api._online = true;
  } catch {
    // 降级：从 localStorage 读取
    api._online = false;
    const data = api._localGet();
    allOpportunities = data.opportunities;
  }
  renderBoard();
  renderList();
  renderForecast();
}

// ============ HTML 转义 ============
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============ 初始化 ============
function init() {
  // 填充列表筛选下拉
  const filter = document.getElementById("listStageFilter");
  STAGES.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = s.name;
    filter.appendChild(opt);
  });

  // Tab 切换
  document.querySelectorAll(".tab-item").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-item").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.remove("hidden");
    });
  });

  // 新增按钮
  document.getElementById("addOppBtn").addEventListener("click", openAddModal);

  // 表单提交
  document.getElementById("oppForm").addEventListener("submit", handleFormSubmit);

  // 筛选/搜索
  document.getElementById("listStageFilter").addEventListener("change", renderList);
  document.getElementById("listSearch").addEventListener("input", renderList);

  // Modal 关闭
  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => {
      el.closest(".modal").classList.remove("open");
    });
  });

  // 重置演示数据
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("确认重置为演示数据？当前数据将被覆盖。")) return;
    try {
      // 通过删除所有再重建的方式不可取，直接刷新页面让后端初始数据生效
      const res = await fetch("/api/opportunities");
      if (res.ok) {
        alert("后端数据为文件持久化，如需重置请联系管理员重置 data.json。");
      }
    } catch {
      alert("后端不可达，本地数据通过清除浏览器存储重置。");
      localStorage.removeItem(STORAGE_KEY);
    }
    location.reload();
  });

  // ESC 关闭弹窗
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
    }
  });

  loadData();
}

document.addEventListener("DOMContentLoaded", init);
