import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../stores/useAppContext';
import type { OutboxStatsResponse, StatsResponse } from '../api/contracts';
import { getOutboxStats, getStats } from '../api/services/opsService';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { projectId, refreshInterval } = useAppContext();
  const statsQuery = useQuery({
    queryKey: ['overview', 'stats', projectId],
    queryFn: () => getStats({ project_id: projectId }),
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  const outboxQuery = useQuery({
    queryKey: ['overview', 'outbox-stats', projectId],
    queryFn: () => getOutboxStats({ project_id: projectId }),
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  const stats = (statsQuery.data as StatsResponse | undefined) ?? { total_nodes: 0, active_nodes: 0, total_relationships: 0 };
  const outbox = (outboxQuery.data as OutboxStatsResponse | undefined) ?? { PENDING: 0, DONE: 0, FAILED: 0 };
  const isLoading = statsQuery.isLoading || outboxQuery.isLoading;
  const hasError = statsQuery.isError || outboxQuery.isError;

  const activeRatio = useMemo(
    () => (stats.total_nodes > 0 ? Math.round((stats.active_nodes / stats.total_nodes) * 100) : 0),
    [stats.active_nodes, stats.total_nodes]
  );
  const pendingCount = outbox.PENDING || 0;

  return (
    <div className="p-6 h-full flex flex-col overflow-auto">
      <h2 className="text-2xl font-bold text-white mb-6">System Overview</h2>
      {hasError && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200" role="status">
          Failed to load one or more dashboard metrics. Showing last known values.
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI Cards */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-primary/20 rounded-lg"><Users className="w-5 h-5 text-primary" /></div>
             <h3 className="font-medium text-textMuted text-sm tracking-wide">Total Entities</h3>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight">{isLoading ? '...' : stats.total_nodes}</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-accent/20 rounded-lg"><Activity className="w-5 h-5 text-accent" /></div>
             <h3 className="font-medium text-textMuted text-sm tracking-wide">Online Ratio</h3>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight">{isLoading ? '...' : `${activeRatio}%`}</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-blue-500/20 rounded-lg"><CheckCircle className="w-5 h-5 text-blue-400" /></div>
             <h3 className="font-medium text-textMuted text-sm tracking-wide">Relationships</h3>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight">{isLoading ? '...' : stats.total_relationships}</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-danger/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-danger/20 rounded-lg"><AlertTriangle className="w-5 h-5 text-danger" /></div>
             <h3 className="font-medium text-textMuted text-sm tracking-wide">Pending Events</h3>
          </div>
          <p className={`text-4xl font-bold tracking-tight ${pendingCount > 0 ? 'text-danger' : 'text-white'}`}>{isLoading ? '...' : pendingCount}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
         <div className="glass-panel rounded-xl border border-white/10 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Event Queue Status (Outbox)</h3>
            <div className="flex-1 flex flex-col space-y-4 justify-center">
               <div className="flex justify-between items-center bg-black/30 p-4 rounded-lg border border-white/5">
                  <span className="text-textMuted">Pending Processing</span>
                  <span className="text-xl font-bold text-warning">{outbox.PENDING || 0}</span>
               </div>
               <div className="flex justify-between items-center bg-black/30 p-4 rounded-lg border border-white/5">
                  <span className="text-textMuted">Successfully Processed</span>
                  <span className="text-xl font-bold text-accent">{outbox.DONE || 0}</span>
               </div>
               <div className="flex justify-between items-center bg-black/30 p-4 rounded-lg border border-white/5">
                  <span className="text-textMuted">Failed Events</span>
                  <span className="text-xl font-bold text-danger">{outbox.FAILED || 0}</span>
               </div>
            </div>
         </div>
         <div className="glass-panel rounded-xl border border-white/10 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => navigate('/topology')} className="bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl text-left transition-colors cursor-pointer">
                  <h4 className="text-white font-medium mb-1">Topology Explorer</h4>
                  <p className="text-xs text-textMuted">Visualize the graph network</p>
               </button>
               <button onClick={() => navigate('/entities')} className="bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl text-left transition-colors cursor-pointer">
                  <h4 className="text-white font-medium mb-1">Manage Entities</h4>
                  <p className="text-xs text-textMuted">Add or modify nodes</p>
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
