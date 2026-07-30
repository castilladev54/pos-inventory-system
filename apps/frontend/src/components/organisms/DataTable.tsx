import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2 } from 'lucide-react';
import Button from '../atoms/Button';
import Spinner from '../atoms/Spinner';
import EmptyState from '../molecules/EmptyState';
import Pagination from '../molecules/Pagination';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyDetail?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

const DataTable = <T extends Record<string, any>>({
  columns = [],
  data = [],
  isLoading = false,
  onEdit,
  onDelete,
  emptyMessage = 'No hay registros.',
  emptyIcon,
  emptyDetail,
  emptyAction,
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: DataTableProps<T>) => {
  const hasActions = onEdit || onDelete;

  return (
    <div className={`bg-[#1a1a24] border border-white/10 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          message={emptyMessage}
          detail={emptyDetail}
          action={emptyAction}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20 text-gray-400 text-xs sm:text-sm uppercase tracking-wider">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-4 py-3 sm:px-6 sm:py-4 font-medium ${col.headerClassName ?? ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {hasActions && (
                    <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-right">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {data.map((row, rowIndex) => (
                  <motion.tr
                    key={row._id ?? row.id ?? rowIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: rowIndex * 0.04 }}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 sm:px-6 sm:py-4 text-gray-300 text-sm ${col.className ?? ''}`}
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : (row[col.key] ?? '')}
                      </td>
                    ))}

                    {hasActions && (
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {onEdit && (
                            <Button
                              variant="icon"
                              onClick={() => onEdit(row)}
                              aria-label="Editar registro"
                              className="text-blue-400 hover:bg-blue-500/10 p-1.5 sm:p-2"
                            >
                              <Edit2 size={16} />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="icon"
                              onClick={() => onDelete(row)}
                              aria-label="Eliminar registro"
                              className="text-red-400 hover:bg-red-500/10 p-1.5 sm:p-2"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentPage && totalPages && totalPages > 1 && onPageChange && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default DataTable;
