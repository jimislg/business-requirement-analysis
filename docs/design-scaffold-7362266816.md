# 项目脚手架与基础设施搭建 需求设计方案

> 工作项：LG-7362266816（story）｜优先级：紧急需求（P0）
> 所属版本：企业 CRM 系统 MVP v1.0（正式版）
> 当前节点：需求设计
> PRD 任务 ID：1

---

## 1. 设计背景

企业 CRM 系统 MVP v1.0 的所有业务模块（客户管理、跟进记录、商机管理、合同回款等）都依赖统一的工程骨架。当前仓库为纯静态多页演示站（原生 HTML/JS/CSS + Express + JSON 文件存储），无构建链、无类型系统、无真实数据库，无法支撑后续模块的规模化开发。

本任务一次性搭好地基，后续所有需求在此骨架上增量开发，不再重复决策技术栈与规范：

- **Monorepo**：`frontend/` + `backend/` 双工作区，根目录统一管理；
- **前端**：Vite + React 18 + TypeScript + Semi UI + React Router；
- **后端**：Node.js 20 + Express + TypeScript + Prisma ORM；
- **数据库**：PostgreSQL，10 张核心表 schema（User / Team / Customer / Contact / FollowUp / Opportunity / OpportunityStageLog / Contract / Payment / AuditLog），通过 Prisma migration 建表，seed 脚本写入演示数据；
- **工程规范**：ESLint + Prettier + 共享 tsconfig，`npm run lint` 全绿。

**范围边界**：本任务只交付骨架与基础设施，不实现任何业务页面与业务 API；现有根目录静态演示页与 `server/`（JSON 文件版商机 API）全部保留不动，由后续任务逐步迁移下线。

---

## 2. 总体架构：Monorepo 结构

### 2.1 目录结构（目标态）

```
business-requirement-analysis/
├── package.json               # 根：npm workspaces + 聚合脚本（start/deploy 保持现状不动）
├── package-lock.json
├── tsconfig.base.json         # 共享 TS 严格模式基线，两端 extends
├── .eslintrc.cjs              # ESLint 统一配置（TS + React 分区）
├── .eslintignore
├── .prettierrc                # Prettier 统一格式
├── .editorconfig
├── docker-compose.yml         # 本地一键启动 PostgreSQL 15（可选，非部署依赖）
├── frontend/                  # 前端工作区：Vite + React 18 + TS + Semi UI
├── backend/                   # 后端工作区：Express + TS + Prisma
├── server/                    # 旧演示服务（保留，deploy 链路继续使用）
├── docs/                      # 设计文档（本文档）
├── index.html ... *.js *.css  # 旧静态演示页（保留不动）
└── vendor/                    # 旧前端第三方依赖（保留不动）
```

### 2.2 关键决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 工作区管理 | npm workspaces（`"workspaces": ["frontend", "backend"]`） | 沙箱环境只有 npm（11.x），原生支持 workspaces，无需引入 pnpm/turbo；MVP 规模无多包发布诉求 |
| 旧代码处置 | 旧静态页 + `server/` 原地保留，不迁移不删除 | 本任务「只加不减」：旧演示功能与 `npm run deploy` 链路（`server/index.js` + `server/deploy.js` + 健康检查）保持 100% 可用；下线旧代码属于后续业务任务 |
| 根 package.json | 增加 workspaces 与 `dev:frontend` / `dev:backend` / `lint` / `format` / `typecheck` / `build` 聚合脚本；**`start` / `deploy` 脚本与依赖保持现状** | 部署以 `npm run deploy` 成功为准（现有链路已验证可用），新骨架不引入部署风险；待后端具备托管能力后再切换 deploy 指向 |
| Node 版本 | 后端目标 Node.js 20（`engines.node >= 20`） | 与需求约束一致；沙箱当前 Node 24 可兼容运行 |

---

## 3. 前端设计（frontend/）

### 3.1 技术选型

| 依赖 | 版本约束 | 用途 |
|---|---|---|
| react / react-dom | ^18.3 | UI 框架 |
| typescript | ^5.4 | 类型系统 |
| vite / @vitejs/plugin-react | ^5 / ^4 | 构建与开发服务器 |
| @douyinfe/semi-ui | ^2.60 | 组件库（表格/表单/布局/反馈） |
| react-router-dom | ^6.24 | 路由 |

### 3.2 工程结构

```
frontend/
├── package.json
├── tsconfig.json              # extends ../tsconfig.base.json；lib: DOM/ES2022；jsx: react-jsx
├── vite.config.ts             # server.proxy: /api → http://localhost:4000；build.outDir: dist
├── index.html
└── src/
    ├── main.tsx               # 入口：ReactDOM.createRoot + <App/>
    ├── App.tsx                # Router 装配 + Semi UI LocaleProvider(zh_CN)
    ├── layouts/MainLayout.tsx # Semi Layout：Sider 导航 + Header + Content
    ├── pages/                 # 占位页（本任务只出骨架）：
    │   ├── Dashboard.tsx      #   / 工作台
    │   ├── Customers.tsx      #   /customers 客户管理（占位）
    │   ├── Opportunities.tsx  #   /opportunities 商机管理（占位）
    │   ├── FollowUps.tsx      #   /follow-ups 跟进记录（占位）
    │   ├── Contracts.tsx      #   /contracts 合同回款（占位）
    │   └── Settings.tsx       #   /settings 系统设置（占位）
    ├── api/client.ts          # fetch 封装：统一前缀 /api、JSON 序列化、错误抛出
    └── styles/global.css      # 全局样式变量（沿用现有蓝青配色体系）
```

### 3.3 关键设计

- **路由骨架**：React Router v6 声明式路由，占位页统一用 Semi UI `<Empty>` + 模块说明文案，后续任务逐个替换为真实实现；
- **API 客户端**：原生 fetch 封装（不引入 axios，减少依赖），统一错误结构 `{ error: string }` 与后端约定一致；开发态通过 Vite proxy 转发 `/api`，生产态由后端同源托管；
- **健康检查页**：工作台占位页调用 `GET /api/health`（新后端），展示后端连通状态，作为前后端链路贯通的直观验收点；
- **启动方式**：`npm run dev -w frontend`（Vite 默认 5173 端口）；构建 `npm run build -w frontend` 产物 `frontend/dist/`。

---

## 4. 后端设计（backend/）

### 4.1 技术选型

| 依赖 | 版本约束 | 用途 |
|---|---|---|
| express | ^4.21 | HTTP 框架（与旧 server 保持同代，生态稳定） |
| typescript / tsx | ^5.4 / ^4 | 类型系统 + 开发态直跑 TS（tsx watch） |
| @prisma/client / prisma | ^5.x | ORM 与迁移 CLI |
| dotenv | ^16 | 读取 .env 中 DATABASE_URL |

### 4.2 工程结构

```
backend/
├── package.json               # scripts: dev(tsx watch)/build(tsc)/start/migrate/db:push/seed
├── tsconfig.json              # extends ../tsconfig.base.json；module: commonjs；outDir: dist
├── .env.example               # DATABASE_URL="postgresql://crm:crm@localhost:5432/crm"
├── .env                       # 本地实际值（.gitignore，不入库）
├── prisma/
│   ├── schema.prisma          # 第 5 章数据模型
│   ├── migrations/            # prisma migrate dev 产出（提交入库）
│   └── seed.ts                # 演示数据
└── src/
    ├── index.ts               # 入口：读取 PORT（默认 4000），app.listen
    ├── app.ts                 # Express 装配：json 解析 → /api 路由 → 404 → 统一错误处理
    ├── routes/health.ts       # GET /api/health：{ status, db: prisma.$queryRaw 探活, timestamp }
    ├── middleware/errorHandler.ts  # 统一 JSON 错误响应 { error: string }
    └── lib/prisma.ts          # PrismaClient 单例（global 复用，避免 dev 热重载连接泄漏）
```

### 4.3 关键设计

- **启动不依赖数据库**：`/api/health` 内部 try/catch 探测 Prisma 连接，DB 不可达时返回 `{ status: "ok", db: false }` 而非挂掉——保证「前后端项目可独立启动」在任何环境（含无 PostgreSQL 的沙箱）都可验收，DB 验收项单列（见第 8 章）；
- **本任务只交付 `GET /api/health`**，业务路由（customers/opportunities/...）由后续需求按模块实现，目录已预留；
- **不接旧 API**：旧 `server/`（3000 端口）与新后端（4000 端口）并行运行、互不影响，避免抢端口；
- **编译产物**：`tsc` 输出 `dist/`，`npm run start -w backend` 跑编译产物，作为「无编译错误」的机器判据。

---

## 5. 数据库 Schema 设计（Prisma）

数据库：PostgreSQL 15。金额一律 `Decimal(18,2)`（禁止 Float，避免精度误差）；主键 `cuid`；时间戳全部 `DateTime` + Prisma 默认值；所有外键关系显式声明并配置级联策略。

### 5.1 实体关系总览

```
Team 1─N User                    （团队成员）
Team 1─N Customer                （客户归属团队）
User 1─N Customer                （客户负责人 owner）
Customer 1─N Contact             （一个客户多个联系人，其一为主联系人）
Customer 1─N Opportunity         （客户下的商机）
Customer 1─N FollowUp            （客户跟进记录）
Opportunity 1─N OpportunityStageLog（阶段变更日志，只追加不删除）
Opportunity 1─1 Contract         （商机成交后生成合同，可空）
Contract 1─N Payment             （合同分期回款）
User 1─N FollowUp / AuditLog     （操作人）
AuditLog                         （独立多态审计，entityType+entityId）
```

### 5.2 模型明细

**User（用户）**：`id`、`email`（unique）、`name`、`passwordHash`、`role`（enum：`ADMIN`/`MANAGER`/`SALES`，默认 SALES）、`teamId?`、`isActive`、`createdAt`、`updatedAt`

**Team（团队）**：`id`、`name`（unique）、`description?`、`createdAt`、`updatedAt`

**Customer（客户）**：`id`、`name`、`industry?`、`source?`（渠道来源）、`phone?`、`email?`、`address?`、`remark?`、`ownerId?`→User、`teamId?`→Team、`createdAt`、`updatedAt`；索引：`@@index([ownerId])`、`@@index([teamId])`

**Contact（联系人）**：`id`、`customerId`→Customer（onDelete: Cascade）、`name`、`position?`、`phone?`、`email?`、`isPrimary`（默认 false）、`remark?`、时间戳；索引：`@@index([customerId])`

**FollowUp（跟进记录）**：`id`、`customerId`→Customer（Cascade）、`opportunityId?`→Opportunity（SetNull，跟进可挂商机）、`userId`→User（SetNull）、`type`（enum：`PHONE`/`MEETING`/`EMAIL`/`VISIT`/`OTHER`）、`content`、`occurredAt`、`nextFollowUpAt?`、`createdAt`；索引：`@@index([customerId, occurredAt])`

**Opportunity（商机）**：`id`、`name`、`customerId`→Customer（Restrict，有商机不允许直接删客户）、`ownerId`→User（SetNull）、`amount Decimal(18,2)`、`stage`（enum：`LEAD`/`CONFIRMED`/`PROPOSAL`/`NEGOTIATION`/`WON`/`LOST`，默认 LEAD，与旧 `server/store.js` 六阶段一一对应）、`expectedCloseDate?`、`closedAt?`、`remark?`、时间戳；索引：`@@index([stage])`、`@@index([customerId])`

> 阶段赢率（lead 10% → won 100%）沿用旧实现映射表，仅作查询期计算，不落库冗余字段。

**OpportunityStageLog（阶段变更日志）**：`id`、`opportunityId`→Opportunity（Cascade）、`fromStage`、`toStage`（同 OpportunityStage 枚举）、`operatorId?`→User（SetNull）、`remark?`、`createdAt`；索引：`@@index([opportunityId, createdAt])`。应用层只允许追加，不提供修改/删除接口，保证可审计。

**Contract（合同）**：`id`、`contractNo`（unique）、`customerId`→Customer、`opportunityId?`→Opportunity（unique，SetNull）、`amount Decimal(18,2)`、`signedAt?`、`startDate?`、`endDate?`、`status`（enum：`DRAFT`/`EXECUTING`/`COMPLETED`/`TERMINATED`，默认 DRAFT）、`ownerId?`→User、`remark?`、时间戳

**Payment（回款）**：`id`、`contractId`→Contract（Cascade）、`amount Decimal(18,2)`、`planDate?`、`paidAt?`、`method?`（enum：`BANK_TRANSFER`/`CASH`/`WECHAT`/`ALIPAY`/`OTHER`）、`status`（enum：`PLANNED`/`RECEIVED`/`OVERDUE`/`CANCELLED`，默认 PLANNED）、`remark?`、时间戳；索引：`@@index([contractId])`

**AuditLog（审计日志）**：`id`、`entityType`（如 "Customer"/"Opportunity"）、`entityId`、`action`（enum：`CREATE`/`UPDATE`/`DELETE`/`STAGE_CHANGE`）、`operatorId?`→User（SetNull）、`payload Json?`（变更前后快照）、`createdAt`；索引：`@@index([entityType, entityId])`。本任务只建表，写入逻辑由后续需求统一在服务层埋点。

---

## 6. Migration 与 Seed 设计

### 6.1 PostgreSQL 供给方式

`docker-compose.yml` 提供本地开发数据库（非部署依赖）：

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm
      POSTGRES_DB: crm
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

连接串经 `backend/.env` 的 `DATABASE_URL` 注入；`.env` 进 `.gitignore`，`.env.example` 入库。无 Docker 的环境可指向任一可达 PostgreSQL 实例，切换零成本（只改连接串）。

### 6.2 Migration

- 初始迁移：`npx prisma migrate dev --name init`，产出 `prisma/migrations/…_init/` 并提交入库，保证任何环境 `prisma migrate deploy` 可复现建表；
- 后续每个需求的 schema 变更走增量 migration（`migrate dev --name <模块>`），禁止 `db push` 进正式流程（仅本地原型期使用）。

### 6.3 Seed（prisma/seed.ts）

幂等设计（upsert），内容与业务模块对齐：

- 2 个团队（华东销售组 / 华北销售组）、4 个用户（含 1 名 ADMIN）；
- 5 个客户（不同行业/来源）、每客户 1–2 个联系人（其一为主联系人）；
- 若干跟进记录（覆盖不同 type）；
- 6 个商机覆盖全部六个阶段 + 对应阶段变更日志链；
- 1 份成交合同 + 2 笔回款（1 笔 RECEIVED、1 笔 PLANNED）。

`package.json` 配置 `"prisma": { "seed": "tsx prisma/seed.ts" }`，命令 `npm run seed -w backend`。

---

## 7. 代码规范工具链

| 工具 | 配置 | 说明 |
|---|---|---|
| TypeScript | 根 `tsconfig.base.json`：`strict: true`、`noUncheckedIndexedAccess`、`esModuleInterop`、`skipLibCheck`；frontend（DOM lib、react-jsx）与 backend（commonjs、Node types）分别 extends | 严格模式一次到位 |
| ESLint | 根 `.eslintrc.cjs`：`@typescript-eslint`（recommended + strict-ish）+ `eslint-plugin-react-hooks`（frontend 分区）；`eslint-config-prettier` 收尾关闭格式类规则 | `npm run lint`（根聚合两工作区）作为验收命令，**0 error**（warning 不阻断） |
| Prettier | 根 `.prettierrc`：printWidth 100、singleQuote、semi、trailingComma all | `npm run format` 一键格式化 |
| EditorConfig | 根 `.editorconfig`：UTF-8 / LF / 2 空格 | 编辑器层统一 |

根聚合脚本（新增，不覆盖旧脚本）：`lint`（`eslint frontend/src backend/src`）、`typecheck`（两工作区 `tsc --noEmit`）、`format`、`build`（前端 build + 后端 tsc）、`dev:frontend` / `dev:backend`。

---

## 8. 验收标准映射

| 验收标准 | 实现路径 | 验证方式 |
|---|---|---|
| 前后端项目可独立启动无编译错误 | frontend：Vite dev server（5173）；backend：`tsx watch` / `tsc` 产物启动（4000），启动不依赖 DB | `npm run dev -w frontend`、`npm run dev -w backend` 均正常监听；`npm run typecheck` 0 error；后端启动日志无异常 |
| Prisma migration 成功执行 | `prisma migrate dev --name init` 产出迁移文件入库 | 提供可达 PostgreSQL 后 `npx prisma migrate dev` 成功退出，`_prisma_migrations` 表有记录 |
| 数据库表结构创建完成 | 第 5 章 schema 落库 | `npx prisma db pull` 反向比对 / psql `\dt` 列出全部 10 张表与枚举、索引 |
| ESLint 无 error | 根 `.eslintrc.cjs` + 聚合脚本 | `npm run lint` 退出码 0，输出 0 error |
| （交付门禁）`npm run deploy` 部署成功 | 根 `start`/`deploy` 脚本保持现状（旧 server 链路） | `npm run deploy` 启动服务，`GET /api/health` 轮询至 200 |

---

## 9. 文件变更清单

| 文件/目录 | 操作 | 说明 |
|---|---|---|
| `package.json` / `package-lock.json` | 修改 | 增加 workspaces 与聚合脚本；`start`/`deploy`/依赖不动 |
| `tsconfig.base.json` / `.eslintrc.cjs` / `.eslintignore` / `.prettierrc` / `.editorconfig` | 新增 | 根级共享规范 |
| `docker-compose.yml` | 新增 | 本地 PostgreSQL 15（可选使用） |
| `frontend/**`（package.json、tsconfig、vite.config、index.html、src/ 全部） | 新增 | React 18 脚手架 + 路由骨架 + 占位页 + API client |
| `backend/**`（package.json、tsconfig、.env.example、prisma/schema.prisma、prisma/seed.ts、src/**） | 新增 | Express + TS 脚手架 + /api/health + Prisma 全套 |
| `backend/prisma/migrations/**` | 新增 | init 迁移文件 |
| `.gitignore` | 修改 | 追加 `backend/.env`、`backend/dist`、`frontend/dist`、`node_modules` |
| `docs/design-scaffold-7362266816.md` | 新增 | 本设计文档 |

**明确不改**：根目录旧静态页、`vendor/`、`server/`（含 data.json、deploy.js）——保证旧演示与部署链路零回归。

---

## 10. 风险与边界

- **PostgreSQL 可用性**：当前沙箱无 Docker、无本地 PG。「migration 成功执行 / 表结构创建完成」两项验收需要可达的 PostgreSQL 实例（docker compose 起、远端实例、或沙箱内安装 PG 均可，仅需改 `DATABASE_URL`）。前端启动、后端启动、lint、typecheck 四项不依赖 DB，任何环境可验收。此为**环境前置条件**而非设计缺口，实施任务开工前需确认 DB 供给方式；
- **Node 版本差异**：后端 engines 声明 Node 20，沙箱实际 Node 24（兼容性良好，Prisma/Express 均支持），如遇 Prisma 引擎二进制不匹配则锁 `engines` 补丁版本解决；
- **部署连续性**：deploy 仍走旧 server 链路，新骨架完全不触碰；待后续需求后端具备业务能力后，再单独提「部署切换」任务，避免本任务引入部署风险；
- **范围控制**：登录鉴权（passwordHash 字段已预留，认证逻辑后续任务实现）、AuditLog 写入埋点、旧演示页下线，均不在本任务范围；
- **收益边界**：本任务完成后，后续每个业务需求只需：`schema.prisma` 增量迁移 + backend 加路由 + frontend 换占位页为真实页面，开发链路标准化。
