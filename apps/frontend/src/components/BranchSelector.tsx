import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Check, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useBranchesQuery } from '../hooks/queries/useBranchQueries';
import type { BranchId } from '@inventory/shared';

/**
 * BranchSelector — Selector global de sucursal activa.
 *
 * Se renderiza en la barra superior del Dashboard cuando el usuario tiene
 * acceso a más de una sucursal (allowedBranches.length > 1) o es dueño (customer).
 *
 * Al cambiar la sucursal activa:
 *  1. Invoca authStore.setActiveBranch(branchId)   — dispara evento 'branch-changed'
 *  2. cartStore.resetCart() escucha ese evento      — vacía el carrito
 *  3. queryClient.invalidateQueries()               — fuerza refetch de datos branch-scoped
 */
const BranchSelector: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, activeBranchId, setActiveBranch } = useAuthStore();
  const { data: branches = [] } = useBranchesQuery();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Cerrar dropdown al hacer click fuera ──────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Cerrar con tecla Escape ───────────────────────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // No renderizar si solo hay una sucursal y NO es customer (dueño)
  const isCustomer = user?.role === 'customer';
  if (branches.length <= 1 && !isCustomer) return null;

  const activeBranch = branches.find((b) => b._id === activeBranchId);

  const handleBranchChange = (branchId: BranchId) => {
    if (branchId === activeBranchId) {
      setIsOpen(false);
      return;
    }

    // 1. Actualizar la sucursal activa en el store de autenticación.
    //    Esto emite el evento 'branch-changed' que el cartStore escucha
    //    para ejecutar clearCart(true) de forma forzada.
    setActiveBranch(branchId);

    // 2. Invalidar TODAS las queries de TanStack Query para forzar refetch
    //    con el nuevo x-branch-id en las peticiones.
    queryClient.invalidateQueries();

    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative" id="branch-selector">
      {/* ── Trigger Button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium
          transition-all duration-200 select-none
          border border-white/[0.08] bg-white/[0.04]
          hover:bg-white/[0.08] hover:border-amber-500/30
          ${isOpen ? 'bg-white/[0.08] border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.08)]' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Seleccionar sucursal activa"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
          <Building2 size={15} />
        </div>
        <span className="text-slate-200 max-w-[140px] truncate">
          {activeBranch?.name ?? 'Sin sucursal'}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown Panel ─────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 mt-2 w-72 z-[60]
            rounded-xl border border-white/[0.08]
            bg-slate-900/95 backdrop-blur-xl
            shadow-[0_20px_60px_rgba(0,0,0,0.5)]
            overflow-hidden
          "
          role="listbox"
          aria-label="Lista de sucursales"
        >
          {/* Header del dropdown */}
          <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Sucursales disponibles
            </p>
          </div>

          {/* Lista de sucursales */}
          <div className="py-1.5 max-h-64 overflow-y-auto remove-scrollbar">
            {branches.map((branch) => {
              const isActive = branch._id === activeBranchId;
              return (
                <button
                  key={branch._id}
                  onClick={() => handleBranchChange(branch._id as BranchId)}
                  role="option"
                  aria-selected={isActive}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left
                    transition-all duration-150 group
                    ${isActive
                      ? 'bg-amber-500/[0.08] text-amber-400'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                    }
                  `}
                >
                  {/* Ícono de sucursal */}
                  <div
                    className={`
                      flex items-center justify-center w-8 h-8 rounded-lg shrink-0
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-white/[0.05] text-slate-500 group-hover:text-slate-300'
                      }
                    `}
                  >
                    <Building2 size={15} />
                  </div>

                  {/* Información de la sucursal */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{branch.name}</p>
                    {branch.address && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate mt-0.5">
                        <MapPin size={10} className="shrink-0" />
                        {branch.address}
                      </p>
                    )}
                  </div>

                  {/* Check de selección activa */}
                  {isActive && (
                    <Check size={16} className="text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: Conteo de sucursales activas (Solo Customer/Admin) */}
          {isCustomer && (
            <div className="px-4 py-2.5 border-t border-white/[0.06]">
              <p className="text-[11px] text-slate-500 text-center">
                {branches.length} {branches.length === 1 ? 'sucursal activa' : 'sucursales activas'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BranchSelector;
