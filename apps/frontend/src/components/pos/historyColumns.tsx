import { createColumnHelper, StockFeatures } from '@tanstack/react-table';
import type { SaleDetailDTO, SaleId } from '@inventory/shared';
import { fmtUSD } from '../../utils/salesFormatters';
import { toBs } from '../../utils/currency';
import Badge from '../atoms/Badge';
import { Eye } from 'lucide-react';

const columnHelper = createColumnHelper<StockFeatures, SaleDetailDTO>();

/**
 * Genera las definiciones de columnas para la tabla de historial de ventas.
 * Usa SaleDetailDTO como fuente de verdad — sin casts, sin flotantes.
 */
export const buildHistoryColumns = (
  onView: (id: SaleId) => void,
  exchangeRate: string
) => [
    columnHelper.accessor('createdAt', {
      header: 'Fecha',
      cell: (info) => {
        const date = new Date(info.getValue());
        return (
          <div className="text-gray-300 text-sm">
            {date.toLocaleDateString()}
            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('sold_by', {
      header: 'Vendedor',
      cell: (info) => info.getValue()?.name ?? '—',
    }),
    columnHelper.accessor('payment_method', {
      header: 'Método Pago',
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: (info) => {
        const val = info.getValue();
        const label = val === 'cancelled' || val === 'Anulada' ? val : val ?? 'Completada';
        return (
          <Badge variant={val === 'Anulada' || val === 'cancelled' ? 'danger' : 'success'}>
            {label}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('total_amount', {
      header: 'Total',
      cell: (info) => {
        const amount = info.getValue();
        const rate = info.row.original.exchange_rate;
        const bs = toBs(amount, rate ?? exchangeRate);
        return (
          <div>
            <div className="text-amber-500 font-medium text-sm sm:text-base">{fmtUSD(amount)}</div>
            <p className="text-[10px] sm:text-xs text-blue-400 mt-0.5">Bs {bs}</p>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Acciones',
      cell: (info) => (
        <button
          onClick={() => onView(info.row.original._id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-colors"
        >
          <Eye size={14} /> Ver
        </button>
      ),
    }),
  ];
