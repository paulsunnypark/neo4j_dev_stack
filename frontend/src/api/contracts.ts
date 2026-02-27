import type { components, operations } from './schema';

export type EntityCreatedPayload = components['schemas']['EntityCreatedPayload'];
export type AttributeChangedPayload = components['schemas']['AttributeChangedPayload'];
export type StatusChangedPayload = components['schemas']['StatusChangedPayload'];
export type RelationshipEstablishedPayload = components['schemas']['RelationshipEstablishedPayload'];
export type RelationshipRemovedPayload = components['schemas']['RelationshipRemovedPayload'];
export type EventQueued = components['schemas']['EventQueued'];

export type ListEntitiesQuery = operations['list_entities_entities_get']['parameters']['query'];
export type ListRelationshipsQuery = operations['list_relationships_relationships_get']['parameters']['query'];
export type GraphStatsQuery = operations['graph_stats_stats_get']['parameters']['query'];
export type OutboxStatsQuery = operations['outbox_stats_outbox_stats_get']['parameters']['query'];
export type ListOutboxQuery = operations['list_outbox_outbox_get']['parameters']['query'];

export interface EntityRecord {
  id: string;
  projectId: string;
  entityType: string;
  name?: string;
  status?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface RelationshipRecord {
  source_id: string;
  target_id: string;
  rel_type: string;
  props?: Record<string, unknown>;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface StatsResponse {
  total_nodes: number;
  active_nodes: number;
  total_relationships: number;
}

export interface OutboxStatsResponse {
  PENDING?: number;
  DONE?: number;
  FAILED?: number;
}

export interface OutboxEvent {
  id: string;
  event_id: number;
  status: string;
  created_at: string;
  processed_at?: string | null;
  error_message?: string | null;
  event_type: string;
  actor: string;
  payload: unknown;
}
