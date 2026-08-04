import { CheckCircle2, Shield, Zap } from 'lucide-react';

const PlansView = () => {
  return (
    <div className="p-6 md:p-8 animate-fade-in text-white max-w-7xl mx-auto">
      <div className="mb-8 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-600 mb-4">
          Nuestros Planes
        </h1>
        <p className="text-gray-400 text-lg">
          Elige el plan que mejor se adapte a las necesidades de tu negocio.
          Actualiza tu suscripción en cualquier momento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        {/* Plan Básico */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-8 hover:border-orange-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-gray-400" size={24} />
            <h3 className="text-xl font-bold text-gray-200">Básico</h3>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-extrabold text-white">$15</span>
            <span className="text-gray-500">/mes</span>
          </div>
          <p className="text-gray-400 mb-8 text-sm">Ideal para emprendedores y pequeñas tiendas que recién empiezan.</p>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>1 Sucursal</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Hasta 3 Usuarios</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Soporte estándar</span>
            </li>
          </ul>
          
          <button className="w-full py-3 px-4 rounded-xl font-bold border border-white/10 text-white hover:bg-white/5 transition-colors">
            Plan Actual
          </button>
        </div>

        {/* Plan Pro */}
        <div className="bg-gradient-to-b from-orange-500/20 to-black/40 border border-orange-500/50 rounded-3xl p-8 relative transform md:-translate-y-4 shadow-[0_0_40px_rgba(249,115,22,0.15)]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Recomendado
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Zap className="text-orange-400" size={24} />
            <h3 className="text-xl font-bold text-orange-400">Pro</h3>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-extrabold text-white">$45</span>
            <span className="text-gray-500">/mes</span>
          </div>
          <p className="text-gray-300 mb-8 text-sm">Para negocios en crecimiento que necesitan más control.</p>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3 text-sm text-gray-200">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Hasta 5 Sucursales</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-200">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Usuarios Ilimitados</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-200">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Soporte prioritario 24/7</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-200">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Módulo de IA Avanzado</span>
            </li>
          </ul>
          
          <button className="w-full py-3 px-4 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all">
            Actualizar Plan
          </button>
        </div>

        {/* Plan Enterprise */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-8 hover:border-orange-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Store className="text-gray-400" size={24} />
            <h3 className="text-xl font-bold text-gray-200">Enterprise</h3>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-extrabold text-white">$99+</span>
            <span className="text-gray-500">/mes</span>
          </div>
          <p className="text-gray-400 mb-8 text-sm">Solución completa para cadenas y grandes comercios.</p>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Sucursales Ilimitadas</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Integración API a medida</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2 className="text-orange-500 shrink-0" size={18} />
              <span>Account Manager dedicado</span>
            </li>
          </ul>
          
          <button className="w-full py-3 px-4 rounded-xl font-bold border border-white/10 text-white hover:bg-white/5 transition-colors">
            Contactar Ventas
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlansView;
