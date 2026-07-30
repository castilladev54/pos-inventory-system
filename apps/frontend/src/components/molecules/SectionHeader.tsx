import { ReactNode } from 'react';
import Button from '../atoms/Button';

interface SectionHeaderProps {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  onAdd?: () => void;
  addLabel?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const SectionHeader = ({
  id,
  title,
  icon,
  onAdd,
  addLabel = 'Agregar',
  actions,
  className = '',
}: SectionHeaderProps) => (
  <header
    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 ${className}`}
  >
    <h2
      id={id}
      className="text-2xl sm:text-3xl font-bold text-white tracking-wide flex items-center gap-2"
    >
      {icon && <span className="text-orange-500">{icon}</span>}
      {title}
    </h2>

    {actions ?? (
      onAdd && (
        <Button variant="primary" onClick={onAdd} className="w-full sm:w-auto">
          {addLabel}
        </Button>
      )
    )}
  </header>
);

export default SectionHeader;
