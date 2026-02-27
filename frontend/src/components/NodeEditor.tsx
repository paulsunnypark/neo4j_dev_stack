import { useState, useEffect, useCallback } from 'react';
import { X, Power, Save, Trash2, Link as LinkIcon, Plus, Unlink } from 'lucide-react';
import { useAppContext } from '../stores/useAppContext';
import { toast } from 'sonner';
import type { ListRelationshipsQuery, RelationshipEstablishedPayload, RelationshipRecord, RelationshipRemovedPayload, StatusChangedPayload } from '../api/contracts';
import { deleteEntity, updateEntityStatus } from '../api/services/entitiesService';
import { createRelationship, listRelationships, removeRelationship } from '../api/services/relationshipsService';

type RelationshipItem = RelationshipRecord & {
  source_type?: string;
  target_type?: string;
};

export default function NodeEditor() {
  const { selectedNode, setSelectedNode, triggerRefresh, projectId } = useAppContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [relationships, setRelationships] = useState<RelationshipItem[]>([]);
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelType, setNewRelType] = useState('DEPENDS_ON');

  const fetchNodeRelations = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const params: ListRelationshipsQuery = { project_id: projectId, size: 500 };
      const res = await listRelationships(params);
      const filtered = ((res.items || []) as RelationshipItem[]).filter((r) =>
        r.source_id === selectedNode.id || r.target_id === selectedNode.id
      );
      setRelationships(filtered);
    } catch (err) {
      console.error("Failed to fetch node relations", err);
    }
  }, [projectId, selectedNode]);

  useEffect(() => {
    fetchNodeRelations();
  }, [fetchNodeRelations]);

  if (!selectedNode) return null;

  const handleClose = () => {
    setSelectedNode(null);
  };

  const handleToggleStatus = async () => {
    try {
      setIsUpdating(true);
      const newStatus = selectedNode.status === 'ON' ? 'OFF' : 'ON';
      
      const payload: StatusChangedPayload = {
        project_id: projectId,
        entity_id: selectedNode.id,
        entity_type: selectedNode.entityType,
        new_status: newStatus
      };

      await updateEntityStatus(selectedNode.id, payload);
      
      setSelectedNode({ ...selectedNode, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      triggerRefresh();

    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelTarget) return;
    try {
      setIsUpdating(true);
      const relationshipPayload: RelationshipEstablishedPayload = {
        project_id: projectId,
        from_id: selectedNode.id,
        from_type: selectedNode.entityType,
        to_id: newRelTarget,
        to_type: 'Device',
        rel_type: newRelType,
        properties: {},
      };
      await createRelationship(relationshipPayload);
      toast.success("Relationship established");
      setNewRelTarget('');
      fetchNodeRelations();
      triggerRefresh();
    } catch (err) {
      console.error("Failed to add relationship", err);
      toast.error("Failed to add relationship");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRelation = async (rel: RelationshipItem) => {
    if (!confirm("Delete this relationship?")) return;
    try {
      setIsUpdating(true);
      const deletePayload: RelationshipRemovedPayload = {
          project_id: projectId,
          from_id: rel.source_id,
          from_type: rel.source_type || 'Device',
          to_id: rel.target_id,
          to_type: rel.target_type || 'Device',
          rel_type: rel.rel_type
      };
      await removeRelationship(deletePayload);
      toast.success("Relationship removed");
      fetchNodeRelations();
      triggerRefresh();
    } catch (err) {
      console.error("Failed to remove relationship", err);
      toast.error("Failed to remove relationship");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="absolute top-16 right-0 bottom-0 w-96 glass-panel border-l border-white/10 z-30 flex flex-col transform transition-all duration-300 translate-x-0 overflow-y-auto shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-surfaceHighlight/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-2 overflow-hidden">
           <div className={`w-2 h-2 rounded-full shrink-0 ${selectedNode.status === 'ON' ? 'bg-accent shadow-[0_0_8px_#10b981]' : 'bg-gray-500'}`}></div>
           <h2 className="text-lg font-bold text-white truncate">{selectedNode.name}</h2>
        </div>
        <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-white/10 text-textMuted hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-8">
        {/* Identity Section */}
        <section>
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-3">Identity</h3>
          <div className="space-y-2 bg-black/20 rounded-xl p-4 border border-white/5">
             <div className="flex justify-between items-center text-xs">
                <span className="text-textMuted">Type</span>
                <span className="px-2 py-0.5 bg-primary/20 text-primary rounded font-semibold">{selectedNode.entityType}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
                <span className="text-textMuted">Entity ID</span>
                <span className="font-mono text-white/70">{selectedNode.id}</span>
             </div>
          </div>
        </section>

        {/* Connections Section */}
        <section>
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <LinkIcon className="w-3 h-3"/> Active Connections
          </h3>
          <div className="space-y-3">
             {relationships.length === 0 ? (
               <div className="text-center py-4 bg-white/5 rounded-xl text-xs text-textMuted italic">No active connections found.</div>
             ) : (
               relationships.map((rel, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                    <div className="flex flex-col gap-0.5">
                       <span className="text-[10px] text-primary font-bold">{rel.rel_type}</span>
                       <span className="text-xs text-white font-mono truncate max-w-[150px]">
                         {rel.source_id === selectedNode.id ? `To: ${rel.target_id}` : `From: ${rel.source_id}`}
                       </span>
                    </div>
                    <button onClick={() => handleDeleteRelation(rel)} className="op-0 group-hover:opacity-100 p-1.5 text-danger hover:bg-danger/10 rounded transition-all">
                       <Unlink className="w-4 h-4" />
                    </button>
                 </div>
               ))
             )}

             {/* Add Relation Form */}
             <form onSubmit={handleAddRelation} className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex gap-2">
                   <input 
                     value={newRelTarget} 
                     onChange={e => setNewRelTarget(e.target.value)} 
                     placeholder="Target Entity ID..." 
                     className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-primary outline-none"
                   />
                   <select 
                     value={newRelType} 
                     onChange={e => setNewRelType(e.target.value)}
                     className="bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                   >
                     <option value="DEPENDS_ON">Depends On</option>
                     <option value="CONNECTED_TO">Connected To</option>
                     <option value="BELONGS_TO">Belongs To</option>
                   </select>
                   <button type="submit" disabled={isUpdating || !newRelTarget} className="p-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 disabled:opacity-30">
                     <Plus className="w-4 h-4" />
                   </button>
                </div>
             </form>
          </div>
        </section>

        {/* Attributes Section */}
        <section>
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em] mb-3">Custom Attributes</h3>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5 font-mono text-[11px] overflow-hidden text-gray-300">
             {(() => {
               const coreKeys = new Set(['id', 'projectId', 'entityType', 'name', 'status', 'updatedAt']);
               const extra = Object.fromEntries(Object.entries(selectedNode).filter(([k]) => !coreKeys.has(k)));
               return Object.keys(extra).length > 0 ? (
                 <pre className="whitespace-pre-wrap">{JSON.stringify(extra, null, 2)}</pre>
               ) : (
                 <span className="text-gray-500 italic">No custom attributes identified.</span>
               );
             })()}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 bg-surfaceHighlight/40 flex flex-col gap-3">
        <button 
          onClick={handleToggleStatus}
          disabled={isUpdating}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold transition-all
            ${selectedNode.status === 'ON' 
              ? 'bg-transparent border-danger/30 text-danger hover:bg-danger/10' 
              : 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Power className="w-4 h-4" />
          {selectedNode.status === 'ON' ? 'Shut Down' : 'Power On'}
        </button>
        
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white/80 transition-colors">
            <Save className="w-3.5 h-3.5" /> Edit JSON
          </button>
          <button 
            onClick={async () => {
              if (confirm("Delete entity permanently?")) {
                 try {
                    await deleteEntity(selectedNode.id, { project_id: projectId, entity_type: selectedNode.entityType });
                    toast.success("Entity removed");
                    handleClose();
                    triggerRefresh();
                 } catch {
                   toast.error("Delete failed");
                 }
               }
             }}
            className="flex items-center justify-center p-2 rounded-lg bg-danger/5 border border-danger/20 hover:bg-danger/10 text-danger transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
