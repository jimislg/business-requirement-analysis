# 商机管理模块 需求设计方案

> 工作项：LG-7362268621（story）｜优先级：核心需求
> 所属版本：企业 CRM 系统 MVP v1.0（正式版）
> 当前节点：需求设计
> PRD 任务 ID：6

---

## 1. 设计背景

企业 CRM 系统 MVP v1.0 需要一套商机管理模块，帮助销售团队：
- 以**看板视图**直观追踪每个商机所处的销售阶段，通过**拖拽**完成阶段流转；
- 自动记录每次阶段变更，形成可审计的**变更日志**；
- 基于"阶段概率"对商机金额做**加权销售预测**，辅助季度业绩预估。

本模块是 CRM MVP 的核心业务域，后端提供 Opportunity CRUD + 阶段流转 + 变更日志 + 销售预测 API，前端提供看板/列表/详情三个视图。

---

## 2. 核心数据模型

### 2.1 Opportunity（商机）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (uuid) | 商机唯一标识 |
| name | string | 商机名称（必填） |
| customer | string | 关联客户名称（必填） |
| amount | number | 商机金额（元，必填，>0） |
| stage | enum | 当前阶段，见 2.2 |
| owner | string | 负责人 |
| expectedCloseDate | string (ISO date) | 预计成交日期 |
| createdAt | string (ISO datetime) | 创建时间（自动） |
| updatedAt | string (ISO datetime) | 最后更新时间（自动） |

### 2.2 阶段枚举（Stage）

| key | 名称 | 概率 probability |
|---|---|---|
| `lead` | 线索 | 10% |
| `confirmed` | 需求确认 | 30% |
| `proposal` | 方案报价 | 50% |
| `negotiation` | 谈判 | 70% |
| `won` | 成交 | 100% |
| `lost` | 流失 | 0% |

> 看板视图按前 5 列展示（线索 / 需求确认 / 方案报价 / 谈判 / 成交），`lost`（流失）作为终态单独标记，不占据看板列，在列表/详情中以标签呈现。

### 2.3 OpportunityStageLog（阶段变更日志）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (uuid) | 日志唯一标识 |
| opportunityId | string | 关联商机 ID |
| fromStage | enum | 变更前阶段 |
| toStage | enum | 变更后阶段 |
| operator | string | 操作人（前端拖拽时传入） |
| timestamp | string (ISO datetime) | 变更时间（自动） |

每次阶段变更自动追加一条日志，不可删除、不可篡改。

---

## 3. 后端 API 设计

后端基于 Node.js + Express，数据持久化采用 JSON 文件（`server/data.json`），演示级实现，无外部 DB 依赖。

### 3.1 商机 CRUD

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/opportunities` | 商机列表（支持 `?stage=`、`?keyword=` 筛选） |
| GET | `/api/opportunities/:id` | 商机详情 |
| POST | `/api/opportunities` | 新建商机 |
| PUT | `/api/opportunities/:id` | 更新商机（非阶段字段） |
| DELETE | `/api/opportunities/:id` | 删除商机 |

### 3.2 阶段流转

| 方法 | 路径 | 说明 |
|---|---|---|
| PATCH | `/api/opportunities/:id/stage` | 流转阶段，body: `{ "toStage": "negotiation", "operator": "张伟" }` |

逻辑：
1. 校验 `toStage` 属于合法阶段枚举；
2. 更新商机 `stage` 与 `updatedAt`；
3. **自动写入一条 OpportunityStageLog**（fromStage = 原阶段，toStage = 目标阶段）；
4. 返回更新后的商机 + 本次日志记录。

### 3.3 阶段变更日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/opportunities/:id/logs` | 查询某商机的阶段变更历史（按时间倒序） |

### 3.4 销售预测

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/forecast` | 销售预测汇总 |

返回结构：
```json
{
  "totalForecast": 1250000,
  "byStage": [
    { "stage": "lead", "count": 5, "amount": 300000, "forecast": 30000 },
    { "stage": "confirmed", "count": 3, "amount": 500000, "forecast": 150000 }
  ],
  "totalAmount": 1800000,
  "totalCount": 12
}
```

计算公式：`forecast = SUM(amount × probability)`，`probability` 取该商机当前阶段对应的概率（见 2.2）。

---

## 4. 前端设计

### 4.1 页面结构

新增 `opportunities.html` + `opportunities.css` + `opportunities.js`，与现有仓库风格一致（蓝青配色、卡片布局、localStorage 兜底），通过 `index.html` 顶部导航进入。

三个视图通过页内 Tab 切换：

| 视图 | 说明 |
|---|---|
| **看板视图** | 5 列看板（线索/需求确认/方案报价/谈判/成交），每列展示该阶段商机卡片；卡片支持 HTML5 Drag & Drop 拖拽到其他列，松手后调 PATCH 流转 API |
| **列表视图** | 表格展示全部商机，支持按阶段筛选 + 关键词搜索（商机名/客户名） |
| **详情视图** | 点击卡片/行进入详情弹窗：基本信息 + 阶段变更历史时间线 + 关联客户信息 |

### 4.2 拖拽交互流程

1. `dragstart`：记录被拖拽商机的 `id` 与源阶段；
2. `dragover`：目标列阻止默认行为，高亮可放置区域；
3. `drop`：取出 `id`，调 `PATCH /api/opportunities/:id/stage`，成功后**刷新看板 + 变更日志**，失败则回滚卡片位置并提示。

### 4.3 数据访问层

前端统一通过 `api` 对象封装 fetch 调用后端 API；若后端不可达（如纯静态部署场景），自动降级到 localStorage 模拟数据，保证页面可独立演示。

---

## 5. 部署方案

仓库现状为纯前端静态页，无 `package.json`。为满足「`npm run deploy` 部署上线，以部署成功为完成条件」，补全以下基础设施：

- **`package.json`**：声明 `start`（启动 Express 服务）、`deploy`（启动服务 + 健康检查）脚本；
- **`server/index.js`**：Express 应用，托管静态前端文件 + 提供 `/api/*` 后端接口；
- **`npm run deploy`**：启动 Express 服务，轮询 `GET /api/health` 直到返回 200，视为部署成功，进程保持运行。

> 假设说明：仓库此前为纯前端演示站（无后端、无 package.json）。本方案在保留前端演示惯例的基础上，补入轻量 Node 后端 + deploy 脚本，使 `npm run deploy` 可执行并以健康检查通过作为部署成功判据。不引入数据库，数据用 JSON 文件持久化，适合 MVP 演示场景。

---

## 6. 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `package.json` | 新增 | 项目元信息 + scripts（start/deploy） |
| `server/index.js` | 新增 | Express 应用（静态托管 + API） |
| `server/store.js` | 新增 | JSON 文件持久化数据访问层 |
| `server/data.json` | 新增 | 初始演示数据 |
| `opportunities.html` | 新增 | 商机管理页面（看板/列表/详情） |
| `opportunities.css` | 新增 | 商机管理样式 |
| `opportunities.js` | 新增 | 商机管理交互逻辑 + API 封装 |
| `index.html` | 修改 | 顶部导航新增「商机管理」入口 |

---

## 7. 验收标准映射

| 验收标准 | 对应实现 |
|---|---|
| 商机 CRUD 正确 | 后端 CRUD API + 前端新建/编辑/删除 |
| 拖拽流转阶段后日志记录正确 | PATCH stage API 自动写 OpportunityStageLog + 详情页时间线展示 |
| 销售预测金额计算正确（概率加权） | GET /api/forecast 按 SUM(amount×probability) 计算 |
| 看板视图拖拽交互流畅 | HTML5 Drag & Drop + 实时刷新，失败回滚 |

---

## 8. 风险与边界

- **数据持久化**：JSON 文件方案仅适合演示/单机场景，生产环境需替换为数据库（本次不在范围内）。
- **并发**：单进程内存 + 文件读写，无并发锁，适合 MVP 演示。
- **权限**：本次不实现鉴权，`operator` 由前端拖拽时传入，演示用。
