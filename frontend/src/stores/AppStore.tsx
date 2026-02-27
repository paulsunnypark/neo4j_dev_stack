import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppContext } from './AppContext';
import type { Entity } from '../types';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(new Date().toISOString());
  const [projectId, setProjectId] = useState<string>(localStorage.getItem('neo_stacker_projectId') || 'project-a');
  const [refreshInterval, setRefreshInterval] = useState<number>(Number(localStorage.getItem('neo_stacker_refresh')) || 5000);

  const handleSetProjectId = (id: string) => {
    setProjectId(id);
    localStorage.setItem('neo_stacker_projectId', id);
  };

  const handleSetRefreshInterval = (ms: number) => {
    setRefreshInterval(ms);
    localStorage.setItem('neo_stacker_refresh', String(ms));
  };

  const triggerRefresh = () => {
    setRefreshKey(new Date().toISOString());
  };

  return (
    <AppContext.Provider
      value={{
        selectedNode,
        setSelectedNode,
        isEditorOpen,
        setIsEditorOpen,
        refreshKey,
        triggerRefresh,
        projectId,
        setProjectId: handleSetProjectId,
        refreshInterval,
        setRefreshInterval: handleSetRefreshInterval,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
