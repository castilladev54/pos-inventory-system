import { createColumnHelper, ColumnDef } from '@tanstack/react-table';
import type { Sale } from '@inventory/shared';
import { fmtUSD, fmtBs } from '../../utils/salesFormatters';
import { useSaleUIStore } from '../../store/saleUIStore';
import Badge from '../atoms/Badge';
import { Eye } from 'lucide-react';

export interface PopulatedSale extends Omit<Sale, 'sold_by' | 'branch_id'> {
  sold_by: { _id: string; name: string } | null;
  branch_id: { _id: string; name: string } | null;
}

const columnHelper = createColumnHelper<PopulatedSale>();

/**
 * Build column definitions for the sales history table.
 * Uses `createColumnHelper` for full type inference.
 */
export const buildHistoryColumns = (
  handleViewDetail: (id: string) => void,
  toBs: (val: string, rate: number) => string,
  rate: number,
): ColumnDef<PopulatedSale, any>[] => {
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
    columnHelper.accessor('sold_by', {
      header: 'Vendedor',
      cell: (info) => {
        const user = info.getValue() as any;
        return user?.name ? user.name : '—';
      },
    }),
    columnHelper.accessor('branch_id', {
      header: 'Sucursal',
      cell: (info) => {
        const branch = info.getValue() as any;
        return branch?.name ? branch.name : '—';
      },
    }),
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
        const row = info.row.original as any;
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
