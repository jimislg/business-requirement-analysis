const form = document.querySelector("#analysisForm");
const preview = document.querySelector("#reportPreview");
const signalList = document.querySelector("#signalList");
const loadSample = document.querySelector("#loadSample");
const copyHtml = document.querySelector("#copyHtml");
const downloadHtml = document.querySelector("#downloadHtml");
const materials = document.querySelector("#materials");
const materialFolder = document.querySelector("#materialFolder");
const uploadSummary = document.querySelector("#uploadSummary");
const generateButton = document.querySelector(".primary-action");

let latestReportHtml = "";
let latestReportData = null;
let latestAnalysis = null;
let uploadedTexts = [];
let uploadedNames = [];
let uploadedFiles = [];
let materialRecords = [];
let isReadingMaterials = false;
let uploadStats = {
  total: 0,
  parsed: 0,
  folders: 0,
  types: {},
};

const textFilePattern = /\.(txt|md|csv|tsv|json|xml|html|htm|log|sql|yaml|yml)$/i;
const excelFilePattern = /\.(xlsx|xls|xlsm|xlsb|ods)$/i;
const wordFilePattern = /\.docx$/i;
const pdfFilePattern = /\.pdf$/i;
const pptFilePattern = /\.pptx$/i;
const audioFilePattern = /\.(mp3|wav|m4a|aac)$/i;
const imageFilePattern = /\.(png|jpg|jpeg)$/i;
const maxTextLengthPerFile = 60000;

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.PDFJS_WORKER_SRC || "./vendor/pdf.worker.min.js";
}

document.documentElement.dataset.xlsxReady = window.XLSX ? "true" : "false";
document.documentElement.dataset.docxReady = window.mammoth ? "true" : "false";
document.documentElement.dataset.pptxReady = window.JSZip ? "true" : "false";
document.documentElement.dataset.pdfReady = window.pdfjsLib ? "true" : "false";

const industryModules = {
  制造业: ["APQP项目管理中心", "研发变更协同中心", "质量问题闭环中心", "供应商协同门户", "产销计划协同看板"],
  零售与消费: ["商品与订单中心", "客户经营门户", "门店运营看板", "供应链协同", "营销活动管理"],
  金融服务: ["客户尽调中心", "风险审批中心", "合同档案中心", "合规留痕中心", "经营报表中心"],
  医疗健康: ["患者服务中心", "耗材管理中心", "排班协同中心", "质控管理中心", "数据合规中心"],
  教育培训: ["线索招生中心", "课程排课中心", "学员服务中心", "教师协同中心", "教务报表中心"],
  政企服务: ["事项受理中心", "公文流转中心", "项目监督中心", "档案归集中心", "绩效评价中心"],
  通用企业: ["流程审批中心", "客户管理中心", "项目管理中心", "数据报表中心", "知识文档中心"],
};

const departmentRules = [
  { name: "信息科", keys: ["信息科", "信息部", "IT", "低代码", "权限", "钉钉", "飞书", "系统培训"] },
  { name: "总经办", keys: ["总经办", "董事长", "总经理", "追责", "时效性", "绩效"] },
  { name: "项目部", keys: ["项目部", "项目经理", "项目团队", "项目归档", "立项", "结项", "终止"] },
  { name: "研发中心", keys: ["研发中心", "研发", "设计变更", "产品设计", "作业文件", "DFMEA"] },
  { name: "实验中心", keys: ["实验中心", "实验", "样品", "试验", "测试报告", "LIMS"] },
  { name: "工程/模具", keys: ["工程部", "模具", "工模", "中模云", "开模", "图纸", "维修"] },
  { name: "质量部", keys: ["质量部", "质量", "客诉", "IQC", "PQC", "售后", "质量异常", "PFMEA"] },
  { name: "采购部", keys: ["采购", "供应商", "准入", "准出", "绩效", "催单", "到货"] },
  { name: "计划/生产", keys: ["计划部", "生产部", "排产", "MRP", "BOM", "车间", "库存", "交付"] },
  { name: "营销中心", keys: ["营销", "销售", "客户", "CRM", "拜访", "订单", "交期", "蔚来", "小鹏", "理想"] },
  { name: "财务部", keys: ["财务", "报销", "费用", "发票", "预算", "成本", "对账"] },
  { name: "人力资源部", keys: ["人力", "招聘", "入职", "培训", "组织架构", "工资", "食堂"] },
];

const painRules = [
  {
    id: "paper",
    label: "流程纸质化与伪合规",
    keys: ["纸质", "签字", "线下", "补签", "倒签", "找人", "出差", "僵尸单据"],
    insight: "核心流程仍依赖纸质表单和人工签字，流程真实性、时效性和追责能力不足。",
  },
  {
    id: "data",
    label: "数据孤岛与重复搬运",
    keys: ["数据孤岛", "ERP", "PLM", "MES", "PM", "中模云", "Excel", "导出", "报表", "不互通", "系统断层"],
    insight: "多个系统与表格并存但未形成统一数据链，业务人员被导数、清洗、汇总报表占用。",
  },
  {
    id: "warning",
    label: "过程预警缺失",
    keys: ["预警", "提醒", "催办", "超时", "3天", "倒计时", "逾期", "人盯人", "风险"],
    insight: "质量响应、审批、试验、维修、供应商交付等过程缺少自动提醒和升级机制。",
  },
  {
    id: "knowledge",
    label: "知识资产分散",
    keys: ["知识", "经验", "图纸", "版本", "离职", "交接", "微信", "个人电脑", "客户档案", "会议纪要"],
    insight: "客户、项目、图纸、经验和会议记录沉淀在个人或文件夹中，难以复用和传承。",
  },
  {
    id: "project",
    label: "APQP项目过程脱节",
    keys: ["APQP", "PPAP", "DFMEA", "PFMEA", "控制计划", "质量阀", "项目立项", "项目结项", "项目终止", "试生产"],
    insight: "项目制度和表单体系完整，但执行资料、审批、任务和交付物没有形成线上项目档案。",
  },
  {
    id: "customer",
    label: "客户响应与产销协同不足",
    keys: ["CRM", "客户", "销售", "交期", "订单", "生产计划", "排产", "主机厂", "蔚来", "小鹏", "理想"],
    insight: "销售、计划、生产、交付状态链路不透明，客户问询时难以快速给出可靠反馈。",
  },
  {
    id: "supplier",
    label: "供应商协同薄弱",
    keys: ["供应商", "准入", "准出", "评价", "绩效", "采购订单", "催单", "到货", "资质"],
    insight: "供应商信息收集、准入评价、绩效统计和订单跟踪仍有较多人工表格和线下催办。",
  },
  {
    id: "experiment",
    label: "实验进度黑盒",
    keys: ["实验中心", "LIMS", "样品", "试验", "测试报告", "委托单", "外部实验", "设备使用"],
    insight: "实验委托、样品流转、设备占用和报告生成缺少统一系统，研发侧无法实时掌握进度。",
  },
];

const scenarioRules = [
  {
    id: "apqp",
    title: "APQP项目管理中心",
    keys: ["APQP", "PPAP", "项目立项", "项目经理", "质量阀", "项目结项", "项目终止", "分层进度计划"],
    desc: "围绕项目立项、阶段计划、质量阀、交付物、问题清单、结项/终止建立统一线上项目档案。",
  },
  {
    id: "change",
    title: "研发设计变更审批",
    keys: ["设计变更", "变更", "研发中心", "质量", "采购", "计划", "签字确认"],
    desc: "将跨研发、质量、采购、计划、财务的变更评审改为标准化线上流程，支持并行审批、超时催办和资料自动归档。",
  },
  {
    id: "lims",
    title: "实验委托与LIMS轻量化",
    keys: ["实验中心", "LIMS", "样品", "试验", "测试报告", "设备"],
    desc: "覆盖实验委托、样品编号、任务分配、测试节点、外部实验跟踪、报告模板和设备使用统计。",
  },
  {
    id: "quality",
    title: "质量问题闭环中心",
    keys: ["质量部", "客诉", "IQC", "PQC", "售后", "质量异常", "3天", "PFMEA"],
    desc: "统一管理来料、过程、客诉和售后问题，自动倒计时、催办、升级，并形成责任部门和问题分类分析。",
  },
  {
    id: "supplier",
    title: "供应商协同门户",
    keys: ["供应商", "采购", "准入", "评价", "绩效", "资质", "采购订单"],
    desc: "实现供应商资料在线填报、资质识别、准入评审、绩效评价、订单确认和到货跟踪。",
  },
  {
    id: "otd",
    title: "产销计划协同看板",
    keys: ["营销", "销售", "订单", "交期", "计划", "生产", "排产", "MRP", "BOM"],
    desc: "打通客户订单、BOM拆解、排产计划、采购件到货和生产进度，使销售可实时响应客户交期问询。",
  },
  {
    id: "crm",
    title: "客户与商机管理门户",
    keys: ["CRM", "客户", "拜访", "会议纪要", "销售", "联系人", "微信"],
    desc: "沉淀客户档案、联系人、拜访记录、会议纪要、客户特殊要求和商机进展，降低人员离职带来的客户资产流失。",
  },
  {
    id: "knowledge",
    title: "知识与图纸版本库",
    keys: ["知识", "经验", "图纸", "版本", "模具", "离职", "交接", "吉利"],
    desc: "沉淀项目经验、历史坑点、图纸版本、问题复盘和交接资料，形成可搜索的组织知识资产。",
  },
  {
    id: "governance",
    title: "低代码治理与权限中心",
    keys: ["低代码", "多维表格", "权限", "应用发布", "培训", "信息科"],
    desc: "建立应用搭建规范、发布审核、数据权限、角色权限和业务部门培训机制，避免新平台失控扩散。",
  },
];

materials.addEventListener("change", readSelectedMaterials);
materialFolder.addEventListener("change", readSelectedMaterials);

loadSample.addEventListener("click", () => {
  document.querySelector("#customerName").value = "大明电子";
  document.querySelector("#industry").value = "制造业";
  uploadedTexts = [
    [
      "【示例材料】",
      "公司有完整的项目管理及产品先期策划程序，覆盖APQP、PPAP、DFMEA、PFMEA、控制计划、试生产、项目结项等表单，但立项、变更、物料申请、结项等流程仍大量依赖线下签字。",
      "调研涉及信息科、总经办、项目部、研发中心、实验中心、工程/模具、质量、采购、计划、生产、营销、财务、人力等部门。",
      "ERP、PLM、PM、中模云、Excel并存但数据不互通。计划排产、实验进度、质量客诉、供应商绩效、销售交期反馈等场景缺少端到端透明化和自动催办。",
    ].join("\n"),
  ];
  uploadedNames = ["示例-大明电子APQP调研材料.txt"];
  uploadedFiles = [{ name: uploadedNames[0], path: uploadedNames[0], size: uploadedTexts[0].length }];
  materialRecords = [{ path: uploadedNames[0], type: "txt", status: "已解析", chars: uploadedTexts[0].length, text: uploadedTexts[0] }];
  uploadStats = { total: 1, parsed: 1, folders: 0, types: { txt: 1 } };
  renderUploadSummary();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    if (isReadingMaterials) {
      syncUploadedTextsFromRecords();
      renderUploadSummary("材料仍在读取中，已先基于当前已完成内容生成报告...");
    }

    const data = collectFormData();
    const analysis = analyze(data);
    latestReportData = data;
    latestAnalysis = analysis;
    latestReportHtml = renderReport(data, analysis);
    preview.innerHTML = latestReportHtml;
    renderSignals(analysis);
    updateMetrics(analysis);
    document.querySelector("#reportTitle").textContent = `${data.customerName}业务需求分析报告`;
    preview.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    preview.innerHTML = `
      <div class="empty-state">
        <h3>生成报告时遇到问题</h3>
        <p>${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  }
});

copyHtml.addEventListener("click", async () => {
  if (!latestReportHtml) return;
  const copied = await copyText(await buildFullHtml(latestReportHtml));
  copyHtml.textContent = copied ? "已复制" : "复制失败";
  setTimeout(() => (copyHtml.textContent = "复制 HTML"), 1300);
});

downloadHtml.addEventListener("click", async () => {
  if (!latestReportHtml) return;
  const customer = sanitizeFileName((latestReportData && latestReportData.customerName) || document.querySelector("#customerName").value || "客户");
  const coreBusiness = sanitizeFileName(inferCoreBusinessName(latestReportData, latestAnalysis));
  const blob = new Blob([await buildFullHtml(latestReportHtml)], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${customer}${coreBusiness}业务分析报告.html`;
  link.click();
  URL.revokeObjectURL(link.href);
});

function collectFormData() {
  const customerName = document.querySelector("#customerName").value.trim() || inferCustomerName() || "未命名客户";
  const industry = document.querySelector("#industry").value;
  const combinedText = [...uploadedTexts, uploadedNames.join(" ")]
    .filter(Boolean)
    .join("\n");

  return { customerName, industry, combinedText };
}

function analyze(data) {
  const text = data.combinedText;
  const departments = scoreRules(text, departmentRules, 0);
  const pains = scoreRules(text, painRules, 1).map((item) => ({
    ...item,
    evidence: pickEvidence(text, item.keys, 2),
  }));
  const scenarios = scoreRules(text, scenarioRules, 0).slice(0, 9);
  const forms = extractForms();
  const systems = extractSystems(text);
  const apqpDetected = forms.length >= 12 || /APQP|PPAP|DFMEA|PFMEA|控制计划|质量阀/.test(text);
  const materialSummary = summarizeMaterials();
  const coverage = calculateCoverage(data, materialSummary);
  const risks = buildRisks(data, pains, systems, forms, apqpDetected);
  const framework = buildFramework(data.industry, scenarios, systems, apqpDetected);
  const functionRows = buildFunctionRows(scenarios, pains, apqpDetected);
  const roadmap = buildRoadmap(apqpDetected);
  const status = buildCurrentStatus(data, materialSummary, departments, systems, forms, apqpDetected);
  const challenges = buildChallenges(pains, departments, systems, forms, text);
  const solution = buildSolution(data, apqpDetected, scenarios, systems);
  const riskLevel = risks.length >= 6 || pains.length >= 6 ? "高" : risks.length >= 4 ? "中" : "低";

  return {
    departments,
    pains,
    scenarios,
    forms,
    systems,
    materialSummary,
    coverage,
    risks,
    riskLevel,
    framework,
    functionRows,
    roadmap,
    status,
    challenges,
    solution,
    keywords: [...new Set([...pains.map((item) => item.label), ...systems, ...departments.map((item) => item.name)])],
  };
}

function buildCurrentStatus(data, materialSummary, departments, systems, forms, apqpDetected) {
  const status = [];
  status.push(
    `本次分析基于 ${materialSummary.total} 个材料，其中 ${materialSummary.parsed} 个已读取正文、表格、页面或幻灯片内容，累计解析约 ${formatNumber(materialSummary.chars)} 字。`,
  );

  if (departments.length) {
    status.push(`材料覆盖 ${departments.slice(0, 10).map((item) => item.name).join("、")} 等部门或职能，具备跨部门流程诊断基础。`);
  }

  if (apqpDetected) {
    status.push(
      `客户存在较完整的项目管理/APQP制度与表单体系，已识别 ${forms.length} 类项目、质量、试制或签字表单，说明管理要求明确，但需要线上化承接。`,
    );
  }

  if (systems.length) {
    status.push(`现有系统或工具线索包括 ${systems.join("、")}，但材料显示这些系统与线下表单、Excel、即时沟通之间仍存在断层。`);
  }

  if (!materialSummary.parsed) {
    status.push("当前未解析到有效正文，建议补充可读取的 Word、PDF、PPT、Excel、CSV 或文本材料后再生成正式报告。");
  }

  return status;
}

function buildChallenges(pains, departments, systems, forms, text) {
  const items = pains.slice(0, 7).map((pain) => `${pain.label}：${pain.insight}`);

  if (forms.length >= 20) {
    items.push(`表单体系复杂：已识别 ${forms.length} 类表单/节点，若只是原样搬到线上，容易形成“电子化的纸质流程”。`);
  }

  if (systems.length >= 4) {
    items.push(`系统并存但口径不一：${systems.slice(0, 6).join("、")} 等工具需要明确主数据、接口边界和回写规则。`);
  }

  if (/主机厂|蔚来|小鹏|理想|客户/.test(text)) {
    items.push("外部客户数字化要求提升：主机厂客户对响应速度、交付透明度和过程留痕的要求正在倒逼内部协同升级。");
  }

  if (departments.length >= 8) {
    items.push("跨部门协同跨度大：项目、研发、质量、采购、计划、生产、营销、财务等部门共同参与，必须先定义责任边界和SLA。");
  }

  return [...new Set(items)].slice(0, 9);
}

function buildSolution(data, apqpDetected, scenarios, systems) {
  const solution = [];
  solution.push("先把上传材料中的制度、表单、访谈纪要和汇总报告统一抽取为业务对象、流程节点、审批角色、数据字段、系统来源和风险事件。");

  if (apqpDetected) {
    solution.push("以APQP项目全过程为主线，建立客户需求、项目、任务、表单、审批、交付物、问题、风险、成本和知识的统一模型。");
  } else {
    solution.push("以高频跨部门流程为主线，建立流程、任务、台账、审批、资料、指标和风险的一体化模型。");
  }

  if (scenarios.length) {
    solution.push(`优先上线 ${scenarios.slice(0, 4).map((item) => item.title).join("、")}，用真实痛点场景建立样板。`);
  }

  if (systems.length) {
    solution.push(`同步梳理 ${systems.slice(0, 5).join("、")} 的数据接口、字段口径和主数据归属，避免协同平台变成新的孤岛。`);
  }

  solution.push("采用“试点流程上线、核心场景铺开、系统集成深化、经营驾驶舱沉淀”的分阶段路线，边上线边校准组织规则。");
  return solution;
}

function buildFramework(industry, scenarios, systems, apqpDetected) {
  if (apqpDetected || industry === "制造业") {
    return [
      ["统一入口层", "PC工作台、移动端待办、消息提醒、项目空间、部门看板和外部协作入口。"],
      ["APQP项目层", "项目立项、团队任命、阶段计划、质量阀、交付物、问题清单、结项/终止。"],
      ["研发质量层", "设计变更、DFMEA/PFMEA、控制计划、试生产、客诉闭环、实验委托和质量分析。"],
      ["供应链协同层", "供应商准入、采购订单、长周期物料、到货跟踪、计划排产、生产交付。"],
      ["知识资产层", "客户档案、项目经验、图纸版本、会议纪要、问题复盘、离职交接。"],
      ["集成数据层", `${systems.length ? systems.join("、") : "ERP、PLM、MES、费控等系统"} 的数据同步、主数据映射、指标口径和管理驾驶舱。`],
    ];
  }

  const modules = scenarios.length ? scenarios.map((item) => item.title).slice(0, 6) : industryModules[industry] || industryModules["通用企业"];
  return [
    ["统一入口层", "PC工作台、移动端、消息待办、外部门户。"],
    ["流程协同层", "流程编排、审批规则、状态流转、任务提醒、操作留痕。"],
    ["业务能力层", modules.join("、") + "。"],
    ["数据分析层", "主数据、业务台账、指标口径、报表看板、预警模型。"],
    ["集成治理层", `${systems.length ? systems.join("、") : "ERP、OA、CRM、财务系统"} 对接、权限、审计和运维监控。`],
  ];
}

function buildRisks(data, pains, systems, forms, apqpDetected) {
  const risks = ["需求边界需要在蓝图阶段冻结核心流程、关键表单和首批试点场景，避免范围持续扩张影响交付节奏。"];

  if (forms.length >= 20) {
    risks.push("表单数量多且历史版本复杂，需要先做表单合并、字段标准化和流程重构，不能简单照搬Excel版式。");
  }

  if (apqpDetected) {
    risks.push("APQP/PPAP相关节点涉及研发、质量、采购、计划、生产、财务等多方，必须同步定义责任人、审批SLA和质量阀规则。");
  }

  if (systems.length >= 3) {
    risks.push("系统集成涉及接口权限、编码映射、字段口径和数据回写，需提前完成ERP/PLM/PM等系统摸底。");
  }

  if (pains.some((item) => item.id === "knowledge")) {
    risks.push("历史知识、客户资料、图纸版本和项目经验分散，迁移治理工作量可能高于流程上线本身。");
  }

  if (pains.some((item) => item.id === "paper")) {
    risks.push("纸质签字流程背后往往绑定审计和责任习惯，上线前需要客户确认电子签核、授权和归档规则。");
  }

  if (pains.some((item) => item.id === "warning")) {
    risks.push("预警机制必须绑定明确的升级路径和考核口径，否则只会变成更多消息提醒。");
  }

  if (uploadedFiles.some((file) => audioFilePattern.test(file.name))) {
    risks.push("录音材料应完成转写和客户确认，避免关键信息遗漏或误解。");
  }

  if (uploadStats.parsed / Math.max(uploadStats.total, 1) < 0.55) {
    risks.push("部分材料尚未解析正文，正式报告前建议补充可读取版本或转为Word/PDF/Excel文本。");
  }

  return [...new Set(risks)];
}

function buildFunctionRows(scenarios, pains, apqpDetected) {
  const painText = pains.map((item) => item.label).join("、");
  const fallback = apqpDetected ? scenarioRules.slice(0, 7) : scenarioRules.slice(1, 8);
  const selected = scenarios.length ? scenarios : fallback;

  return selected.slice(0, 10).map((item) => {
    const mapping = {
      apqp: ["APQP项目管理中心", "把项目立项、团队、阶段计划、质量阀、APQP交付物、问题清单和结项/终止统一到项目空间。", "项目过程透明化，减少资料散落和阶段遗漏，支撑项目复盘与审计。"],
      change: ["研发变更协同中心", "将设计变更涉及的研发、质量、采购、计划、财务评审线上化，支持并行审批、超时催办和附件留痕。", "缩短变更周期，避免领导出差或线下签字造成项目停滞。"],
      lims: ["实验委托与LIMS轻量化", "记录样品委托、样品编号、设备、测试节点、外部实验状态和报告模板。", "研发无需反复电话询问，实验进度和报告交付更透明。"],
      quality: ["质量问题闭环中心", "统一问题提报、责任分派、整改验证、3天回复倒计时和多维质量分析。", "从被动救火转向主动预警，降低客户罚款和质量复发风险。"],
      supplier: ["供应商协同门户", "支持供应商资料在线填报、资质附件、准入审批、绩效评价、订单确认和到货预警。", "减少纸质Excel和电话催单，提高供应商管理可追溯性。"],
      otd: ["产销计划协同看板", "整合客户订单、BOM拆解、排产、采购件、生产进度和预计交期。", "销售能实时响应客户问询，提高交付承诺准确性。"],
      crm: ["客户与商机管理门户", "沉淀客户联系人、拜访记录、会议纪要、客户特殊要求、商机进展和历史项目。", "避免客户资产私有化，降低人员离职导致的客户流失风险。"],
      knowledge: ["知识与图纸版本库", "沉淀项目经验、历史坑点、图纸版本、问题复盘和离职交接资料。", "把个人经验转为组织资产，减少重复犯错和图纸版本事故。"],
      governance: ["低代码治理与权限中心", "建立应用搭建规范、发布审核、角色权限、数据权限和业务部门培训体系。", "鼓励业务创新，同时避免新平台形成新的应用孤岛。"],
    };

    if (mapping[item.id]) {
      return mapping[item.id];
    }

    return [item.title, item.desc, painText ? `直接回应 ${painText} 等痛点，提升流程效率和数据透明度。` : "提升流程效率、数据透明度和管理可追溯性。"];
  });
}

function buildRoadmap(apqpDetected) {
  if (apqpDetected) {
    return [
      ["1-2个月", "试点验证", "研发设计变更、质量客诉处理、核心审批移动端优化", "完成2-3个标杆流程上线，验证复杂表单可读性和催办机制"],
      ["3-6个月", "场景铺开", "APQP项目空间、实验委托、供应商协同、产销计划看板", "80%高频纸质流程线上化，跨部门协同效率显著提升"],
      ["6个月+", "集成深化", "ERP/PLM/PM/中模云/费控数据集成、经营驾驶舱、知识库", "打通关键数据链路，形成管理驾驶舱和组织知识资产"],
    ];
  }

  return [
    ["1-2个月", "高频流程试点", "选择审批、台账、客户或项目类高频场景上线", "验证用户接受度和流程规则"],
    ["3-6个月", "核心场景推广", "扩展到跨部门流程、数据看板和知识沉淀", "形成主要业务闭环"],
    ["6个月+", "数据与治理", "系统集成、权限治理、经营分析和自动预警", "支撑精细化运营"],
  ];
}

function renderReport(data, analysis) {
  const date = new Date().toLocaleDateString("zh-CN");
  const materialNames = uploadedNames.slice(0, 14).map((name) => escapeHtml(name)).join("、");
  const extraMaterialCount = Math.max(uploadedNames.length - 14, 0);

  return `
    <article class="report-document">
      <header class="report-header">
        <div>
          <p class="report-kicker">Digital Business Blueprint</p>
          <h2>${escapeHtml(data.customerName)}业务需求分析报告</h2>
          <div class="report-meta">
            <span>行业：${escapeHtml(data.industry)}</span>
            <span>生成日期：${date}</span>
            <span>解析材料：${analysis.materialSummary.parsed}/${analysis.materialSummary.total}</span>
            <span>风险等级：<strong class="${riskClass(analysis.riskLevel)}">${analysis.riskLevel}</strong></span>
          </div>
        </div>
        ${renderCoverVisual(analysis)}
      </header>

      <section class="report-section visual-first">
        <h3>管理摘要</h3>
        ${renderExecutiveSummary(data, analysis)}
        <div class="visual-summary">
          <div class="visual-stat">
            <strong>${analysis.materialSummary.parsed}/${analysis.materialSummary.total}</strong>
            <span>材料解析</span>
          </div>
          <div class="visual-stat">
            <strong>${analysis.departments.length}</strong>
            <span>覆盖部门</span>
          </div>
          <div class="visual-stat">
            <strong>${analysis.pains.length}</strong>
            <span>关键痛点</span>
          </div>
          <div class="visual-stat">
            <strong>${analysis.functionRows.length}</strong>
            <span>建议模块</span>
          </div>
        </div>
        ${renderObjectMap(analysis)}
      </section>

      <section class="report-section">
        <h3>一、当前的业务现状</h3>
        ${renderCurrentLandscape(analysis)}
        <div class="status-board">
          ${analysis.status.map((item, index) => `<div><strong>${String(index + 1).padStart(2, "0")}</strong><span>${escapeHtml(item)}</span></div>`).join("")}
        </div>
        ${
          uploadedNames.length
            ? `<ul><li>材料清单：${materialNames}${extraMaterialCount ? ` 等 ${extraMaterialCount} 个` : ""}</li></ul>`
            : ""
        }
      </section>

      <section class="report-section">
        <h3>二、业务挑战</h3>
        ${renderDiagnosisMatrix(analysis)}
        ${renderPainMatrix(analysis)}
      </section>

      <section class="report-section">
        <h3>三、解决思路</h3>
        ${renderSolutionBlueprint(analysis)}
        ${renderProcessVisual(analysis)}
        <div class="solution-flow">
          ${analysis.solution
            .map(
              (item, index) => `
                <div class="solution-step">
                  <strong>${index + 1}</strong>
                  <span>${escapeHtml(item)}</span>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="roadmap">
          ${analysis.roadmap
            .map(
              ([period, title, task, outcome]) => `
                <div class="roadmap-item">
                  <strong>${escapeHtml(period)}</strong>
                  <b>${escapeHtml(title)}</b>
                  <span>${escapeHtml(task)}</span>
                  <em>${escapeHtml(outcome)}</em>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="report-section">
        <h3>四、业务系统框架</h3>
        ${renderCapabilityBlueprint(analysis)}
        ${renderArchitecture(analysis)}
      </section>

      <section class="report-section">
        <h3>五、系统功能说明</h3>
        ${renderFunctionTable(analysis.functionRows)}
      </section>

      <section class="report-section">
        <h3>六、系统落地风险</h3>
        ${renderImplementationPlan(analysis)}
        <ul>${analysis.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section class="report-section">
        <h3>七、证据摘要</h3>
        ${renderDashboardVisual(analysis)}
        <div class="evidence-grid">
          ${analysis.pains
            .slice(0, 6)
            .map(
              (pain) => `
                <div class="evidence-item">
                  <strong>${escapeHtml(pain.label)}</strong>
                  <span>${escapeHtml(pain.evidence.join(" / ") || pain.insight)}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    </article>
  `;
}

function renderExecutiveSummary(data, analysis) {
  const topPains = analysis.pains.slice(0, 3).map((item) => item.label);
  const topModules = analysis.functionRows.slice(0, 4).map((row) => row[0]);
  const conclusion = topPains.length
    ? `当前核心矛盾集中在${topPains.join("、")}，建议以${topModules.join("、")}作为首批数字化抓手。`
    : `当前材料尚不足以形成强诊断，建议先补齐流程制度、表单样例和访谈纪要，再进入蓝图设计。`;
  return `
    <div class="executive-summary">
      <div class="summary-lead">
        <span>Solution Point of View</span>
        <strong>${escapeHtml(conclusion)}</strong>
      </div>
      <div class="summary-cards">
        <div><b>业务主线</b><span>${analysis.scenarios.some((item) => item.id === "apqp") ? "APQP项目全过程" : "跨部门流程协同"}</span></div>
        <div><b>建设方式</b><span>场景试点 + 能力平台 + 数据集成</span></div>
        <div><b>交付目标</b><span>流程可追踪、数据可复用、经营可分析</span></div>
      </div>
    </div>
  `;
}

function renderCurrentLandscape(analysis) {
  const systems = analysis.systems.slice(0, 6);
  const departments = analysis.departments.slice(0, 8).map((item) => item.name);
  const forms = analysis.forms.slice(0, 6);
  return `
    <div class="landscape-map">
      <div class="landscape-column">
        <b>组织覆盖</b>
        <div>${(departments.length ? departments : ["业务部门", "管理层", "IT部门"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="landscape-column">
        <b>系统现状</b>
        <div>${(systems.length ? systems : ["ERP", "Excel", "流程审批"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="landscape-column">
        <b>材料资产</b>
        <div>${(forms.length ? forms : ["制度文件", "调研纪要", "业务表单"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}

function renderDiagnosisMatrix(analysis) {
  const dimensions = [
    ["流程在线化", analysis.pains.some((item) => item.id === "paper") ? 35 : 62],
    ["数据贯通", analysis.pains.some((item) => item.id === "data") ? 30 : 58],
    ["过程预警", analysis.pains.some((item) => item.id === "warning") ? 28 : 55],
    ["知识沉淀", analysis.pains.some((item) => item.id === "knowledge") ? 32 : 60],
    ["外部协同", analysis.pains.some((item) => item.id === "supplier" || item.id === "customer") ? 38 : 57],
  ];
  return `
    <div class="diagnosis-panel">
      <div class="diagnosis-title">
        <span>成熟度诊断</span>
        <strong>从“流程可执行”升级到“过程可经营”</strong>
      </div>
      <div class="maturity-bars">
        ${dimensions
          .map(
            ([name, value]) => `
              <div>
                <b>${escapeHtml(name)}</b>
                <span><i style="width:${value}%"></i></span>
                <em>${value < 40 ? "待提升" : "可优化"}</em>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderSolutionBlueprint(analysis) {
  const modules = analysis.functionRows.slice(0, 5).map((row) => row[0]);
  return `
    <div class="solution-blueprint">
      <div class="blueprint-step">
        <b>1. 业务对象建模</b>
        <span>客户、项目、任务、表单、问题、供应商、交付物统一编码。</span>
      </div>
      <div class="blueprint-arrow"></div>
      <div class="blueprint-step">
        <b>2. 场景流程上线</b>
        <span>${escapeHtml(modules.join("、") || "高频审批、台账、报表、协同流程")}。</span>
      </div>
      <div class="blueprint-arrow"></div>
      <div class="blueprint-step">
        <b>3. 数据闭环经营</b>
        <span>形成预警、SLA、质量阀、经营看板和知识复用机制。</span>
      </div>
    </div>
  `;
}

function renderCapabilityBlueprint(analysis) {
  const groups = [
    ["客户与项目域", ["客户档案", "商机/订单", "项目立项", "阶段计划"]],
    ["研发质量域", ["设计变更", "DFMEA/PFMEA", "实验委托", "质量闭环"]],
    ["供应链交付域", ["供应商准入", "采购协同", "排产跟踪", "交期看板"]],
    ["平台治理域", ["流程引擎", "权限审计", "数据集成", "知识库"]],
  ];
  const selected = new Set(analysis.functionRows.map((row) => row[0]));
  return `
    <div class="capability-blueprint">
      ${groups
        .map(
          ([group, items]) => `
            <div class="capability-domain">
              <strong>${escapeHtml(group)}</strong>
              ${items
                .map((item) => {
                  const active = [...selected].some((module) => module.includes(item.slice(0, 2)) || item.includes(module.slice(0, 2)));
                  return `<span class="${active ? "active" : ""}">${escapeHtml(item)}</span>`;
                })
                .join("")}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderImplementationPlan(analysis) {
  const riskCount = analysis.risks.length;
  return `
    <div class="implementation-board">
      <div>
        <b>蓝图确认</b>
        <span>冻结首批场景、角色、表单字段、审批规则和集成边界。</span>
      </div>
      <div>
        <b>试点上线</b>
        <span>选择2-3个高频场景快速上线，用真实业务验证可用性。</span>
      </div>
      <div>
        <b>规模推广</b>
        <span>扩展到项目、质量、供应链、客户协同等核心业务域。</span>
      </div>
      <div>
        <b>运营治理</b>
        <span>围绕${riskCount}类风险建立SLA、预警、权限和数据质量机制。</span>
      </div>
    </div>
  `;
}

function renderCoverVisual(analysis) {
  const bars = [analysis.pains.length, analysis.scenarios.length, analysis.systems.length, analysis.departments.length].map((value) =>
    Math.min(92, Math.max(26, value * 9)),
  );
  return `
    <div class="cover-panel" aria-hidden="true">
      <div class="cover-grid-icon">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="cover-bars">
        ${bars.map((height) => `<i style="height:${height}%"></i>`).join("")}
      </div>
      <div class="cover-chip-row">
        <span>流程</span><span>数据</span><span>协同</span>
      </div>
    </div>
  `;
}

function renderObjectMap(analysis) {
  const objects = [
    ["客户需求", "项目", "APQP表单"],
    ["审批", "任务", "交付物"],
    ["质量问题", "供应商", "知识资产"],
  ];
  return `
    <div class="object-map">
      <div class="object-core">
        <strong>统一业务模型</strong>
        <span>${escapeHtml(analysis.systems.slice(0, 5).join(" / ") || "流程 / 表单 / 数据 / 角色")}</span>
      </div>
      <div class="object-rings">
        ${objects
          .flat()
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderProcessVisual(analysis) {
  const stages = analysis.forms.length >= 12 || analysis.scenarios.some((item) => item.id === "apqp")
    ? ["需求/立项", "计划/团队", "设计/变更", "试制/验证", "量产/交付", "复盘/知识"]
    : ["识别", "建模", "试点", "推广", "集成", "经营"];
  const lanes = ["业务负责人", "执行部门", "系统平台"];
  return `
    <div class="process-window">
      <div class="window-top"><span></span><span></span><span></span><b>流程泳道示意</b></div>
      <div class="swimlane-visual">
        <div class="lane-head">角色\\阶段</div>
        ${stages.map((stage) => `<div class="lane-head">${escapeHtml(stage)}</div>`).join("")}
        ${lanes
          .map((lane, laneIndex) => {
            const cells = stages
              .map((stage, index) => {
                const visible = (index + laneIndex) % 2 === 0 || laneIndex === 2;
                return `<div class="lane-cell">${visible ? `<span class="lane-task tone-${(index % 4) + 1}">${escapeHtml(stage)}</span>` : ""}</div>`;
              })
              .join("");
            return `<div class="lane-head">${escapeHtml(lane)}</div>${cells}`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderArchitecture(analysis) {
  const layers = analysis.framework
    .map(
      ([title, desc], index) => `
        <div class="arch-layer arch-layer-${index + 1}">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(desc)}</span>
        </div>
      `,
    )
    .join("");
  const scenarioNodes = analysis.scenarios
    .slice(0, 6)
    .map((item) => `<span>${escapeHtml(item.title)}</span>`)
    .join("");

  return `
    <div class="architecture">
      <div class="arch-side">
        <strong>业务入口</strong>
        <span>PC</span>
        <span>移动端</span>
        <span>外部协作</span>
      </div>
      <div class="arch-main">
        ${layers}
        <div class="arch-scenarios">${scenarioNodes}</div>
      </div>
      <div class="arch-side">
        <strong>治理能力</strong>
        <span>权限</span>
        <span>审计</span>
        <span>预警</span>
      </div>
    </div>
  `;
}

function renderPainMatrix(analysis) {
  const rows = analysis.pains.slice(0, 8);
  if (!rows.length) {
    return `<ul>${analysis.challenges.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return `
    <div class="pain-matrix">
      ${rows
        .map(
          (pain) => `
            <div class="pain-card">
              <strong>${escapeHtml(pain.label)}</strong>
              <span>${escapeHtml(pain.insight)}</span>
              <em>证据强度 ${pain.score}</em>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderFunctionTable(rows) {
  return `
    <div class="function-table-wrap">
      <table class="function-table">
        <thead>
          <tr>
            <th>功能模块</th>
            <th>功能说明</th>
            <th>带来的价值</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([module, desc, value]) => `
                <tr>
                  <td>${escapeHtml(module)}</td>
                  <td>${escapeHtml(desc)}</td>
                  <td>${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboardVisual(analysis) {
  const painCount = Math.max(analysis.pains.length, 1);
  const systems = Math.max(analysis.systems.length, 1);
  const closed = Math.min(78, 38 + analysis.functionRows.length * 4);
  return `
    <div class="dashboard-visual">
      <div class="mini-chart">
        <strong>痛点分布</strong>
        <div class="bar-chart">
          <span style="height:${Math.min(92, painCount * 9)}%"></span>
          <span style="height:${Math.min(92, systems * 11)}%"></span>
          <span style="height:${closed}%"></span>
          <span style="height:${Math.min(92, analysis.departments.length * 7)}%"></span>
        </div>
      </div>
      <div class="mini-chart">
        <strong>闭环建议</strong>
        <div class="donut-visual" style="--value:${closed}"></div>
        <span>${closed}% 场景可优先线上化</span>
      </div>
      <div class="metric-stack">
        <div><span>系统线索</span><b>${analysis.systems.length}</b></div>
        <div><span>表单线索</span><b>${analysis.forms.length}</b></div>
        <div><span>证据片段</span><b>${analysis.pains.reduce((sum, item) => sum + item.evidence.length, 0)}</b></div>
      </div>
    </div>
  `;
}

function renderSignals(analysis) {
  if (!analysis.pains.length && !analysis.scenarios.length) {
    signalList.innerHTML = `<p class="muted">暂未识别到明显信号。建议补充客户流程样本、制度条款、访谈纪要或文件摘要。</p>`;
    return;
  }

  const painHtml = analysis.pains
    .slice(0, 7)
    .map(
      (signal) => `
        <div class="signal">
          <strong>${escapeHtml(signal.label)}</strong>
          <span>${escapeHtml(signal.insight)}</span>
        </div>
      `,
    )
    .join("");
  const scenarioHtml = analysis.scenarios
    .slice(0, 5)
    .map(
      (scenario) => `
        <div class="signal">
          <strong>${escapeHtml(scenario.title)}</strong>
          <span>${escapeHtml(scenario.desc)}</span>
        </div>
      `,
    )
    .join("");

  signalList.innerHTML = `${painHtml}${scenarioHtml}`;
}

function updateMetrics(analysis) {
  document.querySelector("#coverageScore").textContent = `${analysis.coverage}%`;
  document.querySelector("#riskScore").textContent = analysis.riskLevel;
  document.querySelector("#moduleCount").textContent = analysis.scenarios.length || analysis.framework.length;
  document.querySelector("#keywordCount").textContent = analysis.keywords.length;
}

function calculateCoverage(data, materialSummary) {
  const hasCustomer = data.customerName !== "未命名客户" ? 10 : 0;
  const parseScore = materialSummary.total ? Math.round((materialSummary.parsed / materialSummary.total) * 55) : 0;
  const fileScore = Math.min(materialSummary.total * 4, 20);
  const textScore = Math.min(Math.floor(data.combinedText.length / 500), 15);
  return Math.min(100, 15 + hasCustomer + parseScore + fileScore + textScore);
}

async function readSelectedMaterials() {
  const files = dedupeFiles([...Array.from(materials.files || []), ...Array.from(materialFolder.files || [])]);

  uploadedTexts = [];
  uploadedNames = [];
  uploadedFiles = files.map((file) => ({
    name: file.name,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    type: file.type || detectFileType(file.name),
  }));
  materialRecords = uploadedFiles.map((file) => ({
    ...file,
    status: isParseCandidate(file.name) ? "等待解析" : "已纳入清单",
    chars: 0,
    text: "",
    error: "",
    meta: {},
  }));
  uploadStats = buildUploadStats(uploadedFiles);
  isReadingMaterials = true;
  renderUploadSummary("正在读取材料内容...");
  updateGenerateButtonState();

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const record = materialRecords[index];
      if (!isParseCandidate(file.name)) continue;
      record.status = "解析中";
      renderUploadSummary(`正在读取 ${index + 1}/${files.length}：${record.path}`);
      await withTimeout(readMaterialFile(file, record), 30000, `${record.path} 解析超时，已先纳入材料清单`);
    }
  } catch (error) {
    const current = materialRecords.find((record) => record.status === "解析中");
    if (current) {
      current.status = "解析失败";
      current.error = error.message || String(error);
    }
  } finally {
    syncUploadedTextsFromRecords();
    uploadStats.parsed = materialRecords.filter((record) => record.status === "已解析").length;
    uploadedNames = uploadedFiles.map((file) => file.path);
    isReadingMaterials = false;
    updateGenerateButtonState();
    renderUploadSummary();
  }
}

function syncUploadedTextsFromRecords() {
  uploadedTexts = materialRecords.filter((record) => record.text).map((record) => formatMaterialText(record.path, record.text));
  uploadedNames = uploadedFiles.map((file) => file.path);
}

function updateGenerateButtonState() {
  if (!generateButton) return;
  generateButton.classList.toggle("is-reading", isReadingMaterials);
  generateButton.title = isReadingMaterials ? "材料仍在读取中，可先生成当前已完成内容的报告" : "生成分析报告";
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function dedupeFiles(files) {
  const map = new Map();
  files.forEach((file) => {
    const key = `${file.webkitRelativePath || file.name}|${file.size}|${file.lastModified}`;
    map.set(key, file);
  });
  return Array.from(map.values());
}

async function readMaterialFile(file, record) {
  try {
    let text = "";
    if (textFilePattern.test(file.name)) text = await file.text();
    else if (excelFilePattern.test(file.name)) text = await readSpreadsheet(file, record);
    else if (wordFilePattern.test(file.name)) text = await readWord(file, record);
    else if (pptFilePattern.test(file.name)) text = await readPpt(file, record);
    else if (pdfFilePattern.test(file.name)) text = await readPdf(file, record);

    const normalized = normalizeText(text);
    record.text = normalized.length > maxTextLengthPerFile ? `${normalized.slice(0, maxTextLengthPerFile)}\n...` : normalized;
    record.chars = record.text.length;
    record.status = record.chars ? "已解析" : "无可读文本";
  } catch (error) {
    record.status = "解析失败";
    record.error = error.message || String(error);
  }
}

async function readSpreadsheet(file, record) {
  if (!window.XLSX) throw new Error("Excel解析库未加载");
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
  record.meta.sheets = workbook.SheetNames;
  return workbook.SheetNames.slice(0, 12)
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return `【工作表：${sheetName}】\n${rows}`;
    })
    .join("\n\n");
}

async function readWord(file) {
  if (!window.mammoth) throw new Error("Word解析库未加载");
  const buffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function readPpt(file, record) {
  if (!window.JSZip) throw new Error("PPT解析库未加载");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] || 0) - Number(b.match(/slide(\d+)/)?.[1] || 0));
  record.meta.slides = slides.length;

  const parser = new DOMParser();
  const parts = [];
  for (const slide of slides) {
    const xml = await zip.file(slide).async("text");
    const doc = parser.parseFromString(xml, "application/xml");
    const texts = Array.from(doc.getElementsByTagName("a:t"))
      .map((node) => node.textContent.trim())
      .filter(Boolean);
    if (texts.length) parts.push(`【${slide}】\n${texts.join("\n")}`);
  }
  return parts.join("\n\n");
}

async function readPdf(file, record) {
  if (!window.pdfjsLib) throw new Error("PDF解析库未加载");
  const task = window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  record.meta.pages = pdf.numPages;
  const pages = [];
  const pageLimit = Math.min(pdf.numPages, 30);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(`【第${pageNumber}页】\n${text}`);
  }
  if (pdf.numPages > pageLimit) {
    pages.push(`【系统提示】PDF共${pdf.numPages}页，本次优先抽取前${pageLimit}页用于快速分析。`);
  }

  return pages.join("\n\n");
}

function scoreRules(text, rules, minScore) {
  return rules
    .map((rule) => {
      const score = rule.keys.reduce((sum, key) => sum + countMatches(text, key), 0);
      return { ...rule, score };
    })
    .filter((item) => item.score > minScore)
    .sort((a, b) => b.score - a.score);
}

function countMatches(text, keyword) {
  if (!keyword) return 0;
  return (text.match(new RegExp(escapeRegExp(keyword), "gi")) || []).length;
}

function pickEvidence(text, keys, limit) {
  const sentences = normalizeText(text)
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 20 && item.length < 220);
  const hits = [];

  for (const sentence of sentences) {
    if (keys.some((key) => sentence.includes(key))) hits.push(sentence);
    if (hits.length >= limit) break;
  }

  return hits;
}

function extractSystems(text) {
  const systemKeys = ["ERP", "PLM", "MES", "PM", "LIMS", "CRM", "OA", "中模云", "钉钉", "飞书", "Excel", "费控", "多维表格"];
  return systemKeys.filter((key) => countMatches(text, key) > 0);
}

function extractForms() {
  const formMap = new Map();
  const pattern = /(?:JL-\d+)?《([^》]{3,40})》/g;
  uploadedNames.forEach((name) => {
    let match;
    while ((match = pattern.exec(name))) formMap.set(match[1].trim(), true);
  });
  materialRecords.forEach((record) => {
    let match;
    while ((match = pattern.exec(record.text))) formMap.set(match[1].trim(), true);
  });
  return Array.from(formMap.keys()).slice(0, 80);
}

function summarizeMaterials() {
  return {
    total: materialRecords.length,
    parsed: materialRecords.filter((record) => record.status === "已解析").length,
    failed: materialRecords.filter((record) => record.status === "解析失败").length,
    chars: materialRecords.reduce((sum, record) => sum + record.chars, 0),
    types: uploadStats.types,
  };
}

function renderUploadSummary(status) {
  if (!uploadedFiles.length) {
    uploadSummary.innerHTML = `
      <strong>未选择材料</strong>
      <span>可上传任意格式文件或客户资料文件夹。</span>
    `;
    return;
  }

  const parsed = materialRecords.filter((record) => record.status === "已解析").length;
  const failed = materialRecords.filter((record) => record.status === "解析失败").length;
  const chars = materialRecords.reduce((sum, record) => sum + record.chars, 0);
  const typeSummary = Object.entries(uploadStats.types)
    .map(([type, count]) => `${type} ${count}`)
    .join(" / ");
  const samples = materialRecords
    .slice(0, 8)
    .map((file) => `<li><span>${escapeHtml(file.status)}</span> ${escapeHtml(file.path)}${file.chars ? `（${formatNumber(file.chars)}字）` : ""}</li>`)
    .join("");
  const rest = materialRecords.length > 8 ? `<li>另有 ${materialRecords.length - 8} 个材料...</li>` : "";

  uploadSummary.innerHTML = `
    <strong>${escapeHtml(status || `已选择 ${uploadStats.total} 个材料，已解析 ${parsed} 个，失败 ${failed} 个`)}</strong>
    <span>${escapeHtml(typeSummary)}；累计读取约 ${formatNumber(chars)} 字。</span>
    <ul>${samples}${rest}</ul>
  `;
}

function buildUploadStats(files) {
  return files.reduce(
    (stats, file) => {
      const type = detectFileType(file.path || file.name);
      stats.total += 1;
      stats.folders += file.path.includes("/") ? 1 : 0;
      stats.types[type] = (stats.types[type] || 0) + 1;
      return stats;
    },
    { total: 0, parsed: 0, folders: 0, types: {} },
  );
}

function isParseCandidate(fileName) {
  return (
    textFilePattern.test(fileName) ||
    excelFilePattern.test(fileName) ||
    wordFilePattern.test(fileName) ||
    pdfFilePattern.test(fileName) ||
    pptFilePattern.test(fileName)
  );
}

function detectFileType(fileName) {
  if (excelFilePattern.test(fileName)) return "Excel";
  if (wordFilePattern.test(fileName)) return "Word";
  if (pdfFilePattern.test(fileName)) return "PDF";
  if (pptFilePattern.test(fileName)) return "PPT";
  if (/\.(csv|tsv)$/i.test(fileName)) return "表格文本";
  if (textFilePattern.test(fileName)) return "文本";
  if (/\.(doc)$/i.test(fileName)) return "旧版Word";
  if (audioFilePattern.test(fileName)) return "录音";
  if (imageFilePattern.test(fileName)) return "图片";
  return "其他";
}

function inferCustomerName() {
  const joined = uploadedNames.join(" ");
  const match = joined.match(/([^/\s]{2,16}(?:电子|集团|科技|股份|有限公司|公司))/);
  return match?.[1] || "";
}

function formatMaterialText(path, text) {
  const trimmed = normalizeText(text);
  if (!trimmed) return "";
  return `【材料：${path}】\n${trimmed}`;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function riskClass(level) {
  return level === "高" ? "risk-high" : level === "中" ? "risk-medium" : "risk-low";
}

function inferCoreBusinessName(data, analysis) {
  const text = [
    data && data.combinedText,
    uploadedNames.join(" "),
    analysis && analysis.scenarios && analysis.scenarios.map((item) => item.title).join(" "),
    analysis && analysis.functionRows && analysis.functionRows.map((row) => row[0]).join(" "),
  ]
    .filter(Boolean)
    .join("\n")
    .toUpperCase();

  const candidates = [
    { name: "APQP", keys: ["APQP", "PPAP", "DFMEA", "PFMEA", "控制计划", "质量阀", "先期策划"] },
    { name: "IPD", keys: ["IPD", "集成产品开发", "产品开发流程", "研发流程", "TR评审", "DCP", " charter ".toUpperCase()] },
    { name: "IPMS", keys: ["IPMS", "项目管理系统", "项目管理平台", "项目群", "项目组合", "项目过程"] },
    { name: "PPAP", keys: ["PPAP", "生产件批准", "提交保证书", "PSW"] },
    { name: "LIMS", keys: ["LIMS", "实验室", "实验委托", "样品", "测试报告"] },
    { name: "CRM", keys: ["CRM", "客户关系", "商机", "拜访", "销售线索"] },
    { name: "SRM", keys: ["SRM", "供应商关系", "供应商协同", "供应商准入", "供应商绩效"] },
    { name: "OTD", keys: ["OTD", "准时交付", "交期", "产销协同", "排产"] },
  ];

  const scored = candidates
    .map((candidate) => ({
      name: candidate.name,
      score: candidate.keys.reduce((sum, key) => sum + countKeyword(text, key.toUpperCase()), 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score > 0) {
    return scored[0].name;
  }

  if (analysis && analysis.scenarios && analysis.scenarios[0]) {
    return analysis.scenarios[0].title.replace(/中心|门户|看板|协同|管理|轻量化/g, "").slice(0, 12) || "核心流程";
  }

  return "核心流程";
}

function countKeyword(text, keyword) {
  if (!keyword.trim()) return 0;
  return text.split(keyword).length - 1;
}

async function buildFullHtml(body) {
  const styles = await getExportStyles();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>业务需求分析报告</title>
  <style>${styles}</style>
</head>
<body class="export-body">
  <main class="report-preview export-report">${body}</main>
</body>
</html>`;
}

async function getExportStyles() {
  try {
    const response = await fetch("./styles.css", { cache: "no-store" });
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Fall back to live style sheets when the exported page is opened from file://.
  }

  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
}

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "客户";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}
