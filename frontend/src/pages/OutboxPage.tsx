import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppContext } from '../stores/useAppContext';
import type { OutboxEvent, OutboxStatsResponse } from '../api/contracts';
import { getOutboxStats, listOutbox } from '../api/services/opsService';

export default function OutboxPage() {
  const { projectId, refreshInterval } = useAppContext();
  const statsQuery = useQuery({
    queryKey: ['outbox', 'stats', projectId],
    queryFn: () => getOutboxStats({ project_id: projectId }),
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  const eventsQuery = useQuery({
    queryKey: ['outbox', 'events', projectId],
    queryFn: () => listOutbox({ project_id: projectId, limit: 20 }),
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  const stats = (statsQuery.data as OutboxStatsResponse | undefined) ?? { PENDING: 0, DONE: 0, FAILED: 0 };
  const events = useMemo(() => ((eventsQuery.data?.items || []) as OutboxEvent[]), [eventsQuery.data?.items]);
  const isLoading = statsQuery.isLoading || eventsQuery.isLoading;
  const hasError = statsQuery.isError || eventsQuery.isError;

  return (
    <div className="p-6 h-full flex flex-col overflow-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-white tracking-wide">Event Pipeline Monitoring</h2>
        <button onClick={() => { void statsQuery.refetch(); void eventsQuery.refetch(); }} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-md text-sm transition-colors border border-white/10">Refresh</button>
      </div>
      {hasError && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200" role="status">
          Failed to refresh Outbox data. Showing last available snapshot.
        </div>
      )}
      
      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
           <div className="absolute -right-4 -top-4 w-20 h-20 bg-warning/10 rounded-full blur-xl"></div>
           <div className="flex items-center gap-3 mb-2">
             <Clock className="w-5 h-5 text-warning" />
             <h3 className="font-medium text-textMuted tracking-wide">Pending (In Queue)</h3>
           </div>
           <p className="text-4xl font-bold text-white">{isLoading ? '...' : stats.PENDING || 0}</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
           <div className="absolute -right-4 -top-4 w-20 h-20 bg-accent/10 rounded-full blur-xl"></div>
           <div className="flex items-center gap-3 mb-2">
             <CheckCircle className="w-5 h-5 text-accent" />
             <h3 className="font-medium text-textMuted tracking-wide">Successfully Processed</h3>
           </div>
           <p className="text-4xl font-bold text-white">{isLoading ? '...' : stats.DONE || 0}</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
           <div className="absolute -right-4 -top-4 w-20 h-20 bg-danger/10 rounded-full blur-xl"></div>
           <div className="flex items-center gap-3 mb-2">
             <AlertTriangle className="w-5 h-5 text-danger" />
             <h3 className="font-medium text-textMuted tracking-wide">Failed Events</h3>
           </div>
           <p className={`text-4xl font-bold ${(stats.FAILED ?? 0) > 0 ? 'text-danger' : 'text-white'}`}>{isLoading ? '...' : stats.FAILED || 0}</p>
         </div>
      </div>

      {/* Event List */}
      <div className="flex-1 glass-panel rounded-xl border border-white/10 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h3 className="font-semibold text-white">Recent Outbox Events Payload</h3>
            <span className="text-xs text-textMuted">Showing last 20 events</span>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-textMuted uppercase bg-black/40 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">Time</th>
                <th className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">Type</th>
                <th className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">Actor</th>
                <th className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">Payload / Error</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && !isLoading && <tr><td colSpan={5} className="px-6 py-8 text-center text-textMuted">No events found.</td></tr>}
              {events.map((ev, i) => (
                <tr key={ev.id || i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-xs font-mono text-textMuted">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 font-medium text-white">
                    {ev.event_type}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      ev.status === 'DONE' ? 'bg-accent/20 text-accent' : 
                      ev.status === 'FAILED' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                    }`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-textMuted">
                    {ev.actor}
                  </td>
                  <td className="px-6 py-3 max-w-xs truncate" title={ev.error_message || JSON.stringify(ev.payload)}>
                    {ev.status === 'FAILED' ? (
                      <span className="text-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {ev.error_message}</span>
                    ) : (
                      <span className="text-textMuted font-mono text-xs">{JSON.stringify(ev.payload)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
