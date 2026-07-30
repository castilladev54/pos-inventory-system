import { useState } from 'react';
import { Send, Download, Plus, Check, X, Ban, Clock, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useStockTransfersQuery, useUpdateStockTransferStatus } from '../../hooks/queries/useStockTransferQueries';
import Button from '../atoms/Button';
import Badge from '../atoms/Badge';
import DataTable, { DataTableColumn } from '../organisms/DataTable';
import CreateStockTransferModal from './CreateStockTransferModal';
import toast from 'react-hot-toast';
import type { IStockTransfer } from '@inventory/shared';

const StockTransferManager = () => {
  const { activeBranchId } = useAuthStore();
  const { data: transfers = [], isLoading } = useStockTransfersQuery(activeBranchId ?? null);
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateStockTransferStatus();

  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Separar y filtrar transferencias
  const incomingTransfers = transfers.filter(t => 
    (typeof t.destination_branch_id === 'string' ? t.destination_branch_id === activeBranchId : t.destination_branch_id._id === activeBranchId)
  );
  const outgoingTransfers = transfers.filter(t => 
    (typeof t.source_branch_id === 'string' ? t.source_branch_id === activeBranchId : t.source_branch_id._id === activeBranchId)
  );

  const displayedTransfers = activeTab === 'incoming' ? incomingTransfers : outgoingTransfers;

  // Filtrado básico
  const filteredTransfers = displayedTransfers.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const idMatch = t._id.toLowerCase().includes(term);
    return idMatch;
  });

  const handleUpdateStatus = (id: string, status: 'COMPLETED' | 'REJECTED' | 'CANCELLED') => {
    let confirmMsg = '';
    if (status === 'COMPLETED') confirmMsg = '¿Confirmas la recepción de la transferencia? El inventario se sumará a esta sucursal.';
    if (status === 'REJECTED') confirmMsg = '¿Estás seguro de rechazar esta transferencia? El inventario retornará al origen.';
    if (status === 'CANCELLED') confirmMsg = '¿Estás seguro de cancelar esta transferencia? El inventario retornará al origen.';

    if (!window.confirm(confirmMsg)) return;

    updateStatus({ id: id as any, payload: { status } }, {
      onSuccess: () => {
        toast.success(`Transferencia ${status.toLowerCase()} exitosamente`);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || 'Error al actualizar la transferencia');
      }
    });
  };

  const columns: DataTableColumn<IStockTransfer>[] = [
    {
      key: '_id',
      label: 'ID',
      render: (val) => <span className="text-gray-500 font-mono text-xs">{String(val).slice(-6).toUpperCase()}</span>
    },
    {
      key: 'createdAt',
      label: 'Fecha',
      render: (val) => (
        <div className="text-gray-300 text-sm">
          {new Date(String(val)).toLocaleDateString()}
          <div className="text-[10px] text-gray-500">{new Date(String(val)).toLocaleTimeString()}</div>
        </div>
      )
    },
    {
      key: activeTab === 'incoming' ? 'source_branch_id' : 'destination_branch_id',
      label: activeTab === 'incoming' ? 'Origen' : 'Destino',
      render: (val) => (
        <span className="font-medium text-white">
          {typeof val === 'string' ? val : (val as any)?.name}
        </span>
      )
    },
    {
      key: 'items',
      label: 'Artículos',
      render: (val: any) => (
        <span className="text-orange-400 bg-orange-500/10 px-2 py-1 rounded text-xs font-bold border border-orange-500/20">
          {val?.length || 0} ítems
        </span>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (val) => {
        switch (val) {
          case 'PENDING': return <Badge variant="warning"><div className="flex items-center gap-1"><Clock size={12} /> Pendiente</div></Badge>;
          case 'COMPLETED': return <Badge variant="success"><div className="flex items-center gap-1"><Check size={12} /> Completada</div></Badge>;
          case 'REJECTED': return <Badge variant="danger"><div className="flex items-center gap-1"><Ban size={12} /> Rechazada</div></Badge>;
          case 'CANCELLED': return <Badge variant="danger"><div className="flex items-center gap-1"><X size={12} /> Cancelada</div></Badge>;
          default: return <Badge variant="neutral">{String(val)}</Badge>;
        }
      }
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (_, row) => {
        if (row.status !== 'PENDING') return <span className="text-gray-600 text-xs">-</span>;

        if (activeTab === 'incoming') {
          return (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(row._id, 'COMPLETED')} disabled={isUpdating}>
                Recibir
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleUpdateStatus(row._id, 'REJECTED')} disabled={isUpdating}>
                Rechazar
              </Button>
            </div>
          );
        } else {
          return (
            <Button size="sm" variant="danger" onClick={() => handleUpdateStatus(row._id, 'CANCELLED')} disabled={isUpdating}>
              Cancelar
            </Button>
          );
        }
      }
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Transferencias de <span className="text-orange-500">Stock</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona el inventario en tránsito entre tus sucursales.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={20} /> Nueva Transferencia
        </Button>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium ${
            activeTab === 'incoming'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Download size={18} /> Entrantes
          {incomingTransfers.filter(t => t.status === 'PENDING').length > 0 && (
            <span className="ml-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {incomingTransfers.filter(t => t.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium ${
            activeTab === 'outgoing'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Send size={18} /> Enviadas
          {outgoingTransfers.filter(t => t.status === 'PENDING').length > 0 && (
            <span className="ml-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {outgoingTransfers.filter(t => t.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      <div className="bg-[#1a1a24] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Adorno de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar por ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div className="relative z-10">
          <DataTable
            columns={columns}
            data={filteredTransfers}
            isLoading={isLoading}
            emptyMessage={activeTab === 'incoming' ? 'No tienes transferencias entrantes.' : 'No has enviado ninguna transferencia.'}
          />
        </div>
      </div>

      <CreateStockTransferModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </section>
  );
};

export default StockTransferManager;
