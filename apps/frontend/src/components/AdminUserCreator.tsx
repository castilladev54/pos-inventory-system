import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  UserPlus, Mail, Lock, User,
  ShieldCheck, Trash2, AlertOctagon,
} from 'lucide-react';

import Input from './atoms/Input';
import Button from './atoms/Button';
import ConfirmDialog from './molecules/ConfirmDialog';

/* ── Guard: acceso denegado ── */
const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center p-8 mt-20 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-2xl mx-auto">
    <ShieldCheck className="w-16 h-16 text-red-500 mb-4" aria-hidden="true" />
    <h2 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h2>
    <p className="text-gray-400 text-center">
      No tienes los permisos necesarios para realizar esta acción.
    </p>
  </div>
);

/* ── Componente principal ── */
const AdminUserCreator = () => {
  const { createUserByAdmin, purgeUser, isLoading, user } = useAuthStore();

  // Formulario crear usuario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Flujo de purga
  const [purgeUserId, setPurgeUserId] = useState('');
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  /* ── Handlers ── */
  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    toast.promise(
      createUserByAdmin(name, email, password),
      {
        loading: 'Creando cuenta de cliente...',
        success: () => {
          setName('');
          setEmail('');
          setPassword('');
          return 'Usuario creado silenciosamente. Suscripción de 7 días activa.';
        },
        error: (err: any) => err.response?.data?.message || 'Error al crear usuario',
      }
    );
  };

  const handlePurgeUser = async () => {
    toast.promise(
      purgeUser(purgeUserId),
      {
        loading: 'Purgando todos los datos del inquilino...',
        success: () => {
          setPurgeUserId('');
          setShowPurgeModal(false);
          return 'Usuario y todos sus datos han sido purgados exitosamente.';
        },
        error: (err: any) => {
          setShowPurgeModal(false);
          return err.response?.data?.message || 'Error al purgar usuario';
        },
      }
    );
  };

  const openPurgeModal = () => {
    if (!purgeUserId.trim()) return toast.error('Ingresa un ID válido primero');
    setShowPurgeModal(true);
  };

  /* ── Guard de rol ── */
  if (user?.role !== 'admin') return <AccessDenied />;

  /* ── Render ── */
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Título */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Crear Nuevo Cliente
          </h1>
          <p className="text-gray-400 mt-2">
            Registra un nuevo usuario directamente. Se activará su plan de 7 días al instante.
          </p>
        </div>
      </motion.header>

      {/* Formulario de creación */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-labelledby="create-user-heading"
        className="bg-[#0f0f13]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl"
      >
        <div className="max-w-md mx-auto">
          <h2 id="create-user-heading" className="sr-only">Formulario de registro de cliente</h2>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <Input icon={User} type="text" placeholder="Nombre Completo" value={name} onChange={(e) => setName(e.target.value)} />
            <Input icon={Mail} type="email" placeholder="Correo Electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input icon={Lock} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full mt-6 py-3"
            >
              <UserPlus className="w-5 h-5" />
              Registrar Cliente
            </Button>
          </form>

          <aside className="mt-8 p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl">
            <p className="text-sm text-orange-400/80 text-center italic">
              "A diferencia del registro normal, esto no cierra tu sesión de Admin ni inicia la del cliente. Puedes seguir registrando más usuarios."
            </p>
          </aside>
        </div>
      </motion.section>

      {/* Zona de peligro */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        aria-labelledby="danger-zone-heading"
        className="bg-black/40 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 shadow-xl relative overflow-hidden"
      >
        {/* Acento rojo lateral */}
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600" aria-hidden="true" />

        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-8 h-8 text-red-500 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="danger-zone-heading" className="text-xl font-bold text-red-500">Zona de Peligro</h2>
              <p className="text-xs text-red-400/80">Acciones destructivas e irreversibles.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              icon={User}
              type="text"
              placeholder="ID del Cliente/Empleado a Purgar"
              value={purgeUserId}
              onChange={(e) => setPurgeUserId(e.target.value)}
            />

            <Button
              variant="danger"
              isLoading={isLoading}
              onClick={openPurgeModal}
              className="w-full py-3 justify-center bg-red-600 hover:bg-red-700 border-0"
            >
              <Trash2 className="w-5 h-5" />
              Purgar Usuario
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Confirmación de purga */}
      <ConfirmDialog
        isOpen={showPurgeModal}
        confirmLabel="Sí, Purgarlo Todo"
        cancelLabel="Cancelar"
        message="¿Estás seguro?"
        detail={
          <>
            Se borrarán <strong className="text-red-400 font-bold uppercase">cada una</strong> de sus ventas, compras y productos <strong className="text-red-400 font-bold">para siempre</strong> y no pueden recuperarse.
          </>
        }
        onConfirm={handlePurgeUser}
        onCancel={() => setShowPurgeModal(false)}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AdminUserCreator;
