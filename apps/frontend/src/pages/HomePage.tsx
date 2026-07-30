import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import Button from '../components/atoms/Button';
import { useAuthStore } from '../store/authStore';
import ServiceSection from '../components/ServiceSection';
import LocationSection from '../components/LocationSection';
import { heroContent } from '../constants';
import PricingSection from '../components/PricingSection';
import dashboardHero from '../assets/dashboard_hero.png';

const HomePage = () => {
  const { isAuthenticated } = useAuthStore();
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 500], [0, -100]);

  return (
    <>
      <main className="relative w-full bg-[#020617]">
        {/* LOGIN BUTTON TOP RIGHT */}
        <div className="absolute top-6 right-6 md:right-16 lg:right-24 z-50">
          <Link to={isAuthenticated ? '/dashboard' : '/login'}>
            <Button className="px-6 py-2.5 text-sm md:text-base border border-orange-500/20 backdrop-blur-sm">
              {isAuthenticated ? 'Ir al Dashboard' : 'Iniciar Sesión'}
            </Button>
          </Link>
        </div>

        {/* 1. SECCIÓN HERO */}
        <motion.section
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative w-full min-h-[90vh] flex flex-col lg:flex-row items-center justify-between text-left px-6 md:px-16 lg:px-24 pt-32 pb-20 z-20 gap-12 lg:gap-8"
        >
          {/* TEXTO IZQUIERDO */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 flex flex-col items-start"
          >
            {/* Logo */}
            <div className="mb-8 flex justify-start">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/30 backdrop-blur-xl drop-shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                <span className="text-4xl md:text-5xl drop-shadow-lg">🏪</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#f8fafc] mb-6 leading-tight flex flex-col items-start">
              <span className="mb-2 text-white">{heroContent.title}</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 text-4xl sm:text-5xl md:text-6xl lg:text-6xl mt-1">
                {heroContent.titleGradient}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed font-light italic">
              {heroContent.description}
            </p>
          </motion.div>

          {/* IMAGEN DERECHA (Mockup App) */}
          <motion.div
            style={{ perspective: 1200 }}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="w-full lg:w-1/2 relative mt-10 lg:mt-0"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/40 via-transparent to-amber-500/20 blur-[80px] rounded-[3rem] scale-110 pointer-events-none -z-10"></div>

            {/* Marco de Imagen Flotante */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
              className="relative p-2 md:p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl md:rounded-[2rem] shadow-[0_0_50px_rgba(249,115,22,0.15)]"
            >
              <motion.img
                src={dashboardHero}
                whileHover={{ rotateY: -5, rotateX: 5, scale: 1.02 }}
                transition={{ duration: 0.4 }}
                alt="Panel Administrativo Moderno"
                className="w-full h-auto rounded-xl md:rounded-3xl border border-white/5 object-cover shadow-[0_0_60px_rgba(249,115,22,0.2)]"
              />

              {/* Tag Flotante 3D */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-6 -left-4 md:-left-8 bg-[#0f0f13]/90 border border-orange-500/30 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 z-30"
              >
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                <div>
                  <p className="text-white text-xs md:text-sm font-bold">100% Sincronizado</p>
                  <p className="text-[10px] md:text-xs text-gray-400">Inventario en la Nube</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-orange-500/40 pointer-events-none z-30"
          >
            <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-orange-500/60">Hacia abajo</span>
            <div className="w-[1px] h-16 bg-gradient-to-b from-orange-500/60 to-transparent"></div>
          </motion.div>
        </motion.section>

        {/* CTA FLOTANTE PERSISTENTE */}
        <div className="fixed bottom-8 left-6 md:left-16 lg:left-24 z-50 flex flex-col sm:flex-row items-center sm:items-start justify-start gap-5 pointer-events-none w-[calc(100%-3rem)] md:w-auto">
          <Link to="https://wa.me/5804241731880" className="pointer-events-auto w-full sm:w-auto">
            <Button className="py-3 px-8 md:py-4 md:px-10 text-lg md:text-xl w-full shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:shadow-[0_0_40px_rgba(249,115,22,0.8)] transition-all">
              {heroContent.buttonPrimary}
            </Button>
          </Link>
        </div>

        {/* 2. SECCIÓN PLANES Y SUSCRIPCIONES */}
        <div className="relative w-full z-10 bg-[#020617] mt-[-10vh] pt-10">
          <PricingSection />
        </div>

        {/* WAVE DIVIDER */}
        <div className="w-full bg-white">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-[60px] md:h-[100px] lg:h-[140px] text-[#020617] block">
            <path fill="currentColor" fillOpacity="1" d="M0,128L48,133.3C96,139,192,149,288,138.7C384,128,480,96,576,101.3C672,107,768,149,864,160C960,171,1056,149,1152,122.7C1248,96,1344,64,1392,48L1440,32L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
          </svg>
        </div>

        {/* 3. SECCIÓN SERVICIOS */}
        <ServiceSection />

        {/* WAVE DIVIDER */}
        <div className="w-full bg-white">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-[60px] md:h-[100px] lg:h-[140px] text-[#020617] block">
            <path fill="currentColor" fillOpacity="1" d="M0,192L48,181.3C96,171,192,149,288,149.3C384,149,480,171,576,192C672,213,768,235,864,229.3C960,224,1056,192,1152,176C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>

        {/* 4. SECCIÓN UBICACIÓN */}
        <LocationSection />
      </main>
    </>
  );
};

export default HomePage;
