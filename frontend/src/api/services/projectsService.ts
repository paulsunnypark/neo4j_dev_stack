import { apiClient } from '../client';
import { withApiErrorMapping } from '../errors';

export const listProjects = async () => {
  return withApiErrorMapping('projects', 'listProjects', async () => {
    const res = await apiClient.get<string[]>('/projects');
    return res.data;
  });
};
