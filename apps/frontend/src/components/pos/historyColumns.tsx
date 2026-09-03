import { createColumnHelper } from '@tanstack/react-table';
import type { Sale } from '@inventory/shared';
import { fmtUSD, fmtBs } from '../../utils/salesFormatters';
import { useSaleUIStore } from '../../store/saleUIStore';
import Badge from '../atoms/Badge';
import { Eye } from 'lucide-react';

const columnHelper = createColumnHelper<Sale>();

/**
 * Build column definitions for the sales history table.
 * Uses `createColumnHelper` for full type inference.
 */
export const buildHistoryColumns = (
  handleViewDetail: (id: string) => void,
  toBs: (val: string, rate: number) => string,
  rate: number,
) => {
  return [
    columnHelper.accessor('createdAt', {
      header: 'Fecha',
      cell: (info) => {
        const dateStr = info.getValue() as string;
        const date = new Date(dateStr);
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
    columnHelper.accessor((row: any) => row.sold_by?.name || 'N/A', { id: 'seller', header: 'Vendedor' }),
    columnHelper.accessor((row: any) => row.branch_id?.name || 'N/A', { id: 'branch', header: 'Sucursal' }),
    columnHelper.accessor('payment_method', { header: 'Método Pago' }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: (info) => (
        <Badge
          variant={info.getValue() === 'Anulada' || info.getValue() === 'cancelled' ? 'danger' : 'success'}
        >
          {info.getValue() ?? 'Completada'}
        </Badge>
      ),
    }),
    columnHelper.accessor('total_amount', {
      header: 'Total',
      cell: (info) => {
        const amount = info.getValue() as string; // strict string inference
        const row = info.row.original;
        const bs = toBs(amount, Number(row.exchange_rate ?? rate));
        return (
          <div>
            <div className="text-amber-500 font-medium text-sm sm:text-base">{fmtUSD(Number(amount))}</div>
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
          onClick={() => handleViewDetail(info.row.original._id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-colors"
        >
          <Eye size={14} />
          Ver
        </button>
      ),
    }),
  ];
};
