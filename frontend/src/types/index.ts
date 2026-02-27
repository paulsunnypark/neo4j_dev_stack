// Types aligned with Neo4j Entity node properties and backend PagedResponse

export interface Entity {
  id: string;           // Neo4j: e.id
  projectId: string;    // Neo4j: e.projectId
  entityType: string;   // Neo4j: e.entityType
  name: string;
  status: string;
  updatedAt?: string;
  [key: string]: unknown;   // additional flat attributes from Neo4j
}

export interface Relationship {
  source_id: string;
  target_id: string;
  rel_type: string;
  props?: Record<string, unknown>;
}

export interface PagedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
