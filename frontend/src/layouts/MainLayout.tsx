import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Layers, Settings, Database, Server, X } from 'lucide-react';
import { useAppContext } from '../stores/useAppContext';
import { listProjects } from '../api/services/projectsService';
import SettingsPage from '../pages/SettingsPage';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { projectId, setProjectId } = useAppContext();
  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!projectsData.includes(projectId) && projectId === 'project-a') {
      return;
    }

    if (!projectsData.includes(projectId) && projectsData.length > 0) {
      setProjectId(projectsData[0]);
    }
  }, [projectId, projectsData, setProjectId]);

  const projects = Array.from(new Set([
    ...projectsData,
    ...(projectId === 'project-a' ? ['project-a'] : []),
  ]));

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-3 py-2 rounded-md z-[120]">
        Skip to main content
      </a>
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300 ease-in-out glass-panel flex flex-col z-20`}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/10 shrink-0">
          <Activity className="w-8 h-8 text-primary animate-pulse-slow" />
          {isSidebarOpen && (
            <span className="ml-3 font-bold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              NEO:STACK
            </span>
          )}
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2" aria-label="Primary">
          <NavItem to="/" icon={<Activity />} label="Overview" isOpen={isSidebarOpen} />
          <NavItem to="/topology" icon={<Layers />} label="Topology" isOpen={isSidebarOpen} />
          <NavItem to="/entities" icon={<Database />} label="Entities" isOpen={isSidebarOpen} />
          <NavItem to="/outbox" icon={<Server />} label="Outbox" isOpen={isSidebarOpen} />
        </nav>
        
        <div className="p-4 border-t border-white/10 shrink-0">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center w-full px-3 py-3 rounded-xl transition-all duration-200 group text-textMuted hover:bg-white/5 hover:text-white`}
            title={isSidebarOpen ? undefined : "Settings"}
          >
            <Settings className="text-textMuted group-hover:text-white transition-colors" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Settings</span>}
          </button>
        </div>
      </aside>

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-10">
           <div className="glass-panel w-full max-w-4xl h-full max-h-[80vh] rounded-2xl border border-white/10 shadow-2xl relative flex flex-col overflow-hidden">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white z-50 hover:text-danger transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 overflow-auto">
                 <SettingsPage />
              </div>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="h-16 glass-panel flex items-center justify-between px-6 shrink-0 relative z-20">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 mr-4 rounded-lg hover:bg-white/5 transition-colors text-textMuted hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-textMuted select-none">Topology:</span>
              <select
                aria-label="Select topology project"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none cursor-pointer"
              >
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm">
              <span className="flex w-2 h-2 rounded-full bg-accent animate-pulse mr-2"></span>
              <span className="text-accent/90 font-medium">Live</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-sm font-bold shadow-lg ring-2 ring-white/10">
              A
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <main id="main-content" className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--color-surfaceHighlight),_var(--color-background))] overflow-auto">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, isOpen }: { to: string; icon: React.ReactNode; label: string; isOpen: boolean }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
        isActive 
          ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(109,40,217,0.2)]' 
          : 'text-textMuted hover:bg-white/5 hover:text-white'
      }`}
      title={isOpen ? undefined : label}
    >
      {({ isActive }) => (
        <>
          <div className={`${isActive ? 'text-primary' : 'text-textMuted group-hover:text-white'} transition-colors`}>
            {icon}
          </div>
          {isOpen && (
            <span className="ml-3 font-medium whitespace-nowrap">{label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}
