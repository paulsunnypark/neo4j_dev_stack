import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppProvider } from './stores/AppStore';
import { queryClient } from './queryClient';

const MainLayout = lazy(() => import('./layouts/MainLayout'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const TopologyPage = lazy(() => import('./pages/TopologyPage'));
const EntitiesPage = lazy(() => import('./pages/EntitiesPage'));
const OutboxPage = lazy(() => import('./pages/OutboxPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
        <BrowserRouter>
          <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-textMuted">Loading workspace...</div>}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="topology" element={<TopologyPage />} />
                <Route path="entities" element={<EntitiesPage />} />
                <Route path="outbox" element={<OutboxPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
