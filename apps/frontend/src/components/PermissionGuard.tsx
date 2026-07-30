import { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserPermission } from '@inventory/shared';

interface PermissionGuardProps {
  requiredPermission?: UserPermission;
  children: ReactNode;
  fallback?: ReactNode;
}

const PermissionGuard = ({ requiredPermission, children, fallback = null }: PermissionGuardProps) => {
  const { user } = useAuthStore();

  if (!user) return fallback;

  // Dueños (customer) y Admins (admin) tienen acceso total e ilimitado a todo
  if (user.role === 'customer' || user.role === 'admin') {
    return children;
  }

  // Empleados verifican su lista de permisos granulares
  if (user.role === 'employee') {
    if (!requiredPermission || user.permissions?.includes(requiredPermission)) {
      return children;
    }
  }

  return fallback;
};

export default PermissionGuard;
