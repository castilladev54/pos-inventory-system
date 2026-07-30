import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../atoms/Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    let pages: (number | '...')[] = [];
    if (totalPages <= 5) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (currentPage <= 3) {
      pages = [1, 2, 3, 4, '...', totalPages];
    } else if (currentPage >= totalPages - 2) {
      pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }

    return pages.map((page, index) =>
      page === '...' ? (
        <span
          key={`ellipsis-${index}`}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-400 ring-1 ring-inset ring-white/10"
        >
          …
        </span>
      ) : (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          aria-label={`Ir a página ${page}`}
          aria-current={currentPage === page ? 'page' : undefined}
          className={`inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-white/10 transition-colors ${
            currentPage === page
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          {page}
        </button>
      )
    );
  };

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between border-t border-white/5 px-4 py-3 sm:px-6 bg-[#1a1a24]"
    >
      {/* Mobile */}
      <div className="flex flex-1 justify-between sm:hidden items-center gap-4">
        <Button variant="secondary" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          Anterior
        </Button>
        <span className="text-sm text-gray-400">
          {currentPage} de {totalPages}
        </span>
        <Button variant="secondary" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Siguiente
        </Button>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-gray-400">
          Página <span className="font-medium text-white">{currentPage}</span> de{' '}
          <span className="font-medium text-white">{totalPages}</span>
        </p>
        <div className="isolate inline-flex -space-x-px rounded-md shadow-sm">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Página anterior"
            className="inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {renderPageNumbers()}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Página siguiente"
            className="inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Pagination;
