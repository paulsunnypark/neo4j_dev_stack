import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { AppProvider } from '../stores/AppStore';
import { useAppContext } from '../stores/useAppContext';
import { apiClient } from '../api/client';
import { queryClient } from '../queryClient';

describe('App smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    queryClient.clear();
  });

  it('renders main shell and overview route', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url === '/projects') {
        return Promise.resolve({ data: ['project-a', 'project-b'] });
      }
      if (url === '/stats') {
        return Promise.resolve({
          data: { total_nodes: 3, active_nodes: 2, total_relationships: 4 },
        });
      }
      if (url === '/outbox/stats') {
        return Promise.resolve({ data: { PENDING: 1, DONE: 2, FAILED: 0 } });
      }
      return Promise.resolve({ data: { items: [] } });
    });

    render(<App />);

    expect(await screen.findByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('NEO:STACK')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('persists settings through AppProvider context', () => {
    const Consumer = () => {
      const { projectId, setProjectId, refreshInterval, setRefreshInterval } = useAppContext();
      return (
        <div>
          <span data-testid="project">{projectId}</span>
          <span data-testid="interval">{refreshInterval}</span>
          <button onClick={() => setProjectId('project-z')}>set-project</button>
          <button onClick={() => setRefreshInterval(10000)}>set-interval</button>
        </div>
      );
    };

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    fireEvent.click(screen.getByText('set-project'));
    fireEvent.click(screen.getByText('set-interval'));

    expect(screen.getByTestId('project')).toHaveTextContent('project-z');
    expect(screen.getByTestId('interval')).toHaveTextContent('10000');
    expect(localStorage.getItem('neo_stacker_projectId')).toBe('project-z');
    expect(localStorage.getItem('neo_stacker_refresh')).toBe('10000');
  });
});
