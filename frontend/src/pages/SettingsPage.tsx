import { useAppContext } from '../stores/useAppContext';
import { Settings, RefreshCw, Layers, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { projectId, setProjectId, refreshInterval, setRefreshInterval } = useAppContext();

  const handleSave = () => {
    // Other settings (like API key) could be saved to localStorage right here
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="p-6 h-full flex flex-col relative overflow-hidden text-gray-200">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Settings className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-white tracking-wide">Platform Settings</h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl space-y-6">
          
          {/* Main Card */}
          <div className="glass-panel p-6 rounded-xl border border-white/10 shadow-lg space-y-8">
            
            {/* Project ID */}
            <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                 <Layers className="w-4 h-4 text-accent" />
                 Default Topology / Project ID
              </label>
              <p className="text-xs text-textMuted mb-2">Configure which Neo4j Project ID is loaded by default. You can also temporarily override this in the top navigation bar.</p>
              <input 
                type="text" 
                value={projectId} 
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full max-w-sm bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

            {/* Refresh Interval */}
            <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                 <RefreshCw className="w-4 h-4 text-accent" />
                 Auto-Refresh Interval
              </label>
              <p className="text-xs text-textMuted mb-2">Configure how often the background dashboards (Overview, Outbox) fetch live data.</p>
              <select 
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-full max-w-sm bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary"
              >
                 <option value={0}>Disabled</option>
                 <option value={2000}>2 Seconds</option>
                 <option value={5000}>5 Seconds (Default)</option>
                 <option value={10000}>10 Seconds</option>
                 <option value={30000}>30 Seconds</option>
              </select>
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                 <Key className="w-4 h-4 text-accent" />
                 API Key (Client Override)
              </label>
              <p className="text-xs text-textMuted mb-2">Optional: Provide a custom Neo:Stack API key if your proxy requires it. Leaving it blank uses the built-in static token.</p>
              <input 
                type="password" 
                placeholder="••••••••••••••"
                className="w-full max-w-sm bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

          </div>

          <div className="flex justify-end pt-4">
             <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(109,40,217,0.4)]">
                Save Preferences
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}
