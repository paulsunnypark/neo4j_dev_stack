import { apiClient } from '../client';
import { withApiErrorMapping } from '../errors';
import type {
  EventQueued,
  ListRelationshipsQuery,
  PagedResponse,
  RelationshipEstablishedPayload,
  RelationshipRecord,
  RelationshipRemovedPayload,
} from '../contracts';

export const listRelationships = async (query: ListRelationshipsQuery) => {
  return withApiErrorMapping('relationships', 'listRelationships', async () => {
    const res = await apiClient.get<PagedResponse<RelationshipRecord>>('/relationships', { params: query });
    return res.data;
  });
};

export const createRelationship = async (payload: RelationshipEstablishedPayload) => {
  return withApiErrorMapping('relationships', 'createRelationship', async () => {
    const res = await apiClient.post<EventQueued>('/relationships', payload);
    return res.data;
  });
};

export const removeRelationship = async (payload: RelationshipRemovedPayload) => {
  return withApiErrorMapping('relationships', 'removeRelationship', async () => {
    const res = await apiClient.delete<EventQueued>('/relationships', { data: payload });
    return res.data;
  });
};
