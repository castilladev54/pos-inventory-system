import { Search, X } from 'lucide-react';

export interface FilterBarOption {
  label: string;
  value: string;
}

export interface FilterBarConfig {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  options?: FilterBarOption[];
}

interface FilterBarProps {
  search?: string;
  onSearch?: (val: string) => void;
  filters?: FilterBarConfig[];
  placeholder?: string;
  className?: string;
}

const FilterBar = ({
  search = '',
  onSearch,
  filters = [],
  placeholder = 'Buscar...',
  className = '',
}: FilterBarProps) => (
  <div className={`flex flex-col sm:flex-row gap-3 mb-6 ${className}`}>
    {/* Search input */}
    <div className="relative flex-1">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm
                   placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40
                   focus:border-orange-500/50 transition"
      />
      {search && (
        <button
          onClick={() => onSearch?.('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>

    {/* Select filters */}
    {filters.map((filter, i) => (
      <select
        key={i}
        value={filter.value}
        onChange={(e) => filter.onChange(e.target.value)}
        aria-label={filter.placeholder ?? `Filtro ${i + 1}`}
        className="bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                   focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition
                   sm:min-w-[140px]"
      >
        {filter.placeholder && (
          <option value="">{filter.placeholder}</option>
        )}
        {filter.options?.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a24]">
            {opt.label}
          </option>
        ))}
      </select>
    ))}
  </div>
);

export default FilterBar;
