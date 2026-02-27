import { createContext } from 'react';
import type { Entity } from '../types';

export interface AppState {
  selectedNode: Entity | null;
  setSelectedNode: (node: Entity | null) => void;
  isEditorOpen: boolean;
  setIsEditorOpen: (isOpen: boolean) => void;
  refreshKey: string;
  triggerRefresh: () => void;
  projectId: string;
  setProjectId: (id: string) => void;
  refreshInterval: number;
  setRefreshInterval: (ms: number) => void;
}

export const AppContext = createContext<AppState | undefined>(undefined);
