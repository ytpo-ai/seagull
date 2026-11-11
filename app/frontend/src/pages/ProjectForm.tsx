import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import projectService from '../services/projectService';
import type { UpdateProjectDto } from '../types';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState<UpdateProjectDto>({
    name: '',
    description: '',
    localDirectory: '',
    adminIds: [],
    isActive: true,
  });
  const [adminInput, setAdminInput] = useState('');
  const [error, setError] = useState('');

  const { data: project, isLoading: loadingProject } = useQuery(
    ['project', id],
    () => projectService.getProject(id!),
    { enabled: isEdit },
  );

  useEffect(() => {
    if (project && isEdit) {
      setForm({
        name: project.name,
        description: project.description || '',
        localDirectory: project.localDirectory || '',
        adminIds: project.adminIds || [],
        isActive: project.isActive,
      });
    }
  }, [project, isEdit]);

  const saveMutation = useMutation(
    (data: UpdateProjectDto) =>
      isEdit ? projectService.updateProject(id!, data) : projectService.createProject(data as any),
    {
      onSuccess: (result) => {
        queryClient.invalidateQueries('projects');
        if (isEdit) {
          queryClient.invalidateQueries(['project', id]);
        }
        navigate(isEdit ? `/projects/${(result as any).id || id}` : `/projects/${(result as any).id}`);
      },
      onError: (err: any) => {
        setError(err?.response?.data?.message || '保存失败');
      },
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      setError('项目名称不能为空');
      return;
    }
    saveMutation.mutate(form);
  };

  const addAdmin = () => {
    if (adminInput.trim() && !form.adminIds?.includes(adminInput.trim())) {
      setForm({ ...form, adminIds: [...(form.adminIds || []), adminInput.trim()] });
      setAdminInput('');
    }
  };

  const removeAdmin = (adminId: string) => {
    setForm({ ...form, adminIds: form.adminIds?.filter((a) => a !== adminId) || [] });
  };

  if (isEdit && loadingProject) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4 mr-1" />
        {isEdit ? '返回项目详情' : '返回项目列表'}
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {isEdit ? '编辑项目' : '新建项目'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="输入项目名称"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              项目描述
            </label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简要描述项目"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Local Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              本地目录
            </label>
            <input
              type="text"
              value={form.localDirectory || ''}
              onChange={(e) => setForm({ ...form, localDirectory: e.target.value })}
              placeholder="例如 /Users/van/Projects/my-app"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Admin IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              管理员
            </label>
            <p className="text-xs text-gray-500 mb-2">输入管理员 Employee ID，按回车添加</p>
            <div className="flex space-x-2">
              <input
                type="text"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAdmin();
                  }
                }}
                placeholder="Employee ID"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addAdmin}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                添加
              </button>
            </div>
            {form.adminIds && form.adminIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.adminIds.map((adminId) => (
                  <span
                    key={adminId}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {adminId}
                    <button
                      type="button"
                      onClick={() => removeAdmin(adminId)}
                      className="ml-1.5 text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active */}
          {isEdit && (
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">启用状态</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
              <span className="text-sm text-gray-500">{form.isActive ? '启用' : '禁用'}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saveMutation.isLoading}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectForm;