import FloatingShape from "./FloatingShape";

const NebulaBackground = () => {
  return (
    <div className="absolute inset-0 z-0">
      {/* Orbes de luz */}
      <FloatingShape
        color="bg-orange-600/20"
        size="w-[500px] h-[500px]"
        top="-10%"
        left="-5%"
        delay={0}
      />
      <FloatingShape
        color="bg-amber-500/10"
        size="w-[400px] h-[400px]"
        top="60%"
        left="75%"
        delay={5}
      />
      <FloatingShape
        color="bg-orange-900/30"
        size="w-[300px] h-[300px]"
        top="30%"
        left="10%"
        delay={2}
      />

      {/* Capa de Textura (Ruido) Cinematográfico - 3% Opacidad */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" />

      {/* Overlay sutil para mejorar el contraste del contenido */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050300]/80 pointer-events-none" />
    </div>
  );
};

export default NebulaBackground;
