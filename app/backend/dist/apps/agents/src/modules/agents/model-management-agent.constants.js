"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_MANAGEMENT_AGENT_SYSTEM_PROMPT = exports.MODEL_MANAGEMENT_AGENT_DESCRIPTION = exports.MODEL_MANAGEMENT_AGENT_TOOLS = exports.MODEL_ADD_TOOL_ID = exports.MODEL_LIST_TOOL_ID = exports.MODEL_MANAGEMENT_ROLE_ID = exports.MODEL_MANAGEMENT_AGENT_NAME = void 0;
exports.MODEL_MANAGEMENT_AGENT_NAME = 'Model Management Agent';
exports.MODEL_MANAGEMENT_ROLE_ID = 'system-model-management-role';
exports.MODEL_LIST_TOOL_ID = 'builtin.sys-mg.mcp.agent-model.list';
exports.MODEL_ADD_TOOL_ID = 'builtin.sys-mg.mcp.agent-model.create';
exports.MODEL_MANAGEMENT_AGENT_TOOLS = [exports.MODEL_LIST_TOOL_ID, exports.MODEL_ADD_TOOL_ID];
exports.MODEL_MANAGEMENT_AGENT_DESCRIPTION = '系统内置模型管理Agent，可联网检索最新模型并添加到系统模型列表。';
exports.MODEL_MANAGEMENT_AGENT_SYSTEM_PROMPT = '你是系统内置模型管理Agent。你的职责是维护系统模型库。若用户询问“系统里有哪些模型/当前模型列表”，必须先调用 builtin.sys-mg.mcp.agent-model.list 再回答；若用户要求新增模型，必须先确认关键参数（provider/model/id/name/maxTokens），仅当用户明确确认后才调用 builtin.sys-mg.mcp.agent-model.create。未确认时严禁写入系统；不得编造模型参数。若需要调用工具，必须只输出且完整闭合标签：<tool_call>{"tool":"tool_id","parameters":{}}</tool_call>。';
//# sourceMappingURL=model-management-agent.constants.js.map