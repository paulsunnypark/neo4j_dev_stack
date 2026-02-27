import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { NodeObject, LinkObject, ForceGraphMethods } from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize, Filter, X } from 'lucide-react';
import { useAppContext } from '../stores/useAppContext';
import type { EntityRecord, ListEntitiesQuery, ListRelationshipsQuery, PagedResponse, RelationshipRecord } from '../api/contracts';
import { listEntities } from '../api/services/entitiesService';
import { listRelationships } from '../api/services/relationshipsService';

// Extended types for d3-force rendering
interface GraphNode extends NodeObject {
  id: string;
  name: string;
  type: string;
  val: number; // Size
  color?: string;
  status: string;
  attributes: Record<string, unknown>;
}

interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

export default function GraphCanvas() {
  const fgRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined>(undefined);
  const { setSelectedNode, refreshKey, projectId, refreshInterval } = useAppContext();
  
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Responsive dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const ob = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    if (containerRef.current) ob.observe(containerRef.current);
    return () => ob.disconnect();
  }, []);

  const getNodeColor = (type: string, status: string) => {
    if (status === 'OFF') return '#4b5563';

    switch (type) {
      case 'Device': return '#10b981';
      case 'EndDevice': return '#10b981';
      case 'Gateway': return '#6d28d9';
      case 'BorderRouter': return '#6d28d9';
      case 'MatterBridge': return '#3b82f6';
      case 'Location': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const fetchTopologyData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch Entities (Nodes)
      const entityParams: ListEntitiesQuery = { project_id: projectId, size: 100 };
      const entitiesRes: PagedResponse<EntityRecord> = await listEntities(entityParams);

      // Fetch Relationships (Links)
      const relationshipParams: ListRelationshipsQuery = { project_id: projectId, size: 500 };
      const relationsRes: PagedResponse<RelationshipRecord> = await listRelationships(relationshipParams);

      // Neo4j entity properties: id, entityType, name, status, projectId, ...
      const entityItems = entitiesRes.items ?? [];
      const relationItems = relationsRes.items ?? [];

      const nodes: GraphNode[] = entityItems.map((e) => ({
        id: e.id,
        name: e.name ?? e.id,
        type: e.entityType,
        status: e.status ?? 'UNKNOWN',
        attributes: e,
        val: 10,
        color: getNodeColor(e.entityType, e.status ?? 'UNKNOWN')
      }));

      const links: GraphLink[] = relationItems.map((r) => ({
        source: r.source_id,
        target: r.target_id,
        type: r.rel_type
      }));

      setGraphData({ nodes, links });
      
      // Zoom to fit after data loads
      setTimeout(() => {
        fgRef.current?.zoomToFit(1000, 50);
      }, 500);

    } catch (err) {
      console.error("Failed to load topology:", err);
      setError("Failed to load topological data.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTopologyData();
    if (refreshInterval > 0) {
      const interval = setInterval(fetchTopologyData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTopologyData, refreshInterval, refreshKey]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode({
      id: node.id,
      projectId: projectId,
      entityType: node.type,
      name: node.name,
      status: node.status,
      ...node.attributes,
    });
  }, [projectId, setSelectedNode]);

  // Derived filtered data
  const displayData = useMemo(() => {
    const filteredNodes = graphData.nodes.filter(n => {
      if (filterType !== 'ALL' && n.type !== filterType) return false;
      if (filterStatus !== 'ALL' && n.status !== filterStatus) return false;
      return true;
    });
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links.filter(l => {
        const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return filteredNodeIds.has(sId) && filteredNodeIds.has(tId);
      });
    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, filterType, filterStatus]);

  // Map unique types
  const uniqueTypes = useMemo(() => Array.from(new Set(graphData.nodes.map(n => n.type))), [graphData.nodes]);

  const handleZoomIn = () => {
    const currentZoom = fgRef.current?.zoom();
    if (typeof currentZoom === 'number') {
      fgRef.current?.zoom(currentZoom * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    const currentZoom = fgRef.current?.zoom();
    if (typeof currentZoom === 'number') {
      fgRef.current?.zoom(currentZoom / 1.5, 400);
    }
  };

  const handleFit = () => fgRef.current?.zoomToFit(400, 50);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-transparent">
      
      {/* Overlay UI: Filters and Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* Controls */}
        <div className="glass-panel flex flex-col rounded-lg overflow-hidden border border-white/10 shadow-lg">
          <button onClick={handleZoomIn} className="p-2.5 text-textMuted hover:text-white hover:bg-white/10 transition-colors border-b border-white/5" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
          <button onClick={handleFit} className="p-2.5 text-textMuted hover:text-white hover:bg-white/10 transition-colors border-b border-white/5" title="Fit to Screen"><Maximize className="w-5 h-5" /></button>
          <button onClick={handleZoomOut} className="p-2.5 text-textMuted hover:text-white hover:bg-white/10 transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
        </div>

        {/* Filter Toolbar */}
        <div className="glass-panel rounded-lg border border-white/10 shadow-lg p-1">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`p-2.5 rounded-md transition-colors ${showFilters ? 'bg-primary/20 text-primary' : 'text-textMuted hover:text-white hover:bg-white/10'}`} 
            title="Filters"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="absolute top-4 left-20 z-20 glass-panel border border-white/10 rounded-xl p-4 w-64 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-white">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-textMuted hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-textMuted uppercase tracking-wider mb-1 block">Entity Type</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-textMuted uppercase tracking-wider mb-1 block">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Status</option>
                <option value="ON">Online (ON)</option>
                <option value="OFF">Offline (OFF)</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-textMuted bg-background/50 backdrop-blur-sm">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-lg tracking-wider font-light">Loading Topological Data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-danger/20 border border-danger/50 text-red-200 px-4 py-2 rounded-lg shadow-lg backdrop-blur-md">
          {error}
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={displayData}
        nodeLabel="name"
        nodeColor="color"
        nodeRelSize={6}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        linkColor={() => 'rgba(255,255,255,0.2)'}
        onNodeClick={(node) => handleNodeClick(node as GraphNode)}
        backgroundColor="transparent"
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const graphNode = node as GraphNode;
          const label = graphNode.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          
          const size = 6;
          
          // Draw Border
          ctx.beginPath();
          ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, size + 1.5, 0, 2 * Math.PI, false);
          ctx.fillStyle = graphNode.status === 'ON' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(100, 100, 100, 0.3)';
          ctx.fill();

          // Draw Core
          ctx.beginPath();
          ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = graphNode.color || '#3b82f6';
          ctx.fill();

          // Draw Text
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillText(label, graphNode.x ?? 0, (graphNode.y ?? 0) + size + 2);
        }}
      />
    </div>
  );
}
