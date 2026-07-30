import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Trash2, Send } from 'lucide-react';
import Button from '../atoms/Button';
import { useAuthStore } from '../../store/authStore';
import { useAllProductsForPOS } from '../../hooks/queries/useProductQueries';
import { useBranchesQuery } from '../../hooks/queries/useBranchQueries';
import { useCreateStockTransfer } from '../../hooks/queries/useStockTransferQueries';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CreateStockTransferModal = ({ isOpen, onClose }: Props) => {
  const { activeBranchId } = useAuthStore();
  const { data: branches = [] } = useBranchesQuery();
  const { data: products = [] } = useAllProductsForPOS();
  const { mutate: createTransfer, isPending } = useCreateStockTransfer();

  const [destinationBranch, setDestinationBranch] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<Array<{ product_id: string; name: string; maxStock: number; quantity: number }>>([]);

  // Filtrar sucursales destino (no puede ser la misma sucursal activa)
  const availableBranches = useMemo(() => {
    return branches.filter(b => b._id !== activeBranchId && b.is_active);
  }, [branches, activeBranchId]);

  // Filtrar productos disponibles en la sucursal origen
  const availableProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    
    return products.filter((p: any) => {
      if (!p.name.toLowerCase().includes(term) && !p.barcode?.toLowerCase().includes(term)) return false;
      
      // Asegurarse de que hay stock en la sucursal actual
      const branchInv = p.branchInventories?.find((b: any) => typeof b.branch_id === 'string' ? b.branch_id === activeBranchId : b.branch_id._id === activeBranchId);
      if (!branchInv || branchInv.stock <= 0) return false;
      
      // Filtrar si ya está en la lista seleccionada
      if (selectedItems.some(item => item.product_id === p._id)) return false;
      
      return true;
    }).slice(0, 5); // Mostrar solo top 5 sugerencias
  }, [products, searchTerm, activeBranchId, selectedItems]);

  if (!isOpen) return null;

  const handleAddItem = (p: any) => {
    const branchInv = p.branchInventories?.find((b: any) => typeof b.branch_id === 'string' ? b.branch_id === activeBranchId : b.branch_id._id === activeBranchId);
    if (!branchInv) return;

    setSelectedItems(prev => [
      ...prev,
      { product_id: p._id, name: p.name, maxStock: branchInv.stock, quantity: 1 }
    ]);
    setSearchTerm('');
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleQtyChange = (productId: string, qty: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity: Math.min(Math.max(1, qty), item.maxStock) };
      }
      return item;
    }));
  };

  const handleSubmit = () => {
    if (!destinationBranch) {
      toast.error('Selecciona una sucursal destino');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Agrega al menos un producto a la transferencia');
      return;
    }

    createTransfer({
      destination_branch_id: destinationBranch as any,
      items: selectedItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      notes
    }, {
      onSuccess: () => {
        toast.success('Transferencia creada exitosamente');
        onClose();
        // Reset form
        setDestinationBranch('');
        setSelectedItems([]);
        setNotes('');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || 'Error al crear la transferencia');
      }
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-transparent">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Send className="text-orange-500" />
              Nueva Transferencia de Stock
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {/* Destino */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sucursal Destino</label>
              <select
                value={destinationBranch}
                onChange={(e) => setDestinationBranch(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-orange-500 transition-colors"
              >
                <option value="">-- Seleccionar Destino --</option>
                {availableBranches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Buscador de Productos */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Agregar Productos</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-orange-500 transition-colors"
                />
                
                {searchTerm && availableProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl overflow-hidden z-10">
                    {availableProducts.map((p: any) => {
                      const branchInv = p.branchInventories?.find((b: any) => typeof b.branch_id === 'string' ? b.branch_id === activeBranchId : b.branch_id._id === activeBranchId);
                      return (
                        <button
                          key={p._id}
                          onClick={() => handleAddItem(p)}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center transition"
                        >
                          <div>
                            <p className="text-white font-medium text-sm">{p.name}</p>
                            {p.barcode && <p className="text-xs text-gray-500">{p.barcode}</p>}
                          </div>
                          <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md">
                            Stock Disponible: {branchInv?.stock}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Seleccionados */}
            <div className="bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Productos a Transferir</h3>
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">{selectedItems.length}</span>
              </div>
              
              {selectedItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No hay productos agregados a la transferencia.
                </div>
              ) : (
                <ul className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                  {selectedItems.map((item, idx) => (
                    <li key={item.product_id} className="p-3 flex items-center justify-between hover:bg-white/[0.02]">
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">Max: {item.maxStock}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleQtyChange(item.product_id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10"
                          >-</button>
                          <input
                            type="number"
                            min="1"
                            max={item.maxStock}
                            value={item.quantity || ''}
                            onChange={(e) => handleQtyChange(item.product_id, parseInt(e.target.value) || 1)}
                            className="w-14 bg-transparent border-b border-white/20 text-center text-white outline-none focus:border-orange-500"
                          />
                          <button 
                            onClick={() => handleQtyChange(item.product_id, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10"
                          >+</button>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.product_id)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Notas (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo de la transferencia, transportista, etc."
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 resize-none h-20"
              />
            </div>
          </div>

          <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/[0.02]">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isPending || selectedItems.length === 0 || !destinationBranch}>
              {isPending ? 'Procesando...' : 'Crear Transferencia'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateStockTransferModal;
