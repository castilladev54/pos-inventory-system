import React from 'react';
import { motion } from 'framer-motion';

const LocationSection = () => {
  return (
    <section className="relative w-full min-h-[500px] py-24 bg-[#020617] overflow-hidden" id="ubicacion" aria-labelledby="location-title">
      {/* Ambient Glow Effects */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0">
        <div className="absolute left-[-10%] top-[20%] w-[50vw] h-[50vw] bg-orange-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute right-[-10%] bottom-[-10%] w-[40vw] h-[40vw] bg-amber-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-16 lg:px-24">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center md:text-left"
        >
          <h2 id="location-title" className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
            Nuestra Ubicación
          </h2>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl font-light">
            Operamos desde el corazón de Caracas, Venezuela. Visítanos o contáctanos para llevar la gestión de tu negocio al siguiente nivel.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Information Column */}
          <motion.article
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-5 flex flex-col gap-6"
          >
            {/* Address Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-md hover:border-orange-500/40 hover:bg-white/[0.05] transition-all duration-300">
              <header className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xl border border-orange-500/20">
                  📍
                </div>
                <h3 className="text-xl font-semibold text-white/90">Dirección</h3>
              </header>
              <p className="text-slate-300 leading-relaxed font-light text-lg">
                <strong className="font-medium text-orange-200 block mb-1">CastillaWeb SaaS</strong>
                Caracas, Distrito Capital<br />
                Venezuela 🇻🇪
              </p>
            </div>

            {/* Business Hours Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-md hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300">
              <header className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xl border border-amber-500/20">
                  🕰️
                </div>
                <h3 className="text-xl font-semibold text-white/90">Horario de Atención</h3>
              </header>
              <ul className="text-slate-300 font-light space-y-3 text-lg">
                <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span>Lunes - Viernes</span>
                  <span className="font-medium">8:00 AM - 6:00 PM</span>
                </li>
                <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span>Sábados</span>
                  <span className="font-medium">9:00 AM - 2:00 PM</span>
                </li>
                <li className="flex justify-between items-center pt-1">
                  <span>Emergencias</span>
                  <span className="text-orange-400 font-bold tracking-wide">24/7</span>
                </li>
              </ul>
            </div>
          </motion.article>

          {/* Map Interface Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="lg:col-span-7 relative w-full h-[450px] lg:h-[550px] rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.1)] border border-white/10 group"
          >
            {/* Map decorative overlay for edge blending */}
            <div className="absolute inset-0 border-[8px] border-[#020617]/50 rounded-[2rem] pointer-events-none z-10 transition-colors duration-500 group-hover:border-transparent"></div>

            <iframe
              src="https://maps.google.com/maps?q=Caracas%2C+Venezuela&t=&z=13&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              style={{
                border: 0,
                // CSS filter to create a dark mode map that fits the theme perfectly
                filter: 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) sepia(10%)'
              }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa Interactivo de Ubicación de CastillaWeb en Caracas"
            ></iframe>

            {/* subtle pulsing indicator on map */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#020617]/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Caracas, VE</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LocationSection;
