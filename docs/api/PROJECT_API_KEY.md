# Project API Key 接入指南

## 概述

Project API Key 是外部系统访问项目 Agent 能力的认证凭证。每个 Key 绑定到一个项目空间，并可指定可访问的 Agent 列表。

**不需要配置 `INTERNAL_CONTEXT_SECRET`**，只需在 HTTP 请求头中携带 `Authorization: Bearer sk-proj-xxx` 即可。

---

## 1. 创建 Project API Key

### 1.1 通过 Web UI 创建

1. 登录系统 → 侧边栏「项目管理」
2. 选择目标项目（或新建项目）
3. 进入项目详情 → 「API Keys」标签
4. 点击「生成 Key」
5. 输入 Key 名称（如"CI/CD Pipeline"、"外部系统A"）
6. **立即复制保存** Key 明文 — 关闭弹窗后不可再次查看

### 1.2 通过 API 创建（管理员用）

```bash
# 先登录获取 JWT token
TOKEN=$(curl -s -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"xxx"}' | jq -r '.data.token')

# 创建 Project API Key
curl -X POST http://localhost:3100/api/projects/{projectId}/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "agentIds": ["agent-uuid-1", "agent-uuid-2"]
  }'
```

**响应**：
```json
{
  "apiKey": {
    "id": "60f1a2b3c4d5e6f7a8b9c0d1",
    "projectId": "project-uuid",
    "name": "CI/CD Pipeline",
    "keyPrefix": "sk-proj-a1b2c3d4...",
    "agentIds": ["agent-uuid-1", "agent-uuid-2"],
    "isActive": true
  },
  "rawKey": "sk-proj-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2"
}
```

> ⚠️ `rawKey` 仅在创建响应中返回一次，**请立即保存**。

### 1.3 `agentIds` 说明

| `agentIds` 值 | 效果 |
|---------------|------|
| `["agent-1", "agent-2"]` | 只能访问指定的 Agent |
| `[]` (空数组) | 可访问项目中所有 Agent |

---

## 2. 使用 Project API Key 调用 API

### 2.1 认证方式

在所有请求中携带 HTTP 头：

```
Authorization: Bearer sk-proj-xxxx...
```

### 2.2 执行 Agent 任务

```bash
# 同步执行
curl -X POST http://localhost:3100/api/agents/{agentId}/execute \
  -H "Authorization: Bearer sk-proj-xxxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "task": {
      "title": "代码审查",
      "description": "审查最近的 PR",
      "type": "code_review",
      "priority": "medium",
      "assignedAgents": [],
      "teamId": "",
      "messages": [
        {"role": "user", "content": "请审查 src/modules/auth/ 目录下的最新改动"}
      ]
    }
  }'
```

### 2.3 查询项目 Agent 列表

```bash
curl http://localhost:3100/api/projects/{projectId}/agents \
  -H "Authorization: Bearer sk-proj-xxxx..."
```

### 2.4 查询单个 Agent 信息

```bash
curl http://localhost:3100/api/agents/{agentId} \
  -H "Authorization: Bearer sk-proj-xxxx..."
```

### 2.5 工具调用

```bash
curl -X POST http://localhost:3100/api/tools/{toolId}/execute \
  -H "Authorization: Bearer sk-proj-xxxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-uuid",
    "parameters": {"key": "value"}
  }'
```

---

## 3. API 端点参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | GET | 获取 Agents 列表 |
| `/api/agents/{id}` | GET | 获取 Agent 详情 |
| `/api/agents/{id}/execute` | POST | 执行 Agent 任务 |
| `/api/agents/{id}/test` | POST | 测试 Agent 连接 |
| `/api/tools/{id}/execute` | POST | 执行工具调用 |
| `/api/tools/executions/history` | GET | 查询工具执行历史 |
| `/api/projects/{id}/agents` | GET | 获取项目 Agent 列表 |

---

## 4. 管理 Project API Key

### 4.1 查看 Key 列表

```bash
curl http://localhost:3100/api/projects/{projectId}/api-keys \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

### 4.2 撤销 Key（立即失效）

```bash
curl -X DELETE http://localhost:3100/api/projects/{projectId}/api-keys/{keyId} \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

> 或在 Web UI 中项目详情 → API Keys → 点击 Key 旁的删除按钮。

---

## 5. 认证流程

```
外部系统
  │
  │  Authorization: Bearer sk-proj-xxx...
  ▼
Gateway (3100)
  │
  ├── sk-proj- 前缀? → SHA256 哈希查找 project_api_keys 表
  │   ├── 匹配 & isActive=true → 验证通过
  │   │   └── 注入 projectId + allowedAgentIds 上下文
  │   └── 不匹配/已撤销 → HTTP 401
  │
  └── 代理转发到 Agents / Legacy 服务
```

---

## 6. 安全建议

1. **Key 即密码**：`sk-proj-xxx` 等同于密码，不要提交到代码仓库
2. **最小权限**：创建 Key 时只授予必要的 Agent 访问权限
3. **定期轮换**：定期撤销旧 Key 并创建新 Key
4. **环境变量**：将 Key 存储在环境变量中，不要在代码中硬编码
   ```bash
   export PROJECT_API_KEY="sk-proj-xxx..."
   curl -H "Authorization: Bearer $PROJECT_API_KEY" ...
   ```
5. **监控使用**：可在 Web UI 查看 Key 的「最近使用」时间，发现异常及时撤销

---

## 7. 错误码

| 状态码 | 含义 | 处理 |
|--------|------|------|
| `401 Unauthorized` | Key 无效或已撤销 | 检查 Key 是否正确，是否在 UI 中已被撤销 |
| `403 Forbidden` | Key 无权访问该 Agent | 确认该 Agent 是否在此 Key 的 `agentIds` 范围内 |
| `404 Not Found` | Agent/Tool 不存在 | 检查 ID 是否正确 |

---

## 8. 示例：Python SDK 封装

```python
import os
import requests

class ProjectAgentClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3100"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def execute_agent(self, agent_id: str, prompt: str, **kwargs) -> dict:
        payload = {
            "task": {
                "title": kwargs.get("title", "Task"),
                "description": prompt,
                "type": kwargs.get("type", "general"),
                "priority": kwargs.get("priority", "medium"),
                "assignedAgents": [],
                "teamId": "",
                "messages": [{"role": "user", "content": prompt}],
            }
        }
        resp = self.session.post(
            f"{self.base_url}/api/agents/{agent_id}/execute",
            json=payload,
            timeout=kwargs.get("timeout", 120),
        )
        resp.raise_for_status()
        return resp.json()

    def list_agents(self) -> list:
        resp = self.session.get(f"{self.base_url}/api/agents")
        resp.raise_for_status()
        return resp.json()

# 使用
client = ProjectAgentClient(api_key=os.environ["PROJECT_API_KEY"])
agents = client.list_agents()
result = client.execute_agent("agent-uuid", "请分析这段代码...")
```

---

## 9. 示例：Node.js / TypeScript

```typescript
const PROJECT_API_KEY = process.env.PROJECT_API_KEY!;
const BASE_URL = "http://localhost:3100";

async function executeAgent(agentId: string, prompt: string) {
  const res = await fetch(`${BASE_URL}/api/agents/${agentId}/execute`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PROJECT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: {
        title: "Task",
        description: prompt,
        type: "general",
        priority: "medium",
        assignedAgents: [],
        teamId: "",
        messages: [{ role: "user", content: prompt }],
      },
    }),
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

---

## 10. 变更历史

| 日期 | 变更 |
|------|------|
| 2026-11-11 | 初始版本：Project API Key 替代 `INTERNAL_CONTEXT_SECRET` 作为外部认证方式 |