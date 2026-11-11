# Plan: 项目管理功能重新定义

## 背景

经过功能删减后，原有的工程智能（EI）模块（包括孵化项目管理）已被移除。`projectId` 字段仍残留在 Agent、Meeting、Scheduler 等 Schema 中，但缺乏对应的 Project 管理实体和 CRUD 能力。

本次计划重新定义"项目"实体，作为 Agent 的组织/隔离单元。

## 目标

1. 重新定义 Project 实体（项目名、本地目录绑定、API Key 管理、管理员分配）
2. 引入 ProjectApiKey 机制（外部系统鉴权访问项目 Agent）
3. 实现基于 EmployeeRole tier 的分权可见性（系统管理员全局可见，普通用户仅见已分配项目）
4. 支持项目管理 Agent 分配和移除

## 执行步骤

### 步骤 1：新增 Project Schema
- [x] 创建 `app/backend/src/shared/schemas/project.schema.ts`
- 字段：name, description, localDirectory, adminIds, isActive

### 步骤 2：新增 ProjectApiKey Schema
- [x] 创建 `app/backend/src/shared/schemas/project-api-key.schema.ts`
- 字段：projectId, name, keyHash, keyPrefix, agentIds, isActive, lastUsedAt

### 步骤 3：新增 Projects 模块（后端）
- [x] 创建 `src/modules/projects/` 目录结构
- [x] DTO: create-project, update-project, create-api-key, assign-agent
- [x] Service: project CRUD + API Key 管理 + Agent 分配
- [x] Controller: REST API 端点
- [x] Module: 注册依赖

### 步骤 4：实现项目权限控制
- [x] UserContext 装饰器（提取 Gateway 转发的用户上下文）
- [x] 权限逻辑内置于 Service（isSystemAdmin, getAccessibleProjectIds, assertProjectAccess）
- leadership tier → 全局可见
- operations/temporary tier → 仅见 adminIds 包含自己的项目

### 步骤 5：更新 Agent 模块
- [x] Agent 批量查询（按项目查询 Agent 列表）
- [x] Agent 分配接口调用 Agent Service 设置 projectId
- [x] Agent 移除接口调用 Agent Service 清除 projectId
- [x] 前端项目详情页新增 Agents 标签（添加/移除/展示）

### 步骤 6：注册模块
- [x] 在 `src/app.module.ts` 中注册 ProjectsModule

### 步骤 7：前端页面
- [x] ProjectList 页面（`/projects`）
- [x] ProjectDetail 页面（`/projects/:id`）
- [x] ProjectForm 页面（创建/编辑）
- [x] 前端服务层 `projectService.ts`

### 步骤 8：导航更新
- [x] Layout.tsx 侧边栏新增"项目管理"入口（顶部导航栏）

### 步骤 9：文档与构建验证
- [x] 后端 TypeScript 编译验证通过
- [x] 前端 TypeScript 编译验证通过
- [x] Project API Key 集成到网关认证

### 步骤 10：Project API Key 网关认证集成 + 废弃 INTERNAL_CONTEXT_SECRET
- [x] 扩展 `GatewayUserContext` 支持 Project API Key 模式
- [x] 网关注册 `ProjectApiKey` Schema
- [x] `GatewayAuthGuard` 新增 `authenticateByProjectApiKey` 认证路径
- [x] 移除 `authenticateByInternalSignature`（废弃 INTERNAL_CONTEXT_SECRET 外部认证）
- [x] 网关代理转发 `x-project-api-key-context` 头到下游服务
- [x] 网关单元测试更新 + 新增 Project API Key 测试用例
- [x] 生成 `docs/api/PROJECT_API_KEY.md` 接入文档

## 影响点

| 层级 | 影响 |
|------|------|
| **数据库** | 新增 2 个 Collection：`projects`、`project_api_keys` |
| **后端** | 新增 `src/modules/projects/` 模块；Agent 模块小幅改动 |
| **前端** | 新增 3 个页面 + 服务层 |
| **权限** | 首次引入基于 EmployeeRole tier 的授权逻辑 |
| **已有数据** | 现有 Agent 的 `projectId` 字段保持不变，需手动关联到新 Project |

## 风险与依赖

1. 现有 Agent 的 `projectId` 可能是旧 EI 系统的残留数据，新 Project 上线后需要数据迁移/清理
2. 权限体系从零搭建，当前系统无 RBAC 授权层
3. API Key 鉴权后续需要在 Gateway 层增加 ProjectApiKey 验证逻辑

## 完成标准

- Project CRUD 完整可用
- ProjectApiKey 生成/管理/撤销可用
- Agent 可按项目分配和过滤
- 权限分权验证通过（系统管理员 vs 普通用户）
- 前端页面完整可交互
- 构建验证通过

---

## § Requirement 拆解

| ID | Requirement | 状态 |
|----|-------------|------|
| REQ-PM-01 | Project Schema 定义 | ✅ |
| REQ-PM-02 | ProjectApiKey Schema 定义 | ✅ |
| REQ-PM-03 | Projects 后端模块（CRUD + API Key + Agent 分配） | ✅ |
| REQ-PM-04 | 项目权限控制（UserContext 装饰器 + 权限服务） | ✅ |
| REQ-PM-05 | Agent 模块联动（项目分配/移除/查询） | ✅ |
| REQ-PM-06 | 前端页面（列表/详情/表单 + 服务层） | ✅ |
| REQ-PM-07 | 导航与构建验证 + Gateway 集成 | ✅ |