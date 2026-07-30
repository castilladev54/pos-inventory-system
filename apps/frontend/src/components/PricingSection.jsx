import { motion } from "framer-motion";
import { CheckCircle2, Zap, Star, Crown } from "lucide-react";

const plans = [
  {
    name: "Emprendedor",
    price: "19.99",
    description: "Ideal para pequeños negocios y tiendas emergentes.",
    icon: <Star className="w-8 h-8 text-amber-500" />,
    features: [
      "1 Usuario Administrador",
      "Hasta 500 productos",
      "Control de stock básico",
      "Soporte vía Email",
      "Ventas convencionales"
    ],
    highlighted: false,
    delay: 0.1
  },
  {
    name: "Profesional",
    price: "29.99",
    description: "El balance perfecto. Diseñado para minimarkets y comercios.",
    icon: <Zap className="w-8 h-8 text-amber-400" />,
    features: [
      "Cajeros múltiples",
      "Inventario Ilimitado",
      "Venta a granel (Kg, Litros)",
      "Panel Analítico Avanzado",
      "Soporte Prioritario 24/7"
    ],
    highlighted: true,
    delay: 0.2
  },
  {
    name: "Corporativo",
    price: "Dime",
    description: "Para cadenas de supermercados y franquicias en expansión.",
    icon: <Crown className="w-8 h-8 text-orange-500" />,
    features: [
      "Sucursales infinitas",
      "Facturación Fiscal Integrada",
      "Soporte API dedicada",
      "Servidor Exclusivo",
      "Asesoramiento presencial"
    ],
    highlighted: false,
    delay: 0.3
  }
];

const PricingSection = () => {
  return (
    <section className="relative w-full py-24 bg-[#020617] overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent mb-6"
          >
            Escala con un software a tu medida
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-400"
          >
            Olvídate de las licencias costosas y los mantenimientos difíciles. Nuestro ecosistema SaaS crece contigo.
            Tu primer registro incluye 7 días de prueba desbloqueada.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: plan.delay, duration: 0.5 }}
              whileHover={{ y: -10 }}
              className={`relative rounded-3xl p-8 backdrop-blur-xl border transition-all duration-300 ${plan.highlighted ? 'bg-gradient-to-b from-[#1a1a24] to-[#0f0f13] border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.15)] md:scale-105 z-10' : 'bg-[#0f0f13]/80 border-white/10 hover:border-white/20'}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full shadow-lg">
                  Más Popular
                </div>
              )}

              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-400 h-10">{plan.description}</p>
                </div>
                <div className="shrink-0 p-3 bg-white/5 rounded-2xl border border-white/10 ml-4">
                  {plan.icon}
                </div>
              </div>

              <div className="mb-8 p-4 bg-black/40 rounded-2xl border border-white/5">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold text-white">
                    {plan.price === "Dime" ? "A Medida" : `$${plan.price}`}
                  </span>
                  {plan.price !== "Dime" && <span className="text-gray-400 mb-1">/ mensual</span>}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.highlighted ? 'text-amber-400' : 'text-orange-500/50'}`} />
                    <span className="text-sm font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              <a href="https://wa.me/5804241731880" target="_blank" rel="noreferrer" className="block w-full">
                <button className={`w-full py-4 rounded-xl font-bold transition-all duration-300 ${plan.highlighted ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  {plan.price === "Dime" ? "Contactar Ventas" : "Quiero empezar"}
                </button>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
