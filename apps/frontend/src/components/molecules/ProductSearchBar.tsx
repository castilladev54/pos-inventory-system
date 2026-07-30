import { Search, Camera } from 'lucide-react';
import { RefObject } from 'react';
import InputText from '../atoms/InputText';
import Button from '../atoms/Button';

interface ProductSearchBarProps {
  searchTerm: string;
  onSearch: (val: string) => void;
  onEnter?: (val: string) => void;
  onOpenScanner?: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
}

const ProductSearchBar = ({
  searchTerm,
  onSearch,
  onEnter,
  onOpenScanner,
  searchInputRef,
  placeholder = 'Buscar producto...',
}: ProductSearchBarProps) => {
  return (
    <div className="flex gap-2 sm:gap-3 max-w-4xl mx-auto w-full">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} aria-hidden="true" />
        <InputText
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter(searchTerm);
            }
          }}
          className="pl-12 h-12 sm:h-14 text-base sm:text-lg bg-black/40 border-white/10 rounded-xl w-full"
        />
      </div>
      {onOpenScanner && (
        <Button
          variant="outline"
          onClick={onOpenScanner}
          aria-label="Abrir escáner de cámara"
          className="h-12 w-12 sm:h-14 sm:w-14 !p-0 shrink-0 flex items-center justify-center bg-[#1a1a24] border-white/10 hover:bg-orange-500/20 hover:border-orange-500/40 rounded-xl transition shadow-lg group"
        >
          <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
        </Button>
      )}
    </div>
  );
};

export default ProductSearchBar;
