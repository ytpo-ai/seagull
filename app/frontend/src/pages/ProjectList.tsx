import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import projectService from '../services/projectService';
import type { Project, CreateProjectDto } from '../types';
import {
  FolderIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  MapPinIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectDto>({ name: '' });
  const [createError, setCreateError] = useState('');

  const { data: projects, isLoading, error } = useQuery(
    'projects',
    () => projectService.getProjects(),
  );

  const deleteMutation = useMutation(projectService.deleteProject, {
    onSuccess: () => {
      queryClient.invalidateQueries('projects');
    },
  });

  const createMutation = useMutation(projectService.createProject, {
    onSuccess: () => {
      queryClient.invalidateQueries('projects');
      setShowCreateModal(false);
      setNewProject({ name: '' });
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err?.response?.data?.message || '创建失败');
    },
  });

  const handleCreate = () => {
    if (!newProject.name.trim()) {
      setCreateError('项目名称不能为空');
      return;
    }
    createMutation.mutate(newProject);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`确定要删除项目 "${name}" 吗？此操作不可撤销。`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">加载失败</p>
          <p className="text-sm mt-1">{(error as any)?.message || '未知错误'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">项目管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理项目空间，分配 Agent 和 API Key</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          新建项目
        </button>
      </div>

      {/* Project Cards */}
      {(!projects || projects.length === 0) ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FolderIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">暂无项目，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: Project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{project.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}/edit`);
                    }}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="编辑"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id, project.name);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="删除"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500">
                {project.localDirectory && (
                  <div className="flex items-center space-x-1">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[120px]">{project.localDirectory}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <UserGroupIcon className="w-3.5 h-3.5" />
                  <span>{project.adminIds?.length || 0} 位管理员</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  project.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {project.isActive ? '活跃' : '已禁用'}
                </span>
                <span className="text-xs text-gray-400">
                  {project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">新建项目</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="输入项目名称"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  项目描述
                </label>
                <input
                  type="text"
                  value={newProject.description || ''}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="简要描述项目"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  本地目录
                </label>
                <input
                  type="text"
                  value={newProject.localDirectory || ''}
                  onChange={(e) => setNewProject({ ...newProject, localDirectory: e.target.value })}
                  placeholder="项目在本地的目录路径"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-500">{createError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProject({ name: '' });
                  setCreateError('');
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isLoading}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;