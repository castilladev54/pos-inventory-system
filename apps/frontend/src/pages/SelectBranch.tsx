import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useBranchesQuery, useCreateBranch } from '@/hooks/queries/useBranchQueries';
import type { BranchId } from '@inventory/shared';

export const SelectBranch: React.FC = () => {
  const navigate = useNavigate();
  const { user, setActiveBranch } = useAuthStore();
  const { data: branches = [], isLoading } = useBranchesQuery();
  const createBranchMutation = useCreateBranch();

  // Estado local para creación rápida del Customer
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  if (isLoading) return <div className="p-8 text-center text-white">Cargando sucursales...</div>;

  const isCustomer = user?.role === 'customer';

  // ── ESCENARIO 1: El Dueño aún no tiene sucursales (Creación Inicial) ──────
  if (isCustomer && branches.length === 0) {
    const handleInitialCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newBranchName.trim()) return;

      const createdBranch = await createBranchMutation.mutateAsync({
        name: newBranchName,
        address: newBranchAddress,
      });

      setActiveBranch(createdBranch._id as BranchId);
      navigate('/dashboard');
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white">Crea tu Primera Sucursal</h2>
          <p className="mt-1 text-sm text-slate-400">
            Para empezar a operar el sistema, registra la sede principal de tu negocio.
          </p>

          <form onSubmit={handleInitialCreate} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300">Nombre de la Sucursal</label>
              <input
                type="text"
                required
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Ej. Sede Central, Sucursal Norte"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Dirección (Opcional)</label>
              <input
                type="text"
                value={newBranchAddress}
                onChange={(e) => setNewBranchAddress(e.target.value)}
                placeholder="Ej. Av. Main Street #123"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={createBranchMutation.isPending}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {createBranchMutation.isPending ? 'Creando...' : 'Crear y Continuar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── ESCENARIO 2: Empleado sin sucursales asignadas (Acceso Restringido) ───
  if (!isCustomer && branches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-xl border border-amber-500/20 bg-slate-900 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            ⚠️
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">Sin Sucursal Asignada</h2>
          <p className="mt-2 text-sm text-slate-400">
            Tu cuenta de empleado no tiene sucursales activas asignadas. Contacta al dueño del negocio para que habilite tu acceso.
          </p>
          <button
            onClick={() => useAuthStore.getState().clearAuth()}
            className="mt-6 w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Regresar al Login
          </button>
        </div>
      </div>
    );
  }

  // ── ESCENARIO 3: Listado de Selección (Para Dueño y Empleados Habilitados) ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Selecciona una Sucursal</h2>
          {isCustomer && (
            <button
              onClick={() => navigate('/dashboard/branches')}
              className="text-xs font-semibold text-amber-500 hover:underline"
            >
              + Nueva Sucursal
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3">
          {branches.map((branch) => (
            <button
              key={branch._id}
              onClick={() => {
                setActiveBranch(branch._id as BranchId);
                navigate('/dashboard');
              }}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4 text-left transition hover:border-amber-500/50 hover:bg-slate-800"
            >
              <div>
                <h3 className="font-semibold text-white">{branch.name}</h3>
                <p className="text-xs text-slate-400">{branch.address || 'Sin dirección registrada'}</p>
              </div>
              <span className="text-xs text-amber-500">Entrar →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelectBranch;
