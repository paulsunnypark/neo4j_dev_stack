import { apiClient } from '../client';
import { withApiErrorMapping } from '../errors';
import type {
  AttributeChangedPayload,
  EntityCreatedPayload,
  EntityRecord,
  EventQueued,
  ListEntitiesQuery,
  PagedResponse,
  StatusChangedPayload,
} from '../contracts';

export const listEntities = async (query: ListEntitiesQuery) => {
  return withApiErrorMapping('entities', 'listEntities', async () => {
    const res = await apiClient.get<PagedResponse<EntityRecord>>('/entities', { params: query });
    return res.data;
  });
};

export const createEntity = async (payload: EntityCreatedPayload) => {
  return withApiErrorMapping('entities', 'createEntity', async () => {
    const res = await apiClient.post<EventQueued>('/entities', payload);
    return res.data;
  });
};

export const deleteEntity = async (
  entityId: string,
  params: { project_id: string; entity_type: string }
) => {
  return withApiErrorMapping('entities', 'deleteEntity', async () => {
    const res = await apiClient.delete<EventQueued>(`/entities/${entityId}`, { params });
    return res.data;
  });
};

export const updateEntityAttribute = async (entityId: string, payload: AttributeChangedPayload) => {
  return withApiErrorMapping('entities', 'updateEntityAttribute', async () => {
    const res = await apiClient.post<EventQueued>(`/entities/${entityId}/attributes`, payload);
    return res.data;
  });
};

export const updateEntityStatus = async (entityId: string, payload: StatusChangedPayload) => {
  return withApiErrorMapping('entities', 'updateEntityStatus', async () => {
    const res = await apiClient.post<EventQueued>(`/entities/${entityId}/status`, payload);
    return res.data;
  });
};
