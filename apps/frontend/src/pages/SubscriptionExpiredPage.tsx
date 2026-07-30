import { motion } from 'framer-motion';
import { AlertTriangle, CreditCard, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const SubscriptionExpiredPage = () => {
  const { logout } = useAuthStore();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#0f0f13]/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
            Suscripción Expirada
          </h1>

          <p className="text-gray-400 mb-8 leading-relaxed">
            Tu período de prueba de 7 días o suscripción actual ha concluido. Para continuar gestionando tu inventario y habilitar nuevamente las ventas, renueva tu plan.
          </p>

          <div className="w-full space-y-4">
            <button className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-500/20 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 focus:ring-offset-[#0f0f13] transition-all duration-300">
              <CreditCard className="w-5 h-5 mr-2" />
              Renovar Plan
            </button>

            <button
              onClick={() => logout()}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-white/5 hover:border-white/10 rounded-xl text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-300"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionExpiredPage;
