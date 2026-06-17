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
    keys: ["供应商", "供应商准入", "供应商绩效", "采购", "采购订单", "准入", "准出", "催单", "到货", "资质"],
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
    keys: ["供应商", "采购", "供应商准入", "供应商绩效", "准入", "资质", "采购订单", "到货"],
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
  const pains = scoreRules(text, painRules, 1, { minDistinct: 2 }).map((item) => ({
    ...item,
    evidence: pickEvidence(text, item.keys, 2),
  }));
  const forms = extractForms();
  const systems = extractSystems(text);
  const themes = extractBusinessThemes(text);
  const topTerms = extractTopTerms(text);
  const detectedProcesses = extractCoreProcesses(text);
  const apqpDetected = detectedProcesses.some((item) => item.name === "APQP");
  const scoredScenarios = scoreRules(text, scenarioRules, apqpDetected ? 0 : 2, { minDistinct: apqpDetected ? 1 : 2 }).slice(0, 9);
  const scenarios = scoredScenarios.length ? scoredScenarios : buildScenariosFromThemes(themes, systems, forms, topTerms, data.industry);
  const materialSummary = summarizeMaterials();
  const coverage = calculateCoverage(data, materialSummary);
  const risks = buildRisks(data, pains, systems, forms, apqpDetected, themes);
  const framework = buildFramework(data.industry, scenarios, systems, forms, apqpDetected, themes, detectedProcesses, topTerms);
  const functionRows = buildFunctionRows(scenarios, pains, apqpDetected, themes);
  const roadmap = buildRoadmap(apqpDetected, scenarios, themes, systems);
  const status = buildCurrentStatus(data, materialSummary, departments, systems, forms, apqpDetected, themes, topTerms);
  const challenges = buildChallenges(pains, departments, systems, forms, text);
  const solution = buildSolution(data, apqpDetected, scenarios, systems, themes, detectedProcesses);
  const consulting = buildConsultingView({
    data,
    departments,
    pains,
    scenarios,
    forms,
    systems,
    themes,
    topTerms,
    detectedProcesses,
    apqpDetected,
    materialSummary,
  });
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
    themes,
    topTerms,
    detectedProcesses,
    consulting,
    keywords: [...new Set([...pains.map((item) => item.label), ...systems, ...departments.map((item) => item.name), ...themes.map((item) => item.name), ...topTerms.slice(0, 8)])],
  };
}

function buildConsultingView(context) {
  const { data, departments, pains, scenarios, forms, systems, themes, topTerms, detectedProcesses, apqpDetected, materialSummary } = context;
  const focus = detectedProcesses[0]?.name || themes[0]?.name || scenarios[0]?.title || topTerms[0] || data.industry;
  const scope = themes.slice(0, 4).map((item) => item.name);
  const modules = scenarios.slice(0, 5).map((item) => item.title);
  const evidence = [
    ...pains.flatMap((pain) => pain.evidence.map((item) => ({ title: pain.label, text: item }))),
    ...themes.flatMap((theme) => theme.evidence.map((item) => ({ title: theme.name, text: item }))),
  ].slice(0, 8);
  const diagnosis = pains.length
    ? `材料显示，${data.customerName}当前最需要优先处理的是${pains.slice(0, 3).map((item) => item.label).join("、")}，这些问题会直接影响${focus}的执行效率和管理可追溯性。`
    : scope.length
      ? `材料尚未暴露强烈痛点，但高频主题集中在${scope.join("、")}，咨询建议先把这些主题还原成流程、角色、字段和交付物，再判断系统建设边界。`
      : `当前材料仍偏零散，咨询建议先完成资料归类和补充访谈，再进入正式系统蓝图。`;

  const strategy = apqpDetected
    ? `以${focus}为业务主线，不建议先做大而全的平台；应先围绕阶段评审、交付物、问题清单和质量阀做样板流程，再扩展到相关协同场景。`
    : modules.length
      ? `以${modules.slice(0, 3).join("、")}作为第一批样板，不按部门铺开，而是按“证据充分、痛点集中、跨部门影响大”的顺序推进。`
      : `先建立需求事实库和访谈补充清单，避免在业务事实不足时直接给出系统模块清单。`;

  const architecturePrinciple = systems.length
    ? `系统框架需要围绕${systems.slice(0, 4).join("、")}的边界展开，先确认哪些数据由现有系统负责、哪些流程由新平台承接。`
    : `系统框架暂不假设既有系统，应先围绕${scope.slice(0, 3).join("、") || focus}建立业务对象和流程台账，再决定是否需要集成。`;

  const priorityBasis = [
    pains.length ? `痛点强度：${pains.slice(0, 3).map((item) => `${item.label}(${item.score})`).join("、")}` : "",
    departments.length ? `组织跨度：${departments.slice(0, 5).map((item) => item.name).join("、")}` : "",
    systems.length ? `系统线索：${systems.join("、")}` : "",
    forms.length ? `表单资产：识别到 ${forms.length} 类表单/节点` : "",
    materialSummary.parsed ? `材料基础：已解析 ${materialSummary.parsed}/${materialSummary.total} 个材料` : "",
  ].filter(Boolean);

  const decisionRows = (scenarios.length ? scenarios : themes).slice(0, 6).map((item, index) => {
    const title = item.title || `${item.name}管理模块`;
    const reason = item.evidence && item.evidence.length
      ? item.evidence[0]
      : item.desc || `材料中${item.name || title}相关信号较高，建议纳入蓝图范围。`;
    const consultingValue = pains[index]
      ? `优先回应“${pains[index].label}”，降低后续方案偏离真实痛点的风险。`
      : `把“${title}”转成可确认范围、可拆分任务、可验收成果的实施单元。`;
    return [title, reason, consultingValue];
  });

  const landingQuestions = [
    scope.length ? `客户是否认可${scope.slice(0, 3).join("、")}作为首批蓝图范围？` : "客户是否能补充更明确的流程样例和访谈纪要？",
    departments.length ? `${departments[0].name}是否可以牵头确认跨部门责任边界？` : "是否已经明确业务牵头人和IT配合人？",
    systems.length ? `${systems[0]}的数据字段、接口权限和更新频率是否可开放确认？` : "是否存在现有系统、Excel或历史台账需要纳入边界？",
    forms.length ? `已识别表单是否存在多版本、废止版本或线下补签规则？` : "是否有表单、截图或台账样例可补充？",
  ];

  return {
    focus,
    diagnosis,
    strategy,
    architecturePrinciple,
    priorityBasis,
    decisionRows,
    evidence,
    landingQuestions,
  };
}

function buildCurrentStatus(data, materialSummary, departments, systems, forms, apqpDetected, themes, topTerms) {
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

  if (!apqpDetected && themes.length) {
    status.push(`材料高频主题集中在 ${themes.slice(0, 5).map((item) => item.name).join("、")}，后续方案应围绕这些真实业务域展开，而不是套用既有行业话术。`);
  }

  if (!apqpDetected && !themes.length && topTerms.length) {
    status.push(`材料中的高频词包括 ${topTerms.slice(0, 8).join("、")}，当前更适合先做资料归类、流程访谈和字段梳理，再沉淀正式系统蓝图。`);
  }

  if (systems.length) {
    const relation = forms.length ? `与 ${forms.slice(0, 4).join("、")} 等材料资产之间` : "与当前业务流程之间";
    status.push(`现有系统或工具线索包括 ${systems.join("、")}，需要进一步确认${relation}的数据边界、责任归属和更新频率。`);
  }

  if (!materialSummary.parsed) {
    status.push("当前未解析到有效正文，建议补充可读取的 Word、PDF、PPT、Excel、CSV 或文本材料后再生成正式报告。");
  }

  return status;
}

function extractBusinessThemes(text) {
  const themeRules = [
    { name: "客户管理", keys: ["客户", "联系人", "拜访", "商机", "CRM", "销售线索", "客户档案", "回款"] },
    { name: "项目管理", keys: ["项目", "立项", "计划", "里程碑", "任务", "交付物", "结项", "项目经理"] },
    { name: "研发管理", keys: ["研发", "设计", "需求", "评审", "变更", "样品", "图纸", "BOM"] },
    { name: "质量管理", keys: ["质量", "客诉", "异常", "检验", "整改", "8D", "审核", "追溯"] },
    { name: "采购供应", keys: ["采购", "供应商", "询价", "订单", "到货", "准入", "绩效", "库存"] },
    { name: "生产交付", keys: ["生产", "排产", "工单", "车间", "交期", "发货", "产能", "计划"] },
    { name: "财务费用", keys: ["财务", "费用", "预算", "报销", "发票", "成本", "对账", "付款"] },
    { name: "人事行政", keys: ["人事", "招聘", "入职", "培训", "绩效", "考勤", "行政", "档案"] },
    { name: "合同法务", keys: ["合同", "法务", "条款", "审批", "用印", "归档", "风险", "续签"] },
    { name: "设备资产", keys: ["设备", "资产", "维修", "保养", "点检", "备件", "台账", "故障"] },
    { name: "知识文档", keys: ["知识", "文档", "制度", "SOP", "版本", "归档", "附件", "模板"] },
    { name: "数据报表", keys: ["报表", "看板", "指标", "统计", "数据", "分析", "汇总", "口径"] },
  ];

  return themeRules
    .map((theme) => ({
      ...theme,
      score: theme.keys.reduce((sum, key) => sum + countMatches(text, key), 0),
      distinct: theme.keys.filter((key) => countMatches(text, key) > 0).length,
      evidence: pickEvidence(text, theme.keys, 2),
    }))
    .filter((theme) => theme.distinct >= 2 || theme.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function extractCoreProcesses(text) {
  const processRules = [
    { name: "APQP", keys: ["APQP", "PPAP", "DFMEA", "PFMEA", "控制计划", "先期策划"] },
    { name: "IPD", keys: ["IPD", "集成产品开发", "TR评审", "DCP", "产品开发流程"] },
    { name: "IPMS", keys: ["IPMS", "项目管理系统", "项目组合", "项目群", "项目过程"] },
    { name: "CRM", keys: ["CRM", "客户关系", "商机", "销售线索", "客户拜访"] },
    { name: "SRM", keys: ["SRM", "供应商关系", "供应商准入", "供应商绩效"] },
    { name: "LIMS", keys: ["LIMS", "实验室", "实验委托", "样品检测", "测试报告"] },
    { name: "OA", keys: ["OA", "审批流", "公文", "用印", "流程审批"] },
    { name: "ERP", keys: ["ERP", "企业资源计划"] },
  ];

  return processRules
    .map((item) => ({ ...item, score: item.keys.reduce((sum, key) => sum + countMatches(text, key), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function extractTopTerms(text) {
  const stopWords = new Set(["材料", "客户", "系统", "流程", "业务", "管理", "进行", "需要", "当前", "文件", "公司", "问题", "通过", "相关", "实现", "一个"]);
  const words = normalizeText(text).match(/[A-Za-z][A-Za-z0-9_-]{1,20}|[\u4e00-\u9fa5]{2,8}/g) || [];
  const counts = new Map();
  words.forEach((word) => {
    const normalized = /^[A-Za-z]/.test(word) ? word.toUpperCase() : word;
    if (stopWords.has(normalized) || normalized.length < 2) return;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([word]) => word);
}

function buildScenariosFromThemes(themes, systems, forms, topTerms, industry) {
  if (themes.length) {
    return themes.slice(0, 8).map((theme) => ({
      id: `theme-${theme.name}`,
      title: `${theme.name}管理模块`,
      keys: theme.keys,
      score: theme.score,
      evidence: theme.evidence,
      desc: `材料中“${theme.name}”相关线索出现 ${theme.score} 次，建议围绕台账、流程、角色、附件、提醒和报表建立闭环。`,
    }));
  }

  if (forms.length) {
    return forms.slice(0, 6).map((form) => ({
      id: `form-${form}`,
      title: `${form}线上化`,
      keys: [form],
      score: 1,
      evidence: [],
      desc: `围绕《${form}》建立线上填报、审批、附件归档、状态追踪和统计分析。`,
    }));
  }

  if (systems.length) {
    return systems.slice(0, 6).map((system) => ({
      id: `system-${system}`,
      title: `${system}协同与数据集成`,
      keys: [system],
      score: 1,
      evidence: [],
      desc: `梳理 ${system} 与周边流程的数据边界、字段口径、同步规则和经营看板。`,
    }));
  }

  return topTerms.slice(0, 4).map((term) => ({
    id: `term-${term}`,
    title: `${term}需求线索`,
    keys: [term],
    score: 1,
    evidence: [],
    desc: `材料中出现“${term}”线索，建议进一步访谈确认其业务流程、角色、数据和痛点。`,
  }));
}

function buildChallenges(pains, departments, systems, forms, text) {
  const items = pains.slice(0, 7).map((pain) => `${pain.label}：${pain.insight}`);

  if (forms.length >= 20) {
    items.push(`表单体系复杂：已识别 ${forms.length} 类表单/节点，若只是原样搬到线上，容易形成“电子化的纸质流程”。`);
  }

  if (systems.length >= 4) {
    items.push(`系统并存但口径不一：${systems.slice(0, 6).join("、")} 等工具需要明确主数据、接口边界和回写规则。`);
  }

  if (/主机厂|蔚来|小鹏|理想|客户要求|客户投诉|客户反馈|客户问询/.test(text)) {
    items.push("客户侧响应要求明确：材料中出现客户要求、反馈或问询线索，需要把对外承诺、内部处理状态和责任闭环拉通。");
  }

  if (departments.length >= 8) {
    items.push(`跨部门协同跨度大：材料覆盖 ${departments.slice(0, 8).map((item) => item.name).join("、")} 等角色，必须先定义责任边界、交接规则和响应时限。`);
  }

  return [...new Set(items)].slice(0, 9);
}

function buildSolution(data, apqpDetected, scenarios, systems, themes, detectedProcesses) {
  const solution = [];
  solution.push("先把上传材料中的制度、表单、访谈纪要和汇总报告统一抽取为业务对象、流程节点、审批角色、数据字段、系统来源和风险事件。");

  if (apqpDetected) {
    solution.push("以APQP项目全过程为主线，建立客户需求、项目、任务、表单、审批、交付物、问题、风险、成本和知识的统一模型。");
  } else if (detectedProcesses.length) {
    solution.push(`以 ${detectedProcesses.map((item) => item.name).join("、")} 等材料中明确出现的流程为主线，梳理阶段、角色、输入输出、审批规则和指标闭环。`);
  } else if (themes.length) {
    solution.push(`围绕 ${themes.slice(0, 4).map((item) => item.name).join("、")} 等高频业务主题，先建立业务对象、状态流转、资料归档和责任分工。`);
  } else {
    solution.push("当前材料尚未呈现明确流程主线，建议先做材料归类和补充访谈，再建立流程、任务、台账、审批、资料、指标和风险的一体化模型。");
  }

  if (scenarios.length) {
    solution.push(`优先上线 ${scenarios.slice(0, 4).map((item) => item.title).join("、")}，用真实痛点场景建立样板。`);
  }

  if (systems.length) {
    solution.push(`同步梳理 ${systems.slice(0, 5).join("、")} 的数据接口、字段口径和主数据归属，避免协同平台变成新的孤岛。`);
  }

  const firstModule = scenarios[0]?.title || themes[0]?.name || "已识别高频场景";
  solution.push(`落地节奏建议从“${firstModule}”开始验证，再按材料中出现频次和跨部门影响范围逐步扩展，边上线边校准组织规则。`);
  return solution;
}

function buildFramework(industry, scenarios, systems, forms, apqpDetected, themes, detectedProcesses, topTerms) {
  if (apqpDetected) {
    const apqpModules = scenarios.length ? scenarios.map((item) => item.title).slice(0, 5) : themes.slice(0, 5).map((item) => `${item.name}管理`);
    const apqpForms = forms.length ? forms.slice(0, 5).join("、") : "材料中出现的APQP交付物";
    const apqpSystems = systems.length ? systems.join("、") : "待确认现有系统";
    return [
      ["统一入口层", `${apqpModules.join("、") || "APQP过程"} 的任务入口、阶段提醒、材料归档和部门视图。`],
      ["APQP项目层", `${apqpForms} 的阶段计划、责任人、质量阀、交付物和问题清单。`],
      ["协同执行层", `${themes.length ? themes.slice(0, 4).map((item) => item.name).join("、") : apqpModules.join("、") || "APQP相关事项"} 等材料高频主题的跨部门流转。`],
      ["资料资产层", `${forms.length ? forms.slice(0, 6).join("、") : "制度、表单、会议纪要"} 的版本、附件、审批记录和复盘沉淀。`],
      ["集成数据层", `${apqpSystems} 的数据同步、字段映射、指标口径和分析视图。`],
    ];
  }

  const modules = scenarios.length
    ? scenarios.map((item) => item.title).slice(0, 6)
    : themes.length
      ? themes.slice(0, 6).map((item) => `${item.name}管理`)
      : detectedProcesses.length
        ? detectedProcesses.map((item) => `${item.name}流程管理`)
        : topTerms.length
          ? topTerms.slice(0, 5).map((item) => `${item}需求线索`)
          : ["材料解析", "访谈补充", "需求澄清"];
  const channelDesc = systems.length
    ? `${systems.slice(0, 4).join("、")} 工作入口、消息提醒和材料归档。`
    : "围绕已上传材料建立工作入口、任务提醒和材料归档。";
  const integrationDesc = systems.length
    ? `${systems.join("、")} 对接、字段口径、权限审计和运维监控。`
    : "待客户补充现有系统后，再确认对接方式、权限审计和运维边界。";
  return [
    ["统一入口层", channelDesc],
    ["流程协同层", `${modules.slice(0, 3).join("、")} 的流程编排、状态流转、任务提醒和操作留痕。`],
    ["业务能力层", modules.join("、") + "。"],
    ["数据分析层", `${themes.length ? themes.slice(0, 4).map((item) => item.name).join("、") : modules.slice(0, 4).join("、")} 的业务台账、指标口径、统计视图和异常提醒。`],
    ["集成治理层", integrationDesc],
  ];
}

function buildRisks(data, pains, systems, forms, apqpDetected, themes) {
  const focus = themes[0]?.name || data.industry || "当前业务";
  const risks = [`${focus}范围需要在蓝图阶段明确首批流程、关键表单和试点场景，避免材料持续补充导致交付边界漂移。`];

  if (forms.length >= 20) {
    risks.push("表单数量多且历史版本复杂，需要先做表单合并、字段标准化和流程重构，不能简单照搬Excel版式。");
  }

  if (apqpDetected) {
    risks.push("APQP/PPAP相关节点涉及研发、质量、采购、计划、生产、财务等多方，必须同步定义责任人、审批SLA和质量阀规则。");
  }

  if (systems.length >= 3) {
    risks.push(`${systems.slice(0, 5).join("、")} 的集成涉及接口权限、编码映射、字段口径和数据回写，需提前完成系统摸底。`);
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

  if (!apqpDetected && !pains.length && themes.length < 2) {
    risks.push("当前材料业务信号较弱，若直接进入系统设计，容易输出泛化方案；建议补充流程样例、字段清单、问题记录或访谈纪要。");
  }

  return [...new Set(risks)];
}

function buildFunctionRows(scenarios, pains, apqpDetected, themes) {
  const painText = pains.map((item) => item.label).join("、");
  const fallback = themes.length
    ? themes.slice(0, 8).map((theme) => ({
        id: `theme-${theme.name}`,
        title: `${theme.name}管理模块`,
        desc: `围绕材料中反复出现的“${theme.name}”主题，沉淀业务台账、状态流转、责任人、附件资料和统计视图。`,
      }))
    : apqpDetected
      ? scenarioRules.slice(0, 7)
      : [];
  const selected = scenarios.length ? scenarios : fallback;

  if (!selected.length) {
    return [
      ["材料解析与需求线索库", "将上传文件按文件类型、业务关键词、表单名称和证据句自动归类，形成可追溯的需求线索清单。", "避免在材料不足时套用固定模板，先帮助顾问判断还缺哪些业务信息。"],
      ["业务访谈补充清单", "根据已上传材料的空白点，生成后续访谈问题、需补充样表和需确认系统边界。", "提升调研完整度，降低方案偏离客户真实业务的风险。"],
      ["初版流程蓝图工作台", "在资料补齐后，把流程阶段、角色、输入输出、审批规则和数据字段组织成蓝图。", "为后续正式系统方案和实施范围确认提供结构化基础。"],
    ];
  }

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

    const evidence = item.evidence && item.evidence.length ? `材料证据：${item.evidence[0]}` : "";
    return [
      item.title,
      evidence ? `${item.desc} ${evidence}` : item.desc,
      painText ? `直接回应 ${painText} 等痛点，减少人工追踪和信息反复确认。` : `把“${item.title}”从资料线索转成可跟踪、可统计、可复盘的业务闭环。`,
    ];
  });
}

function buildRoadmap(apqpDetected, scenarios, themes, systems) {
  if (apqpDetected) {
    const first = scenarios[0]?.title || `${themes[0]?.name || "APQP"}流程`;
    const second = scenarios.slice(1, 4).map((item) => item.title).join("、") || themes.slice(1, 4).map((item) => `${item.name}管理`).join("、") || "APQP关联场景";
    return [
      ["1-2个月", "APQP样板验证", `围绕${first}梳理阶段、表单、责任人和质量阀规则`, "用已上传材料验证复杂表单、催办、归档和阶段评审可用性"],
      ["3-6个月", "关联场景铺开", `扩展${second}，补齐跨部门任务、问题清单和交付物跟踪`, "让APQP相关材料从文件归档转为过程协同"],
      ["6个月+", "数据与复盘深化", "打通材料中已出现系统的数据边界，沉淀项目复盘、指标分析和知识资产", "形成可追溯、可统计、可复用的APQP过程资产"],
    ];
  }

  if (themes.length || scenarios.length) {
    const first = scenarios[0]?.title || `${themes[0]?.name || "核心业务"}管理`;
    const second = scenarios.slice(1, 4).map((item) => item.title).join("、") || themes.slice(1, 4).map((item) => `${item.name}管理`).join("、") || "相关业务模块";
    const integration = systems.length
      ? `打通 ${systems.slice(0, 4).join("、")} 的数据边界，统一${themes.slice(0, 3).map((item) => item.name).join("、") || "核心业务"}指标口径`
      : `围绕${themes.slice(0, 3).map((item) => item.name).join("、") || first}沉淀指标口径、统计视图和复盘资料`;
    return [
      ["1-2个月", "资料核验与试点", `围绕${first}梳理流程、字段、角色和样表，先上线一个真实场景`, "验证材料识别结果和用户操作路径，形成可复用样板"],
      ["3-6个月", "主题场景扩展", `扩展${second}，补齐台账、审批、提醒、报表和归档`, "形成跨部门业务闭环，减少线下追踪和重复汇总"],
      ["6个月+", systems.length ? "系统数据治理" : "指标与复盘治理", integration, "让报告中识别出的业务线索沉淀为可统计、可追溯、可复用的管理资产"],
    ];
  }

  return [
    ["1-2个月", "材料补齐", "补充流程样例、表单字段、访谈纪要、系统截图和问题台账", "先形成可信的业务事实库"],
    ["3-6个月", "蓝图确认", "基于事实库确定核心场景、功能边界、角色权限和数据口径", "避免泛化建设和范围失控"],
    ["6个月+", "分阶段落地", "按优先级上线试点场景，并逐步扩展集成和运营看板", "稳步形成业务闭环"],
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
          <p class="report-kicker">Consulting Assessment</p>
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
        ${renderConsultingPointOfView(analysis)}
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
        ${renderArchitectureAdvice(analysis)}
        ${renderCapabilityBlueprint(analysis)}
        ${renderArchitecture(analysis)}
      </section>

      <section class="report-section">
        <h3>五、系统功能说明</h3>
        ${renderFunctionTable(analysis.functionRows, analysis)}
      </section>

      <section class="report-section">
        <h3>六、系统落地风险</h3>
        ${renderImplementationPlan(analysis)}
        ${renderLandingQuestions(analysis)}
        <ul>${analysis.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section class="report-section">
        <h3>七、证据摘要</h3>
        ${renderDashboardVisual(analysis)}
        ${renderEvidenceTrace(analysis)}
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
  const topThemes = analysis.themes.slice(0, 4).map((item) => item.name);
  const mainline = inferMainline(analysis);
  const buildMode = inferBuildMode(analysis);
  const target = inferDeliveryTarget(analysis);
  const conclusion = topPains.length
    ? `当前核心矛盾集中在${topPains.join("、")}，建议以${topModules.join("、") || mainline}作为首批数字化抓手。`
    : topThemes.length
      ? `材料主题主要集中在${topThemes.join("、")}，建议先围绕${mainline}梳理对象、流程、角色、字段和指标。`
      : `当前材料尚不足以形成强诊断，建议先补齐流程制度、表单样例和访谈纪要，再进入蓝图设计。`;
  return `
    <div class="executive-summary">
      <div class="summary-lead">
        <span>Solution Point of View</span>
        <strong>${escapeHtml(conclusion)}</strong>
      </div>
      <div class="summary-cards">
        <div><b>业务主线</b><span>${escapeHtml(mainline)}</span></div>
        <div><b>建设方式</b><span>${escapeHtml(buildMode)}</span></div>
        <div><b>交付目标</b><span>${escapeHtml(target)}</span></div>
      </div>
    </div>
  `;
}

function inferBuildMode(analysis) {
  const first = analysis.functionRows[0]?.[0] || analysis.themes[0]?.name || "资料解析";
  const second = analysis.systems.length ? `${analysis.systems.slice(0, 2).join("、")}集成` : "规则固化";
  return `${first}试点 + ${second} + 分阶段推广`;
}

function inferDeliveryTarget(analysis) {
  if (analysis.pains.length) {
    return analysis.pains
      .slice(0, 3)
      .map((item) => item.label.replace(/与/g, "").replace(/不足|缺失|薄弱|分散|脱节|黑盒|伪合规/g, "改善"))
      .join("、");
  }

  if (analysis.themes.length) {
    return `${analysis.themes.slice(0, 3).map((item) => item.name).join("、")}可追踪可统计`;
  }

  return "材料可归类、需求可追溯、边界可确认";
}

function inferMainline(analysis) {
  if (analysis.detectedProcesses.length) {
    return `${analysis.detectedProcesses.slice(0, 3).map((item) => item.name).join(" / ")}流程`;
  }

  if (analysis.themes.length) {
    return `${analysis.themes.slice(0, 3).map((item) => item.name).join(" / ")}协同`;
  }

  if (analysis.scenarios.length) {
    return analysis.scenarios[0].title;
  }

  return "资料补齐与需求澄清";
}

function renderCurrentLandscape(analysis) {
  const systems = analysis.systems.slice(0, 6);
  const departments = analysis.departments.slice(0, 8).map((item) => item.name);
  const forms = analysis.forms.slice(0, 6);
  const assets = forms.length
    ? forms
    : analysis.themes.length
      ? analysis.themes.slice(0, 6).map((item) => `${item.name}资料`)
      : analysis.topTerms.slice(0, 6);
  return `
    <div class="landscape-map">
      <div class="landscape-column">
        <b>组织覆盖</b>
        <div>${(departments.length ? departments : ["材料未体现明确部门"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="landscape-column">
        <b>系统现状</b>
        <div>${(systems.length ? systems : ["材料未体现明确系统"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="landscape-column">
        <b>材料资产</b>
        <div>${(assets.length ? assets : ["待补充可读材料"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}

function renderDiagnosisMatrix(analysis) {
  const dimensions = buildDiagnosisDimensions(analysis);
  const title = analysis.themes.length
    ? `${analysis.themes[0].name}成熟度诊断`
    : analysis.pains.length
      ? `${analysis.pains[0].label}诊断`
      : "材料完整度诊断";
  return `
    <div class="diagnosis-panel">
      <div class="diagnosis-title">
        <span>成熟度诊断</span>
        <strong>${escapeHtml(title)}</strong>
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

function renderConsultingPointOfView(analysis) {
  const basis = analysis.consulting.priorityBasis.slice(0, 5);
  return `
    <div class="consulting-panel">
      <div class="consulting-lead">
        <b>顾问判断</b>
        <span>${escapeHtml(analysis.consulting.diagnosis)}</span>
      </div>
      <div class="consulting-lead">
        <b>建议路径</b>
        <span>${escapeHtml(analysis.consulting.strategy)}</span>
      </div>
      <div class="consulting-tags">
        ${basis.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function buildDiagnosisDimensions(analysis) {
  const byPain = [
    ["流程在线化", "paper", 35],
    ["数据贯通", "data", 30],
    ["过程预警", "warning", 28],
    ["知识沉淀", "knowledge", 32],
    ["外部协同", "supplier", 38],
  ].filter(([, id]) => analysis.pains.some((pain) => pain.id === id || (id === "supplier" && pain.id === "customer")));

  if (byPain.length) {
    return byPain.slice(0, 5).map(([name, , value]) => [name, value]);
  }

  if (analysis.themes.length) {
    return analysis.themes.slice(0, 5).map((theme) => {
      const score = Math.min(68, Math.max(34, 72 - theme.score * 4));
      return [`${theme.name}成熟度`, score];
    });
  }

  return [
    ["资料完整度", analysis.materialSummary.parsed ? 55 : 25],
    ["业务识别度", analysis.topTerms.length ? 48 : 22],
    ["流程清晰度", analysis.scenarios.length ? 52 : 26],
    ["系统边界", analysis.systems.length ? 50 : 28],
    ["落地准备度", analysis.functionRows.length ? 46 : 24],
  ];
}

function renderArchitectureAdvice(analysis) {
  const focusItems = [
    analysis.consulting.focus,
    ...analysis.themes.slice(0, 3).map((item) => item.name),
    ...analysis.systems.slice(0, 3),
  ].filter(Boolean);
  return `
    <div class="consulting-panel compact">
      <div class="consulting-lead">
        <b>架构原则</b>
        <span>${escapeHtml(analysis.consulting.architecturePrinciple)}</span>
      </div>
      <div class="consulting-tags">
        ${[...new Set(focusItems)].slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderSolutionBlueprint(analysis) {
  const modules = analysis.functionRows.slice(0, 5).map((row) => row[0]);
  const objects = buildObjectLabels(analysis).slice(0, 5).join("、") || "流程、表单、数据、角色";
  const closure = analysis.pains[0]?.label || analysis.themes[0]?.name || "需求线索";
  return `
    <div class="solution-blueprint">
      <div class="blueprint-step">
        <b>1. 业务对象建模</b>
        <span>${escapeHtml(objects)}统一编码，明确状态、责任人和附件归档。</span>
      </div>
      <div class="blueprint-arrow"></div>
      <div class="blueprint-step">
        <b>2. 场景流程上线</b>
        <span>${escapeHtml(modules.join("、") || "高频审批、台账、报表、协同流程")}。</span>
      </div>
      <div class="blueprint-arrow"></div>
      <div class="blueprint-step">
        <b>3. 数据闭环经营</b>
        <span>围绕${escapeHtml(closure)}形成指标、提醒、责任闭环和复盘机制。</span>
      </div>
    </div>
  `;
}

function renderCapabilityBlueprint(analysis) {
  const groups = buildCapabilityGroups(analysis);
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

function buildCapabilityGroups(analysis) {
  const themeItemMap = {
    客户管理: ["客户档案", "商机跟进", "拜访纪要", "合同回款"],
    项目管理: ["项目立项", "计划里程碑", "任务协同", "交付物归档"],
    研发管理: ["需求评审", "设计变更", "样品试制", "图纸BOM"],
    质量管理: ["检验记录", "异常处理", "整改验证", "质量追溯"],
    采购供应: ["供应商准入", "询价比价", "采购订单", "到货跟踪"],
    生产交付: ["生产计划", "工单执行", "发货交付", "产能看板"],
    财务费用: ["预算控制", "费用报销", "发票付款", "成本分析"],
    人事行政: ["招聘入职", "培训档案", "考勤绩效", "行政审批"],
    合同法务: ["合同起草", "条款评审", "用印归档", "续签预警"],
    设备资产: ["资产台账", "点检保养", "维修工单", "备件管理"],
    知识文档: ["制度模板", "版本管理", "附件归档", "知识检索"],
    数据报表: ["指标口径", "报表填报", "经营看板", "异常预警"],
  };

  const themeGroups = analysis.themes.slice(0, 3).map((theme) => [
    `${theme.name}域`,
    themeItemMap[theme.name] || ["业务台账", "流程审批", "资料归档", "统计看板"],
  ]);

  return [
    ...themeGroups,
    analysis.systems.length
      ? ["系统集成域", analysis.systems.slice(0, 4).map((item) => `${item}边界`)]
      : ["资料治理域", ["材料归类", "字段抽取", "证据追溯", "补充清单"]],
  ].slice(0, 4);
}

function renderImplementationPlan(analysis) {
  const riskCount = analysis.risks.length;
  const firstTheme = analysis.themes[0]?.name || analysis.functionRows[0]?.[0] || "核心业务";
  const modules = analysis.functionRows.slice(0, 3).map((row) => row[0]);
  const systems = analysis.systems.slice(0, 3);
  return `
    <div class="implementation-board">
      <div>
        <b>${escapeHtml(firstTheme)}核验</b>
        <span>确认材料中出现的角色、表单字段、状态节点和责任边界。</span>
      </div>
      <div>
        <b>${escapeHtml(modules[0] || "首个场景")}试点</b>
        <span>用真实材料样例验证填报、审批、提醒、归档和查询路径。</span>
      </div>
      <div>
        <b>模块扩展</b>
        <span>扩展到${escapeHtml(modules.join("、") || "已识别业务模块")}。</span>
      </div>
      <div>
        <b>${systems.length ? "系统协同" : "持续治理"}</b>
        <span>${escapeHtml(systems.length ? `围绕 ${systems.join("、")} 明确接口、字段和权限规则。` : `围绕${riskCount}类风险建立校验、提醒和数据质量机制。`)}</span>
      </div>
    </div>
  `;
}

function renderCoverVisual(analysis) {
  const bars = [analysis.pains.length, analysis.scenarios.length, analysis.systems.length, analysis.departments.length].map((value) =>
    Math.min(92, Math.max(26, value * 9)),
  );
  const chips = [...analysis.themes.map((item) => item.name), ...analysis.systems, ...analysis.detectedProcesses.map((item) => item.name)].slice(0, 3);
  return `
    <div class="cover-panel" aria-hidden="true">
      <div class="cover-grid-icon">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="cover-bars">
        ${bars.map((height) => `<i style="height:${height}%"></i>`).join("")}
      </div>
      <div class="cover-chip-row">
        ${(chips.length ? chips : ["材料", "线索", "报告"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderObjectMap(analysis) {
  const objects = chunkArray(buildObjectLabels(analysis).slice(0, 9), 3);
  return `
    <div class="object-map">
      <div class="object-core">
        <strong>统一业务模型</strong>
        <span>${escapeHtml(buildObjectLabels(analysis).slice(0, 4).join(" / ") || "材料 / 线索 / 证据 / 访谈")}</span>
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

function buildObjectLabels(analysis) {
  const structuredLabels = [
    ...analysis.themes.slice(0, 6).map((item) => item.name.replace(/管理$/, "")),
    ...analysis.forms.slice(0, 4),
    ...analysis.systems.slice(0, 4),
  ].filter(Boolean);
  const labels = structuredLabels.length ? structuredLabels : analysis.topTerms.slice(0, 6);
  const unique = [...new Set(labels)].slice(0, 9);
  return unique.length ? unique : ["流程", "角色", "数据", "资料", "问题", "指标"];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function renderProcessVisual(analysis) {
  const stages = analysis.detectedProcesses.some((item) => item.name === "APQP") || analysis.scenarios.some((item) => item.id === "apqp")
    ? ["需求/立项", "计划/团队", "设计/变更", "试制/验证", "量产/交付", "复盘/知识"]
    : analysis.themes.length
      ? ["资料识别", `${analysis.themes[0].name}建模`, `${analysis.themes[0].name}试点`, analysis.themes[1] ? `${analysis.themes[1].name}扩展` : "场景扩展", analysis.systems[0] ? `${analysis.systems[0]}协同` : "数据沉淀", "复盘优化"]
      : analysis.topTerms.length
        ? analysis.topTerms.slice(0, 6)
        : ["材料识别", "需求澄清", "蓝图确认", "试点验证", "资料补齐", "复盘优化"];
  const lanes = analysis.departments.slice(0, 2).map((item) => item.name).concat(analysis.systems[0] || "待确认系统").slice(0, 3);
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
  const scenarioItems = analysis.scenarios.length
    ? analysis.scenarios.slice(0, 6).map((item) => item.title)
    : analysis.functionRows.slice(0, 6).map((row) => row[0]);
  const scenarioNodes = scenarioItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("");

  return `
    <div class="architecture">
      <div class="arch-side">
        <strong>业务入口</strong>
        ${(analysis.departments.length ? analysis.departments.slice(0, 3).map((item) => item.name) : buildObjectLabels(analysis).slice(0, 3)).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="arch-main">
        ${layers}
        <div class="arch-scenarios">${scenarioNodes}</div>
      </div>
      <div class="arch-side">
        <strong>治理能力</strong>
        ${(analysis.pains.length ? analysis.pains.slice(0, 3).map((item) => item.label) : ["证据追溯", "边界确认", "质量校验"]).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
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

function renderFunctionTable(rows, analysis) {
  const decisionRows = analysis.consulting.decisionRows.length ? analysis.consulting.decisionRows : rows.map((row) => [row[0], row[1], row[2]]);
  return `
    <div class="function-table-wrap">
      <table class="function-table">
        <thead>
          <tr>
            <th>功能模块</th>
            <th>咨询判断</th>
            <th>功能说明</th>
            <th>带来的价值</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(([module, desc, value], index) => {
              const decision = decisionRows[index] || [module, desc, value];
              return `
                <tr>
                  <td>${escapeHtml(module)}</td>
                  <td>${escapeHtml(decision[1])}</td>
                  <td>${escapeHtml(desc)}</td>
                  <td>${escapeHtml(decision[2] || value)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLandingQuestions(analysis) {
  return `
    <div class="consulting-panel compact">
      <div class="consulting-lead">
        <b>落地前提</b>
        <span>以下问题建议在蓝图评审会上由客户业务负责人确认，否则后续实施容易出现范围漂移或责任不清。</span>
      </div>
      <div class="question-grid">
        ${analysis.consulting.landingQuestions.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderDashboardVisual(analysis) {
  const painCount = Math.max(analysis.pains.length, 1);
  const systems = Math.max(analysis.systems.length, 1);
  const closed = Math.min(78, 38 + analysis.functionRows.length * 4);
  const focus = analysis.themes[0]?.name || analysis.detectedProcesses[0]?.name || analysis.functionRows[0]?.[0] || "材料线索";
  return `
    <div class="dashboard-visual">
      <div class="mini-chart">
        <strong>${escapeHtml(focus)}信号</strong>
        <div class="bar-chart">
          <span style="height:${Math.min(92, painCount * 9)}%"></span>
          <span style="height:${Math.min(92, systems * 11)}%"></span>
          <span style="height:${closed}%"></span>
          <span style="height:${Math.min(92, analysis.departments.length * 7)}%"></span>
        </div>
      </div>
      <div class="mini-chart">
        <strong>${escapeHtml(focus)}闭环</strong>
        <div class="donut-visual" style="--value:${closed}"></div>
        <span>${closed}% 建议优先结构化</span>
      </div>
      <div class="metric-stack">
        <div><span>系统线索</span><b>${analysis.systems.length}</b></div>
        <div><span>表单线索</span><b>${analysis.forms.length}</b></div>
        <div><span>证据片段</span><b>${analysis.pains.reduce((sum, item) => sum + item.evidence.length, 0)}</b></div>
      </div>
    </div>
  `;
}

function renderEvidenceTrace(analysis) {
  const evidence = analysis.consulting.evidence.length
    ? analysis.consulting.evidence
    : analysis.consulting.priorityBasis.map((item) => ({ title: "分析依据", text: item }));
  return `
    <div class="evidence-trace">
      ${evidence
        .slice(0, 6)
        .map(
          (item) => `
            <div>
              <b>${escapeHtml(item.title)}</b>
              <span>${escapeHtml(item.text)}</span>
            </div>
          `,
        )
        .join("")}
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

function scoreRules(text, rules, minScore, options = {}) {
  const minDistinct = options.minDistinct || 1;
  return rules
    .map((rule) => {
      const score = rule.keys.reduce((sum, key) => sum + countMatches(text, key), 0);
      const distinct = rule.keys.filter((key) => countMatches(text, key) > 0).length;
      return { ...rule, score, distinct };
    })
    .filter((item) => item.score > minScore && item.distinct >= minDistinct)
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
