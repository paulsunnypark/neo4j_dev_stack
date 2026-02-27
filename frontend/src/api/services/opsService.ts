import { apiClient } from '../client';
import { withApiErrorMapping } from '../errors';
import type {
  GraphStatsQuery,
  ListOutboxQuery,
  OutboxEvent,
  OutboxStatsQuery,
  OutboxStatsResponse,
  StatsResponse,
} from '../contracts';

export const getStats = async (query: GraphStatsQuery) => {
  return withApiErrorMapping('ops', 'getStats', async () => {
    const res = await apiClient.get<StatsResponse>('/stats', { params: query });
    return res.data;
  });
};

export const getOutboxStats = async (query: OutboxStatsQuery) => {
  return withApiErrorMapping('ops', 'getOutboxStats', async () => {
    const res = await apiClient.get<OutboxStatsResponse>('/outbox/stats', { params: query });
    return res.data;
  });
};

export const listOutbox = async (query: ListOutboxQuery) => {
  return withApiErrorMapping('ops', 'listOutbox', async () => {
    const res = await apiClient.get<{ items: OutboxEvent[] }>('/outbox', { params: query });
    return res.data;
  });
};
