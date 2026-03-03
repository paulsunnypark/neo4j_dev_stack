import { vi } from 'vitest';
import { apiClient } from '../api/client';

type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Matcher = string | RegExp;

type RouteHandler = {
  method: ApiMethod;
  matcher: Matcher;
  response: unknown | ((url: string) => unknown);
};

const matches = (matcher: Matcher, url: string) => {
  if (typeof matcher === 'string') {
    return matcher === url;
  }
  return matcher.test(url);
};

export const installApiClientMock = (extraRoutes: RouteHandler[] = []) => {
  const defaultRoutes: RouteHandler[] = [
    { method: 'get', matcher: '/projects', response: ['project-a'] },
    { method: 'get', matcher: '/stats', response: { total_nodes: 0, active_nodes: 0, total_relationships: 0 } },
    { method: 'get', matcher: '/outbox/stats', response: { PENDING: 0, DONE: 0, FAILED: 0 } },
    { method: 'get', matcher: '/outbox', response: { items: [] } },
    { method: 'get', matcher: '/entities', response: { items: [], total: 0, page: 1, size: 20, pages: 1 } },
    { method: 'get', matcher: '/relationships', response: { items: [], total: 0, page: 1, size: 50, pages: 1 } },
  ];

  const routes = [...extraRoutes, ...defaultRoutes];

  const resolveResponse = (method: ApiMethod, url: string) => {
    const route = routes.find((item) => item.method === method && matches(item.matcher, url));
    if (!route) {
      return {};
    }
    return typeof route.response === 'function' ? route.response(url) : route.response;
  };

  const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
    return Promise.resolve({ data: resolveResponse('get', url) });
  });

  const postSpy = vi.spyOn(apiClient, 'post').mockImplementation((url: string) => {
    return Promise.resolve({ data: resolveResponse('post', url) });
  });

  const putSpy = vi.spyOn(apiClient, 'put').mockImplementation((url: string) => {
    return Promise.resolve({ data: resolveResponse('put', url) });
  });

  const patchSpy = vi.spyOn(apiClient, 'patch').mockImplementation((url: string) => {
    return Promise.resolve({ data: resolveResponse('patch', url) });
  });

  const deleteSpy = vi.spyOn(apiClient, 'delete').mockImplementation((url: string) => {
    return Promise.resolve({ data: resolveResponse('delete', url) });
  });

  return {
    restore: () => {
      getSpy.mockRestore();
      postSpy.mockRestore();
      putSpy.mockRestore();
      patchSpy.mockRestore();
      deleteSpy.mockRestore();
    },
  };
};
