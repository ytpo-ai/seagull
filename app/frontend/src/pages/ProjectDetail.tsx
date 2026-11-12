import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import projectService from '../services/projectService';
import { agentService } from '../services/agentService';
import type { ProjectApiKey, CreateApiKeyResponse, Agent } from '../types';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
  ClipboardIcon,
  MapPinIcon,
  UserGroupIcon,
  CheckIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../services/authService';

type TabType = 'info' | 'agents' | 'api-keys';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');

  const { data: project, isLoading } = useQuery(
    ['project', id],
    () => projectService.getProject(id!),
    { enabled: !!id },
  );

  const { data: apiKeys } = useQuery(
    ['project-api-keys', id],
    () => projectService.getApiKeys(id!),
    { enabled: !!id && activeTab === 'api-keys' },
  );

  const { data: projectAgents, refetch: refetchAgents } = useQuery(
    ['project-agents', id],
    () => projectService.getProjectAgents(id!),
    { enabled: !!id && activeTab === 'agents' },
  );

  const { data: allAgents, isLoading: loadingAgents } = useQuery(
    ['available-agents-for-project', id],
    () => agentService.getAgents(),
    { enabled: showAddAgent, refetchOnMount: true, staleTime: 0 },
  );

  const deleteMutation = useMutation(
    (pid: string) => projectService.deleteProject(pid),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('projects');
        navigate('/projects');
      },
    },
  );

  const createKeyMutation = useMutation(
    () => projectService.createApiKey(id!, { name: newKeyName }),
    {
      onSuccess: (data: CreateApiKeyResponse) => {
        queryClient.invalidateQueries(['project-api-keys', id]);
        setNewKeyRaw(data.rawKey);
      },
    },
  );

  const revokeKeyMutation = useMutation(
    (keyId: string) => projectService.revokeApiKey(id!, keyId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-api-keys', id]);
      },
    },
  );

  const assignAgentMutation = useMutation(
    (agentId: string) => projectService.assignAgent(id!, agentId),
    {
      onSuccess: () => {
        refetchAgents();
        setShowAddAgent(false);
        setAgentSearch('');
      },
    },
  );

  const removeAgentMutation = useMutation(
    (agentId: string) => projectService.removeAgent(id!, agentId),
    {
      onSuccess: () => {
        refetchAgents();
      },
    },
  );

  const handleCopyKey = () => {
    if (newKeyRaw) {
      navigator.clipboard.writeText(newKeyRaw);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleCloseCreateKey = () => {
    setShowCreateKey(false);
    setNewKeyName('');
    setNewKeyRaw(null);
    setCopyFeedback(false);
  };

  const handleExternalLinkClick = async () => {
    if (!project?.externalLink) return;
    try {
      const result = await authService.generateGenericRedirectToken();
      const baseUrl = project.externalLink.replace(/\/$/, '');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const targetUrl = `${baseUrl}${separator}token=${encodeURIComponent(result.redirectToken)}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // silently fail
    }
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除项目 "${project?.name}" 吗？此操作不可撤销。`)) {
      deleteMutation.mutate(id!);
    }
  };

  const availableAgents = allAgents?.filter(
    (a: Agent) => !projectAgents?.some((pa: Agent) => pa.id === a.id),
  ).filter((a: Agent) =>
    !agentSearch || a.name.toLowerCase().includes(agentSearch.toLowerCase()),
  ) || [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">项目不存在</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4 mr-1" />
        返回项目列表
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(`/projects/${id}/edit`)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              编辑
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              删除
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
          {project.localDirectory && (
            <div className="flex items-center space-x-1">
              <MapPinIcon className="w-4 h-4" />
              <span>{project.localDirectory}</span>
            </div>
          )}
          {project.externalLink && (
            <button
              onClick={handleExternalLinkClick}
              className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 hover:underline"
              title={`打开外部链接: ${project.externalLink}`}
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              <span>外部链接</span>
            </button>
          )}
          <div className="flex items-center space-x-1">
            <UserGroupIcon className="w-4 h-4" />
            <span>{project.adminIds?.length || 0} 位管理员</span>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            project.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {project.isActive ? '活跃' : '已禁用'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
        {([
          ['info', '基本信息'],
          ['agents', `Agents (${projectAgents?.length || 0})`],
          ['api-keys', `API Keys (${apiKeys?.length || 0})`],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">项目信息</h3>
          <dl className="grid grid-cols-1 gap-4">
            <div>
              <dt className="text-sm text-gray-500">项目名称</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">{project.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">描述</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">{project.description || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">本地目录</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1 font-mono">{project.localDirectory || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">外部链接</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">
                {project.externalLink ? (
                  <button
                    onClick={handleExternalLinkClick}
                    className="text-primary-600 hover:text-primary-700 hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    {project.externalLink}
                  </button>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">管理员 ID 列表</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">
                {project.adminIds?.length > 0 ? project.adminIds.join(', ') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">创建时间</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">
                {project.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">更新时间</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-1">
                {project.updatedAt ? new Date(project.updatedAt).toLocaleString('zh-CN') : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Tab: Agents */}
      {activeTab === 'agents' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">项目 Agents</h3>
            <button
              onClick={() => setShowAddAgent(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              添加 Agent
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            将 Agent 分配到项目后，Agent 将归属于此项目空间。移除后 Agent 变为全局 Agent。
          </p>

          {(!projectAgents || projectAgents.length === 0) ? (
            <div className="text-center py-8">
              <CommandLineIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-500">暂无 Agent 分配到该项目</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectAgents.map((agent: Agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                      <CommandLineIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{agent.name}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                          agent.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {agent.isActive ? '活跃' : '禁用'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {agent.roleId} · {agent.model?.name || '—'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`确定要从项目中移除 "${agent.name}" 吗？`)) {
                        removeAgentMutation.mutate(agent.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="移除"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: API Keys */}
      {activeTab === 'api-keys' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h3>
            <button
              onClick={() => setShowCreateKey(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              生成 Key
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            API Key 用于外部系统访问此项目的 Agent 能力。Key 仅在创建时显示一次，请妥善保管。
          </p>

          {(!apiKeys || apiKeys.length === 0) ? (
            <div className="text-center py-8">
              <KeyIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-500">暂无 API Key</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key: ProjectApiKey) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    key.isActive
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                      : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <KeyIcon className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{key.name}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                        key.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {key.isActive ? '有效' : '已撤销'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{key.keyPrefix}</code>
                      {key.agentIds?.length > 0 && (
                        <span>{key.agentIds.length} 个 Agent 可访问</span>
                      )}
                      {key.lastUsedAt && (
                        <span>最近使用: {new Date(key.lastUsedAt).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                  {key.isActive && (
                    <button
                      onClick={() => {
                        if (window.confirm('确定要撤销此 API Key 吗？撤销后不可恢复。')) {
                          revokeKeyMutation.mutate(key.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-2"
                      title="撤销"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">添加 Agent 到项目</h3>

            <div className="mb-4">
              <input
                type="text"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="搜索 Agent..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {loadingAgents ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : availableAgents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {agentSearch ? '未找到匹配的 Agent' : '没有可添加的 Agent'}
                </p>
              ) : (
                availableAgents.map((agent: Agent) => (
                  <button
                    key={agent.id}
                    onClick={() => assignAgentMutation.mutate(agent.id)}
                    disabled={assignAgentMutation.isLoading}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      agent.isActive
                        ? 'bg-primary-100 dark:bg-primary-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <CommandLineIcon className={`w-4 h-4 ${
                        agent.isActive
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{agent.name}</p>
                        {!agent.isActive && (
                          <span className="text-xs text-gray-400">(已禁用)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{agent.roleId}</p>
                    </div>
                    <PlusIcon className="w-4 h-4 text-gray-400" />
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowAddAgent(false);
                  setAgentSearch('');
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {newKeyRaw ? 'API Key 已生成' : '生成新的 API Key'}
            </h3>

            {!newKeyRaw ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Key 名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="例如：外部系统A"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCloseCreateKey}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => createKeyMutation.mutate()}
                    disabled={!newKeyName.trim() || createKeyMutation.isLoading}
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {createKeyMutation.isLoading ? '生成中...' : '生成'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ 此 Key 仅显示一次，请立即复制保存。关闭后无法再次查看。
                  </p>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  <code className="flex-1 bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 dark:text-white break-all">
                    {newKeyRaw}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="复制"
                  >
                    {copyFeedback ? (
                      <CheckIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <ClipboardIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCloseCreateKey}
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    完成
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;