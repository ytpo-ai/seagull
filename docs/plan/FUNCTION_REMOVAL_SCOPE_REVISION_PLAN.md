# 功能删除执行方案（Scope Revision）

> 目标：项目回归「agent 模拟员工工作配合」的核心定位，删除偏离核心的功能模块。
> 执行方式：本方案为操作手册，命令与修改点均可手动逐条执行。

## 0. 背景与决策结论

项目初期为 agent 模拟员工协作系统，后堆叠了大量外围功能。本次删除已与用户确认：

### 删除范围（最终确认）

| 功能 | 后端 | 前端 |
|---|---|---|
| 研发智能 EI（含项目孵化） | `apps/ei` 整个 + 相关共享 schema + gateway 路由 | `ProjectManagement`/`EngineeringStatistics`/`EngineeringRequirements`/`EngineeringRequirementDetail`/`EngineeringBoard`/`IncubationProjectDetail`/`DataDashboard`/`RdConversation` 页面 + 相关 service |
| 计划编排 | `src/modules/orchestration` 整个 + orchestration-* schema | `Orchestration`/`PlanDetail` + `pages/orchestration/` + `components/orchestration/` + orchestration service/hooks |
| 讨论空间 | `src/modules/discussions` 整个 + discussion-* schema | `Discussions`/`DiscussionDetail` + `pages/discussions/` + `components/discussion/` + discussion service/store |
| Skill 市场 + GitHub Repo | `apps/agents/src/modules/skills/skill-market.*` + `skill-market-platform.schema` + `skill-github-repo.schema` | `SkillMarketPanel`/`SkillGithubRepoPanel` + `skillMarketService` |
| 系统 UI 管理 | 无（纯前端图标浏览器） | `UiManagement` 页面 + 路由 + 菜单 |

### 保留范围（明确不删）

- **scheduler（定时任务）**：用户已确认保留，继续支撑 `meeting-monitor`（会议巡检）与 `memo` 定时聚合。
- **channel（飞书渠道）**：保留不动。其中对 `/api/orchestration/*` 的调用会随编排删除而 404（用户已知晓并接受）。
- 其余：agent 核心 / meeting / message-center / hr / gateway / ws / prompt-registry / usage / api-keys / operation-logs / memo / auth / employees / invitations / messages。

---

## 1. 前置准备

### 1.1 检查工作区

> ⚠️ 当前 `development` 分支存在未提交变更（`AGENTS.md`、`docs/rules/` 等文档重构）。建议**先提交或暂存这些变更**，避免与删除操作混在一起。

```bash
cd /Users/van/Workspace/seagull
git status
git branch --show-current
```

### 1.2 建议新建删除分支（可选）

```bash
cd /Users/van/Workspace/seagull
git checkout -b feature/remove-scope-revision
```

### 1.3 记录当前编译基线（可选，便于对比）

```bash
cd /Users/van/Workspace/seagull/backend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pnpm run build:all 2>&1 | tail -5
```

---

## 2. 阶段一：后端删除（纯文件删除命令）

```bash
cd /Users/van/Workspace/seagull/backend

# 2.1 研发智能 EI 应用
git rm -r apps/ei

# 2.2 计划编排模块
git rm -r src/modules/orchestration

# 2.3 讨论空间模块
git rm -r src/modules/discussions

# 2.4 共享 schema（编排 / 讨论 / EI）
git rm \
  src/shared/schemas/orchestration-plan.schema.ts \
  src/shared/schemas/orchestration-run.schema.ts \
  src/shared/schemas/orchestration-task.schema.ts \
  src/shared/schemas/orchestration-run-task.schema.ts \
  src/shared/schemas/orchestration-plan-session.schema.ts \
  src/shared/schemas/orchestration-schedule.schema.ts \
  src/shared/schemas/discussion-space.schema.ts \
  src/shared/schemas/discussion-message.schema.ts \
  src/shared/schemas/discussion-thread.schema.ts \
  src/shared/schemas/discussion-participant.schema.ts \
  src/shared/schemas/discussion-knowledge-entry.schema.ts \
  src/shared/schemas/ei-project.schema.ts \
  src/shared/schemas/ei-task.schema.ts

# 2.5 Skill 市场 + GitHub Repo
git rm \
  apps/agents/src/modules/skills/skill-market.controller.ts \
  apps/agents/src/modules/skills/skill-market.service.ts \
  apps/agents/src/schemas/skill-market-platform.schema.ts \
  apps/agents/src/schemas/skill-github-repo.schema.ts

# 2.6 EI 相关迁移脚本（历史清理脚本，可选删除）
git rm scripts/migrate/cleanup-removed-requirement-tools.ts
```

> 说明：`src/shared/schemas/schedule.schema.ts` 保留（scheduler + seed 使用）。

---

## 3. 阶段二：后端代码引用清理（需编辑文件）

以下为「删除文件后必须修改的引用」，否则编译失败。按文件逐个处理。

### 3.1 `src/app.module.ts`

删除两处 import：

```ts
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
import { DiscussionModule } from './modules/discussions/discussion.module';
```

删除 `imports` 数组中的两项：

```ts
    DiscussionModule,
    OrchestrationModule,
```

（保留 `SchedulerModule`）

### 3.2 `apps/agents/src/modules/skills/skill.module.ts`

删除以下 import：

```ts
import { SkillMarketPlatform, SkillMarketPlatformSchema } from '@agent/schemas/skill-market-platform.schema';
import { SkillGithubRepo, SkillGithubRepoSchema } from '@agent/schemas/skill-github-repo.schema';
import { SkillMarketService } from './skill-market.service';
import { SkillMarketController } from './skill-market.controller';
```

删除 `forFeature` 数组中的两项：

```ts
      { name: SkillMarketPlatform.name, schema: SkillMarketPlatformSchema },
      { name: SkillGithubRepo.name, schema: SkillGithubRepoSchema },
```

`controllers` 改为：

```ts
  controllers: [SkillController],
  providers: [SkillService, SkillDocLoaderService],
```

### 3.3 `apps/agents/src/modules/action-logs/agent-action-log.module.ts`

删除 import：

```ts
import { OrchestrationPlan, OrchestrationPlanSchema } from '../../../../../src/shared/schemas/orchestration-plan.schema';
```

删除 `forFeature` 中的：

```ts
      { name: OrchestrationPlan.name, schema: OrchestrationPlanSchema },
```

### 3.4 `apps/agents/src/modules/action-logs/agent-action-log.service.ts`

1. 删除 import（约第 18 行）：

```ts
import { OrchestrationPlan, OrchestrationPlanDocument } from '../../../../../src/shared/schemas/orchestration-plan.schema';
```

2. 删除构造函数注入（约第 94-95 行）：

```ts
    @InjectModel(OrchestrationPlan.name)
    private readonly orchestrationPlanModel: Model<OrchestrationPlanDocument>,
```

3. 删除已被禁用（disabled）的死方法 `publishAgentActionCompletedEventIfNeeded` 整段（含其对 `orchestrationPlanModel` 的使用）。

4. （可选，非编译必需）清理 `contextType === 'orchestration'` 相关分支与 `environmentType = 'orchestration_plan'` 赋值，使逻辑更干净。

### 3.5 `apps/agents/src/modules/memos/memo.module.ts`

删除 import：

```ts
import { OrchestrationTask, OrchestrationTaskSchema } from '../../../../../src/shared/schemas/orchestration-task.schema';
```

删除 `forFeature` 中的：

```ts
      { name: OrchestrationTask.name, schema: OrchestrationTaskSchema },
```

### 3.6 `apps/agents/src/modules/memos/evaluation-aggregation.service.ts`

1. 删除 import（第 9 行）：

```ts
import { OrchestrationTask, OrchestrationTaskDocument } from '../../../../../src/shared/schemas/orchestration-task.schema';
```

2. 删除构造函数注入（第 81 行）：

```ts
    @InjectModel(OrchestrationTask.name) private readonly taskModel: Model<OrchestrationTaskDocument>,
```

3. 在 `aggregateEvaluation` 中删除 `getTaskStatistics` 调用（第 92 行的 `this.getTaskStatistics(agentId, start, end),`），并将 `Promise.all` 解构里的 `taskStats` 一并移除，返回/记录处同步去掉 `taskStats`。

4. 删除 `getTaskStatistics` 方法整段（约第 123 行起，含 `taskModel.aggregate` 与 `taskModel.find` 的 `recentTasksData`，直至方法结束）。

5. 删除 sources 字符串中的 `orchestration_tasks`（第 402 行），改为 `[agent.skills, agent_runs, agent_parts]`。

> 注：`TaskStatistics` / `RecentTask` 相关类型定义若仅被该方法使用，可一并删除。

### 3.7 `apps/gateway/src/gateway-proxy.service.ts`

1. 删除字段：

```ts
  private readonly engineeringIntelligenceBaseUrl =
    process.env.ENGINEERING_INTELLIGENCE_SERVICE_URL || 'http://localhost:3004';
```

2. 删除 `resolveTarget` 中的 EI 分支：

```ts
    if (
      originalUrl.startsWith('/api/ei') ||
      originalUrl.startsWith('/api/engineering-intelligence')
    ) {
      return this.engineeringIntelligenceBaseUrl;
    }
```

3. `getSourceService` 返回类型与实现中删除 `'engineering-intelligence'`：

```ts
  private getSourceService(originalUrl: string): 'agents' | 'legacy' | 'life-script' {
    ...
    if (target === this.engineeringIntelligenceBaseUrl) {
      return 'engineering-intelligence';
    }
    ...
  }
```

4. `recordOperationLog` 的 `sourceService` 参数类型同步删除 `'engineering-intelligence'`。

### 3.8 `src/modules/scheduler/scheduler.service.ts`（scheduler 保留，仅清 EI 残留）

删除以下字段与方法：

- 字段：`systemEngineeringStatisticsScheduleName`、`systemDocsHeatScheduleName`
- `systemScheduleNames` 数组中的 `'system-engineering-statistics'` 与 `'system-docs-heat'`
- 方法：`getOrCreateEngineeringStatisticsSchedule`、`triggerSystemEngineeringStatistics`、`getOrCreateDocsHeatSchedule`、`triggerSystemDocsHeat`

### 3.9 `src/modules/scheduler/scheduler.controller.ts`（scheduler 保留，仅清 EI 残留）

删除与 EI 相关的 import（如 `TriggerSystemEngineeringStatisticsDto` 等）及 4 个端点：

- `POST /system/engineering-statistics/trigger`
- `GET /system/engineering-statistics`
- `POST /system/docs-heat/trigger`
- `GET /system/docs-heat`

### 3.10 `scripts/seed/system-schedule.ts`（保留 meeting-monitor / memo）

1. `SystemSeedName` 类型删除：`'engineering-statistics'`、`'docs-heat'`、`'cto-daily-requirement-triage'`。

2. `SYSTEM_SEED_ORDER` 数组删除对应三项。

3. `seedSystemSchedules` 函数体删除 `engineering-statistics` / `docs-heat` / `cto-daily-requirement-triage` 三个分支。

4. 删除辅助函数：`ensureEngineeringStatisticsSchedule`、`ensureDocsHeatSchedule`、`ensureCtoDailyRequirementTriageSchedule`、`buildCtoDailyRequirementTriageInput`。

### 3.11 `scripts/seed/seed-runner.ts`

1. `SeedName` 类型删除 `'docs-heat'`。
2. `ALL_SEEDS` 数组删除 `'docs-heat'`。
3. 删除 `if (seed === 'docs-heat') { ... }` 分支。

### 3.12 构建/路径配置

`nest-cli.json` — 删除 `ei` 配置块：

```json
    "ei": {
      "root": "apps/ei",
      "sourceRoot": "apps/ei/src",
      ...
    },
```

`tsconfig.json` — 删除 path：

```json
      "@ei/*": ["apps/ei/src/*"],
```

`package.json` — 删除脚本：

```json
    "build:ei": "nest build ei",
    "start:ei": "nest start ei --watch",
    "start:prod:ei": "node dist/apps/ei/src/main.js",
```

并修改 `build:all`，删除其中的 `&& pnpm run build:ei`。同时删除 `seed:docs-heat` 脚本。

### 3.13 环境变量与启动脚本

`app/backend/.env.example` — 删除以下变量（EI + PLANNER 编排相关）：

```
ENGINEERING_INTELLIGENCE_PORT=3201
ENGINEERING_INTELLIGENCE_FRONTEND_URL=http://localhost:3000
ENGINEERING_INTELLIGENCE_SERVICE_URL=http://localhost:3201
ENGINEERING_INTELLIGENCE_BODY_LIMIT=2mb
PLANNER_MAX_TASKS=8
PLANNER_MAX_TITLE_LENGTH=120
PLANNER_MAX_DESCRIPTION_LENGTH=1000
PLANNER_MIN_DESCRIPTION_LENGTH=20
PLANNER_REQUIREMENT_DETAIL_MAX_LENGTH=1500
PLANNER_EI_REQUEST_TIMEOUT_MS=5000
PLANNER_AGENT_SELECTION_MODE=verify
PLANNER_SESSION_ISOLATION_MODE=shared
```

> `CHANNEL_FORWARD_EVENT_TYPES` 中可移除 `orchestration.task.completed`（可选，保留无害）。

`app/backend/start.sh` / `app/backend/reload.sh` — 删除 `ei` 服务与 `3004` 端口相关行。

---

## 4. 阶段三：前端删除（纯文件删除命令）

```bash
cd /Users/van/Workspace/seagull/frontend

# 4.1 EI 相关页面
git rm \
  src/pages/ProjectManagement.tsx \
  src/pages/EngineeringStatistics.tsx \
  src/pages/EngineeringRequirements.tsx \
  src/pages/EngineeringRequirementDetail.tsx \
  src/pages/EngineeringBoard.tsx \
  src/pages/IncubationProjectDetail.tsx \
  src/pages/DataDashboard.tsx \
  src/pages/RdConversation.tsx

# 4.2 讨论 / 编排 / UI 管理页面
git rm \
  src/pages/Discussions.tsx \
  src/pages/DiscussionDetail.tsx \
  src/pages/Orchestration.tsx \
  src/pages/PlanDetail.tsx \
  src/pages/UiManagement.tsx

# 4.3 子目录（编排 / 讨论）
git rm -r src/pages/orchestration src/pages/discussions

# 4.4 组件目录
git rm -r src/components/orchestration src/components/discussion

# 4.5 Skill 市场面板组件
git rm src/components/SkillMarketPanel.tsx src/components/SkillGithubRepoPanel.tsx

# 4.6 服务
git rm \
  src/services/engineeringIntelligenceService.ts \
  src/services/incubationProjectService.ts \
  src/services/dataCollectionService.ts \
  src/services/discussionService.ts \
  src/services/orchestrationService.ts \
  src/services/skillMarketService.ts \
  src/services/rdConversationService.ts

# 4.7 store
git rm src/stores/discussionStore.ts

# 4.8 编排相关 hooks
git rm \
  src/hooks/usePlanDetailActions.ts \
  src/hooks/usePlanDetailViewState.ts \
  src/hooks/usePlanMutations.ts \
  src/hooks/usePlanRunHistory.ts \
  src/hooks/usePlanStreaming.ts \
  src/hooks/useReplanMutation.ts \
  src/hooks/useTaskDebugMutations.ts \
  src/hooks/useTaskDrawerState.ts \
  src/hooks/useTaskEditing.ts \
  src/hooks/useTaskMutations.ts
```

> `src/services/schedulerService.ts` 保留（`Scheduler.tsx` 仍使用）。

---

## 5. 阶段四：前端代码引用清理（需编辑文件）

### 5.1 `src/App.tsx`

删除以下 import 与路由：

```ts
import ProjectManagement from './pages/ProjectManagement';
import EngineeringStatistics from './pages/EngineeringStatistics';
import EngineeringRequirements from './pages/EngineeringRequirements';
import EngineeringRequirementDetail from './pages/EngineeringRequirementDetail';
import EngineeringBoard from './pages/EngineeringBoard';
import IncubationProjectDetail from './pages/IncubationProjectDetail';
import DataDashboard from './pages/DataDashboard';
import RdConversation from './pages/RdConversation';
import Orchestration from './pages/Orchestration';
import PlanDetail from './pages/PlanDetail';
import Discussions from './pages/Discussions';
import DiscussionDetail from './pages/DiscussionDetail';
import UiManagement from './pages/UiManagement';
```

删除对应 `<Route>`（`/discussions`、`/discussions/:spaceId`、`/orchestration`、`/orchestration/plans/:id`、`/ui-management`、`/rd-conversation`、`/engineering-intelligence*`、`/ei*` 等）。

### 5.2 `src/components/Layout.tsx`

1. `topLevelNavigation` 删除 `讨论空间` 与 `计划编排` 两项。
2. `groupedNavigation` 删除整个 `研发智能` 分组（项目管理/工程统计/需求管理/需求看板/Opencode）。
3. `系统管理` 分组删除 `UI管理` 项。
4. 删除 `isDiscussionDetailPage` 相关逻辑与未使用的 icon import（`ChatBubbleLeftRightIcon`、`FolderIcon`、`ChartBarIcon`、`ClipboardDocumentListIcon`、`PresentationChartLineIcon`、`CodeBracketIcon`、`SparklesIcon` 等按需清理）。

### 5.3 `src/pages/Skills.tsx`

删除 import：

```ts
import { SkillMarketPlatformPanel } from '../components/SkillMarketPanel';
import { SkillGithubRepoPanel } from '../components/SkillGithubRepoPanel';
```

删除使用处（约第 586 行的 `<SkillGithubRepoPanel />` 及 SkillMarketPanel 相关渲染）。

### 5.4 `src/pages/Agents.tsx`（projectId 过滤）

删除 import 与孵化项目查询：

```ts
import { incubationProjectService, IncubationProject } from '../services/incubationProjectService';
```

删除 `projectIdFilter` 相关 state、`useQuery('agents-incubation-projects')`、传给 `AgentListHeader` 的 `projectIdFilter`/`onProjectIdFilterChange`/`incubationProjects` props，以及 `getInitialFilters` 里的 `projectIdFilter` 解析/持久化逻辑。

### 5.5 `src/components/agents/EditAgentModal.tsx` / `CreateAgentModal.tsx`

删除 import：

```ts
import { incubationProjectService, IncubationProject } from '../../services/incubationProjectService';
```

删除 `projectId` 下拉选择 UI 与 `useQuery('edit-agent-incubation-projects')` / `('create-agent-incubation-projects')`。表单提交的 `projectId` 字段可移除或保留为不传（建议移除）。

### 5.6 `src/components/agents/AgentListHeader.tsx`

若接收了 `projectIdFilter` / `onProjectIdFilterChange` / `incubationProjects` props，删除对应 props 定义与筛选 UI。

### 5.7 `src/pages/Scheduler.tsx`

删除 import：

```ts
import { incubationProjectService, IncubationProject } from '../services/incubationProjectService';
```

删除 `useQuery('scheduler-incubation-projects')` 及相关渲染（约第 126-128、366 行）。

---

## 6. 阶段五：验证

```bash
# 后端
cd /Users/van/Workspace/seagull/backend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pnpm run lint
pnpm run build:all

# 前端
cd /Users/van/Workspace/seagull/frontend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pnpm run build
```

> 若 lint/build 报「找不到模块」错误，说明还有引用未清理，按报错文件补齐阶段二/四的清理。

---

## 7. 数据清理（可选，需谨慎）

删除功能后，MongoDB 中对应 collection 仍保留。确认无误后可手动 drop：

```bash
# 进入 mongo（替换为你实际的连接串）
mongosh "mongodb://admin:goodluck@123@localhost:27017/harbin?authSource=admin"

# 列出候选 collection，确认后逐个 drop
show collections

# 示例（请先核对实际名称，避免误删）
# db.eirequirements.drop()
# db.incubationprojects.drop()
# db.engineeringrepositories.drop()
# db.orchestrationplans.drop()
# db.orchestrationruns.drop()
# db.orchestrationtasks.drop()
# db.discussionspaces.drop()
# db.discussionmessages.drop()
```

> ⚠️ 数据清理为不可逆操作，建议先备份（`app/backend/scripts/maintenance/backup-db.ts`）再执行。

---

## 8. 风险点与注意事项

| 风险 | 说明 | 处理 |
|---|---|---|
| channel 依赖编排接口 | `channel-inbound.service.ts` 调用 `/api/orchestration/*`，编排删除后 404 | 用户已确认「保留不动」，运行期触发会失败 |
| scheduler 保留 | `meeting-monitor`/`memo` 聚合依赖 scheduler 运行时 | 已保留 scheduler，功能不受影响 |
| Agent `projectId` 字段 | 前端通过孵化项目下拉绑定；孵化项目删除后下拉无数据源 | 前端移除下拉（§5.4-5.6），后端 `agent.schema.projectId` 字符串字段保留（无 schema 依赖，不影响编译） |
| EI 系统调度残留 | scheduler 内含 `engineering-statistics`/`docs-heat` 系统调度 | §3.8-3.11 已清理 |
| 共享 schema 交叉引用 | `orchestration-plan` 被 agent-action-log 引用，`orchestration-task` 被 memo 引用 | §3.4 / §3.6 已清理 |

---

## 9. 提交建议

完成删除并通过验证后：

```bash
cd /Users/van/Workspace/seagull
git add -A
git status
git commit -m "refactor(backend,frontend): remove EI/orchestration/discussion/skill-market/ui-management modules"
```
