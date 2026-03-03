import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { AppProvider } from '../stores/AppStore';
import { useAppContext } from '../stores/useAppContext';
import { queryClient } from '../queryClient';
import { installApiClientMock } from '../test/mockApiClient';

describe('App smoke', () => {
  let apiMock: ReturnType<typeof installApiClientMock> | null = null;

  afterEach(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    apiMock?.restore();
    apiMock = null;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders main shell and overview route', async () => {
    apiMock = installApiClientMock([
      { method: 'get', matcher: '/projects', response: ['project-a', 'project-b'] },
      { method: 'get', matcher: '/stats', response: { total_nodes: 3, active_nodes: 2, total_relationships: 4 } },
      { method: 'get', matcher: '/outbox/stats', response: { PENDING: 1, DONE: 2, FAILED: 0 } },
    ]);

    render(<App />);

    expect(await screen.findByText('System Overview', {}, { timeout: 5000 })).toBeInTheDocument();
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
