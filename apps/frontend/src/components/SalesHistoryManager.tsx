import React from 'react';
import { useAuthStore } from '../store/authStore';
import { RequireBranchGuard } from './guards/RequireBranchGuard';
import { RateGuard } from './pos/RateGuard';

import TodaySales from './pos/TodaySales';
import GlobalSalesHistory from './pos/GlobalSalesHistory';

const SalesHistoryManagerInner = () => {
  const { user } = useAuthStore();

  return (
    <section aria-labelledby="sales-history-heading" className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <header className="mb-6">
        <h2 id="sales-history-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
          Historial de <span className="text-orange-500">Ventas</span>
        </h2>
      </header>

      {/* Vistas de Historial según rol */}
      {user?.role === 'employee' ? (
        <TodaySales />
      ) : (
        <GlobalSalesHistory />
      )}
    </section>
  );
};

export default function SalesHistoryManager() {
  return (
    <RequireBranchGuard>
      <RateGuard>
        <SalesHistoryManagerInner />
      </RateGuard>
    </RequireBranchGuard>
  );
}
