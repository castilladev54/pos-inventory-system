import React, { useState } from 'react';
import { useBranchesQuery, useCreateBranch } from '../../hooks/queries/useBranchQueries';
import { Store, Plus, MapPin, Loader2, AlertCircle } from 'lucide-react';
import type { Branch } from '@inventory/shared';

const BranchManager = () => {
  const { data: branches, isLoading, error } = useBranchesQuery();
  const createBranchMutation = useCreateBranch();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      await createBranchMutation.mutateAsync({ name, address });
      setIsModalOpen(false);
      setName('');
      setAddress('');
    } catch (err) {
      console.error('Error creating branch:', err);
    }
  };

  return (
    <div className="p-6 md:p-8 animate-fade-in text-white max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-600 flex items-center gap-3">
            <Store className="text-pink-500" size={32} />
            Administrador de Sucursales
          </h1>
          <p className="text-gray-400 mt-2">
            Gestiona las ubicaciones físicas de tu negocio
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors"
        >
          <Plus size={20} />
          Nueva Sucursal
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-pink-500" size={40} />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={24} />
          <p>Ocurrió un error al cargar las sucursales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches?.map((branch: Branch) => (
            <div 
              key={branch._id} 
              className="bg-black/40 border border-white/5 rounded-2xl p-6 hover:border-pink-500/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
                  <Store size={24} />
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${branch.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                  {branch.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{branch.name}</h3>
              {branch.address && (
                <div className="flex items-start gap-2 text-gray-400 text-sm">
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  <p>{branch.address}</p>
                </div>
              )}
            </div>
          ))}
          {branches?.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              No tienes sucursales registradas.
            </div>
          )}
        </div>
      )}

      {/* Modal para Crear Sucursal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden animate-fade-in shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Crear Nueva Sucursal</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre de la Sucursal <span className="text-pink-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                    placeholder="Ej: Sede Norte"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dirección (Opcional)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                    placeholder="Ej: Av. Principal 123"
                  />
                </div>
                
                {createBranchMutation.isError && (
                  <div className="text-red-400 text-sm mt-2">
                    {createBranchMutation.error?.message || 'Error al crear la sucursal'}
                  </div>
                )}
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-white/10 hover:bg-white/5 rounded-xl font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createBranchMutation.isPending || !name.trim()}
                    className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {createBranchMutation.isPending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      'Crear'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManager;
