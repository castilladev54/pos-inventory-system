import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, RefreshCw, Volume2, VolumeX } from "lucide-react";
import Button from "./atoms/Button";
import toast from "react-hot-toast";

const BarcodeScanner = ({ onScan, onClose, isOpen, continuous = false }) => {
  const scannerRef = useRef(null);
  const [cameraFacingMode, setCameraFacingMode] = useState("environment"); // default back camera
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [permissionError, setPermissionError] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const multiplierRef = useRef(multiplier);
  const lastScanRef = useRef({ text: null, time: 0 });

  // Update ref when state changes
  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error(e);
    }
  }, [soundEnabled]);

  const startScanner = useCallback(async (facingMode) => {
    setPermissionError(null);
    if (!scannerRef.current) {
      try {
        scannerRef.current = new Html5Qrcode("scanner-container");
      } catch (e) {
        console.error("No se encontró el contenedor del escáner", e);
        setPermissionError("No se pudo inicializar el escáner.");
        return;
      }
    }

    if (scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Error al detener escáner anterior:", e);
      }
    }

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0,
    };

    try {
      await scannerRef.current.start(
        { facingMode },
        config,
        (decodedText) => {
          const now = Date.now();
          if (continuous) {
            if (lastScanRef.current.text === decodedText && (now - lastScanRef.current.time) < 1500) {
              return; // Ignorar lecturas duplicadas rápidas
            }
            lastScanRef.current = { text: decodedText, time: now };
          }

          playBeep();
          if (navigator.vibrate) navigator.vibrate(200);
          onScan(decodedText, multiplierRef.current);

          if (!continuous) {
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current.stop().then(() => {
                onClose();
              }).catch(console.error);
            } else {
              onClose();
            }
          }
        },
        () => {
          // ignorar errores constantes de stream de escaneo
        }
      );
    } catch (err) {
      console.error("Camera error:", err);
      let errorMsg = "Error al acceder a la cámara.";

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Permiso denegado. Por favor, permite el acceso a la cámara en tu navegador.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No se detectó ninguna cámara en este dispositivo.";
      }

      setPermissionError(errorMsg);
      toast.error(errorMsg);
    }
  }, [continuous, onScan, onClose, playBeep]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      // Delay for modal container to mount into DOM
      const timer = setTimeout(() => {
        if (isMounted) startScanner(cameraFacingMode);
      }, 150);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current) {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
          }
          try {
            scannerRef.current.clear();
          } catch (e) { }
          scannerRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleCamera = () => {
    const newMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(newMode);
    startScanner(newMode);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-lg bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-orange-500" />
              <h3 className="text-lg font-bold text-white">Escanear Código</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Silenciar" : "Activar Sonido"}>
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </Button>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Multiplier Chips Selector */}
          <div className="flex items-center justify-center gap-2 p-3 bg-black/40 border-b border-white/5 overflow-x-auto hide-scrollbar">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-2">Cantidad:</span>
            {[1, 2, 3, 5, 10, 20].map((num) => (
              <button
                key={num}
                onClick={() => setMultiplier(num)}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 border-2
                  ${multiplier === num
                    ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-110"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/10"}`}
              >
                {num}x
              </button>
            ))}
          </div>

          {/* Scanner Area */}
          <div className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
            <div id="scanner-container" className="w-full h-full"></div>

            {/* Overlay/Target Frame */}
            {!permissionError && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-[260px] h-[160px] border-2 border-orange-500/50 rounded-xl relative">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg"></div>

                  {/* Scanning Animation Line */}
                  <motion.div
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute left-2 right-2 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,1)] z-10"
                  />
                </div>
                <p className="text-white/60 text-xs mt-6 font-medium tracking-widest uppercase">Alinea el código de barras aquí</p>
              </div>
            )}

            {/* Error Message with Instructions */}
            {permissionError && (
              <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#1a1a24]/90 backdrop-blur-sm z-20">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                    <Camera size={32} />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">Cámara Bloqueada</h4>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    Para usar el escáner, haz clic en el icono del <b>candado 🔒</b> en la barra de direcciones y activa la <b>Cámara</b>.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button
                      variant="primary"
                      onClick={() => startScanner(cameraFacingMode)}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <RefreshCw size={18} className="mr-2" /> Reintentar
                    </Button>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white text-sm font-medium transition"
                    >
                      Cerrar Escáner
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-6 flex justify-center gap-4 bg-black/40">
            <Button variant="secondary" onClick={toggleCamera} className="gap-2 bg-white/5 border-white/10">
              <RefreshCw size={18} /> Cambiar Cámara
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BarcodeScanner;
