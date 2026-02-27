import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper,
  getPaginationRowModel
} from '@tanstack/react-table';
import { Edit2, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '../stores/useAppContext';
import type {
  AttributeChangedPayload,
  EntityCreatedPayload,
  ListEntitiesQuery,
  RelationshipEstablishedPayload,
  StatusChangedPayload,
} from '../api/contracts';
import { createEntity, deleteEntity, listEntities, updateEntityAttribute, updateEntityStatus } from '../api/services/entitiesService';
import { createRelationship } from '../api/services/relationshipsService';

type EntityData = {
  id: string;
  projectId: string;
  entityType: string;
  name: string;
  status: string;
};

const columnHelper = createColumnHelper<EntityData>();

export default function EntitiesPage() {
  const { projectId, triggerRefresh } = useAppContext();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({ 
    id: '', type: 'Device', name: '', targetEntityId: '', relationshipType: 'DEPENDS_ON',
    template: 'GENERIC', snmpIp: '', snmpPort: '161', snmpCommunity: 'public',
    matterFabric: '', matterNodeId: '', modbusAddress: '1', modbusBaud: '9600'
  });
  const [editFormData, setEditFormData] = useState({ id: '', name: '', type: '', status: '' });

  const entitiesQuery = useQuery({
    queryKey: ['entities', projectId],
    queryFn: async () => {
      const params: ListEntitiesQuery = { project_id: projectId, size: 100 };
      const res = await listEntities(params);
      return (res.items || []).map((e) => ({
        id: e.id,
        projectId: e.projectId || projectId,
        entityType: e.entityType,
        name: e.name || e.id,
        status: e.status || 'UNKNOWN',
      }));
    },
  });

  const data = entitiesQuery.data || [];
  const isLoading = entitiesQuery.isLoading;

  const refreshEntities = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['entities', projectId] });
  }, [projectId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (row: EntityData) => {
      await deleteEntity(row.id, { project_id: row.projectId, entity_type: row.entityType });
    },
    onSuccess: async (_, row) => {
      toast.success(`Entity deleted: ${row.id}`);
      await refreshEntities();
    },
    onError: (error) => {
      console.error('Delete failed', error);
      toast.error('Failed to delete entity');
    },
  });

  const handleDelete = useCallback(async (row: EntityData) => {
    if (confirm(`Delete entity ${row.name || row.id}?`)) {
      await deleteMutation.mutateAsync(row);
    }
  }, [deleteMutation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) {
      toast.error("Entity ID is required");
      return;
    }

    try {
      // 1. Create the base entity
      const payload: EntityCreatedPayload = {
        project_id: projectId,
        entity_id: formData.id,
        entity_type: formData.type,
        name: formData.name || formData.id,
        attributes: {}
      };
      await createEntity(payload);
      
      const createAttr = async (key: string, val: string) => {
        if (!val) return;
        const attributePayload: AttributeChangedPayload = {
           project_id: projectId,
           entity_id: formData.id,
           entity_type: formData.type,
           attribute_key: key,
           new_value: val
        };
        await updateEntityAttribute(formData.id, attributePayload);
      };

      // 2. Set additional attributes based on template
      if (formData.template === 'SNMP') {
        await createAttr('ipAddress', formData.snmpIp);
        await createAttr('port', formData.snmpPort);
        await createAttr('community', formData.snmpCommunity);
        await createAttr('protocol', 'SNMP');
      } else if (formData.template === 'MATTER') {
        await createAttr('fabricId', formData.matterFabric);
        await createAttr('nodeId', formData.matterNodeId);
        await createAttr('protocol', 'Matter');
      } else if (formData.template === 'MODBUS') {
        await createAttr('deviceAddress', formData.modbusAddress);
        await createAttr('baudRate', formData.modbusBaud);
        await createAttr('protocol', 'Modbus');
      }

      // 3. Establish multiple relationships if specified
      if (formData.targetEntityId.trim()) {
         const targets = formData.targetEntityId.split(',').map(t => t.trim()).filter(t => !!t);
         for (const targetId of targets) {
             try {
              const targetEntity = data.find((entity) => entity.id === targetId);
              const relationshipPayload: RelationshipEstablishedPayload = {
                project_id: projectId,
                from_id: formData.id,
                from_type: formData.type,
                to_id: targetId,
                to_type: targetEntity?.entityType || 'Device',
                rel_type: formData.relationshipType,
                properties: {},
              };
              await createRelationship(relationshipPayload);
            } catch (relErr) {
              console.error(`Failed to link to ${targetId}`, relErr);
              toast.error(`Warning: Could not link to ${targetId}`);
            }
         }
      }

      setShowModal(false);
      setFormData({ 
        id: '', type: 'Device', name: '', targetEntityId: '', relationshipType: 'DEPENDS_ON',
        template: 'GENERIC', snmpIp: '', snmpPort: '161', snmpCommunity: 'public',
        matterFabric: '', matterNodeId: '', modbusAddress: '1', modbusBaud: '9600'
      });
      toast.success("All components gathered & entity projected");
      await refreshEntities();
      triggerRefresh();
    } catch (err: unknown) {
      console.error("Create failed", err);
      const detail = typeof err === 'object' && err && 'response' in err
        ? String((err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? 'Check console for details')
        : 'Check console for details';
      toast.error(`Failed to create entity: ${detail}`);
    }
  };

  const handleEditClick = useCallback((row: EntityData) => {
    setEditFormData({ id: row.id, name: row.name, type: row.entityType, status: row.status });
    setShowEditModal(true);
  }, []);

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Edit name
      const updateNamePayload: AttributeChangedPayload = {
        project_id: projectId,
        entity_id: editFormData.id,
        entity_type: editFormData.type,
        attribute_key: 'name',
        new_value: editFormData.name
      };
      await updateEntityAttribute(editFormData.id, updateNamePayload);
      // Edit status
      const updateStatusPayload: StatusChangedPayload = {
        project_id: projectId,
        entity_id: editFormData.id,
        entity_type: editFormData.type,
        new_status: editFormData.status,
      };
      await updateEntityStatus(editFormData.id, updateStatusPayload);
      setShowEditModal(false);
      toast.success("Entity updated");
      await refreshEntities();
    } catch(err) {
      console.error("Edit failed", err);
      toast.error("Failed to update entity");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => <span className="font-mono text-xs text-textMuted">{info.getValue()}</span>,
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => <span className="font-medium text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor('entityType', {
      header: 'Type',
      cell: info => <span className="px-2 py-1 bg-primary/20 text-primary rounded-md text-xs font-semibold">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${info.getValue() === 'ON' ? 'bg-accent/20 text-accent' : 'bg-gray-500/20 text-gray-400'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: info => (
        <div className="flex gap-2">
           <button aria-label={`Edit entity ${info.row.original.id}`} onClick={() => handleEditClick(info.row.original)} className="p-1.5 text-textMuted hover:text-white hover:bg-white/10 rounded disabled:opacity-50"><Edit2 className="w-4 h-4" /></button>
           <button aria-label={`Delete entity ${info.row.original.id}`} onClick={() => handleDelete(info.row.original)} className="p-1.5 text-danger font-bold hover:bg-danger/10 rounded disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
        </div>
      )
    })
  ], [handleDelete, handleEditClick]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 }
    }
  });

  return (
    <div className="p-6 h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-white tracking-wide">Entity Manager</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-[0_0_15px_rgba(109,40,217,0.4)] flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Entity
        </button>
      </div>
      
      <div className="flex-1 glass-panel rounded-xl border border-white/10 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-textMuted uppercase bg-black/40 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-6 py-4 font-semibold tracking-wider border-b border-white/5">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-textMuted">Loading data...</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-textMuted">No entities found.</td></tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
            <div className="text-xs text-textMuted">
               Showing Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => table.previousPage()} 
                 disabled={!table.getCanPreviousPage()}
                 className="px-3 py-1 rounded text-xs border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5"
               >Prev</button>
               <button 
                 onClick={() => table.nextPage()} 
                 disabled={!table.getCanNextPage()}
                 className="px-3 py-1 rounded text-xs border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5"
               >Next</button>
            </div>
        </div>
      </div>

      {/* Modal overlays for Create */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="glass-panel w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                 <h3 className="text-lg font-semibold text-white">Register New Entity</h3>
                 <button aria-label="Close create entity modal" onClick={() => setShowModal(false)} className="text-textMuted hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-medium text-textMuted uppercase mb-1">Entity ID <span className="text-danger">*</span></label>
                    <input required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-white/20" placeholder="e.g. Room_2_Light_1" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-textMuted uppercase mb-1">Display Name</label>
                    <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-white/20" placeholder="Optional human readable name" />
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1">
                       <label className="block text-xs font-medium text-textMuted uppercase mb-1">Entity Type</label>
                       <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary">
                          <option value="Device">Device (Generic)</option>
                          <option value="EndDevice">EndDevice</option>
                          <option value="Gateway">Gateway</option>
                          <option value="BorderRouter">BorderRouter</option>
                          <option value="Location">Location (Room)</option>
                       </select>
                    </div>
                    <div className="flex-1">
                       <label className="block text-xs font-medium text-textMuted uppercase mb-1 text-accent">Protocol Template</label>
                       <select value={formData.template} onChange={e => setFormData({...formData, template: e.target.value})} className="w-full bg-black/40 border border-accent/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-accent">
                          <option value="GENERIC">None (Generic)</option>
                          <option value="MATTER">Matter / Thread</option>
                          <option value="SNMP">SNMP / IP</option>
                          <option value="MODBUS">Modbus / RTU</option>
                       </select>
                    </div>
                 </div>

                 {/* Dynamic Protocol Fields */}
                 {formData.template === 'SNMP' && (
                    <div className="pt-2 border-t border-white/10 mt-2 grid grid-cols-2 gap-3">
                       <div className="col-span-2">
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">IP Address</label>
                          <input value={formData.snmpIp} onChange={e => setFormData({...formData, snmpIp: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" placeholder="192.168.1.100" />
                       </div>
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Port</label>
                          <input value={formData.snmpPort} onChange={e => setFormData({...formData, snmpPort: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" />
                       </div>
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Community</label>
                          <input value={formData.snmpCommunity} onChange={e => setFormData({...formData, snmpCommunity: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" />
                       </div>
                    </div>
                 )}

                 {formData.template === 'MATTER' && (
                    <div className="pt-2 border-t border-white/10 mt-2 grid grid-cols-2 gap-3">
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Fabric ID</label>
                          <input value={formData.matterFabric} onChange={e => setFormData({...formData, matterFabric: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" placeholder="e.g. 1" />
                       </div>
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Node ID</label>
                          <input value={formData.matterNodeId} onChange={e => setFormData({...formData, matterNodeId: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" placeholder="e.g. 1234" />
                       </div>
                    </div>
                 )}

                 {formData.template === 'MODBUS' && (
                    <div className="pt-2 border-t border-white/10 mt-2 grid grid-cols-2 gap-3">
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Device Address</label>
                          <input value={formData.modbusAddress} onChange={e => setFormData({...formData, modbusAddress: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" />
                       </div>
                       <div>
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Baud Rate</label>
                          <input value={formData.modbusBaud} onChange={e => setFormData({...formData, modbusBaud: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary" />
                       </div>
                    </div>
                 )}
                 <div className="pt-2 border-t border-white/10 mt-4">
                    <h4 className="text-sm font-semibold text-white mb-2">Wiring (Optional)</h4>
                    <div className="flex gap-2">
                       <div className="flex-1">
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Target Entity ID</label>
                          <input value={formData.targetEntityId} onChange={e => setFormData({...formData, targetEntityId: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary placeholder-white/20" placeholder="e.g. Gateway_1" />
                       </div>
                       <div className="w-1/3">
                          <label className="block text-xs font-medium text-textMuted uppercase mb-1">Relationship</label>
                          <select value={formData.relationshipType} onChange={e => setFormData({...formData, relationshipType: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary">
                             <option value="DEPENDS_ON">Depends On</option>
                             <option value="BELONGS_TO">Belongs To</option>
                             <option value="CONNECTS_TO">Connects To</option>
                          </select>
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-textMuted hover:text-white hover:bg-white/5 font-medium transition-colors">Cancel</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-all shadow-[0_0_15px_rgba(109,40,217,0.3)]">Create Entity</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {showEditModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="glass-panel w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                 <h3 className="text-lg font-semibold text-white">Edit Entity: {editFormData.id}</h3>
                  <button aria-label="Close edit entity modal" onClick={() => setShowEditModal(false)} className="text-textMuted hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={submitEdit} className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-medium text-textMuted uppercase mb-1">Display Name</label>
                    <input value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-white/20" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-textMuted uppercase mb-1">Status</label>
                    <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                       <option value="ON">ON</option>
                       <option value="OFF">OFF</option>
                       <option value="UNKNOWN">UNKNOWN</option>
                    </select>
                 </div>
                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-textMuted hover:text-white hover:bg-white/5 font-medium transition-colors">Cancel</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-medium transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]">Save Changes</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
