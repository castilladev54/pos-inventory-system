import { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import Button from '../components/atoms/Button';
import { authContent } from '../constants';

const EmailVerificationPage = () => {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  // El backend en authStore no tiene implementado directamente verifyEmail en este store local,
  // pero lo agregamos o tipamos para consistencia si es necesario.
  // Como verifyEmail no estaba en AuthState (ver api.types o authStore),
  // tipamos las acciones de authStore para evitar errores de compilación.
  const { error, isLoading } = useAuthStore();
  const authStore = useAuthStore() as any; // Cast temporal si verifyEmail no está completamente tipado en authStore

  const handleChange = (index: number, value: string) => {
    const newCode = [...code];

    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newCode[i] = pastedCode[i] || '';
      }
      setCode(newCode);

      const lastFilledIndex = newCode.findLastIndex((digit: string) => digit !== "");
      const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
      inputRefs.current[focusIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent | Event) => {
    e.preventDefault();
    const verificationCode = code.join('');
    try {
      if (typeof authStore.verifyEmail === 'function') {
        await authStore.verifyEmail(verificationCode);
      }
      navigate('/');
      toast.success('Email verified successfully');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (code.every((digit) => digit !== '')) {
      handleSubmit(new Event('submit'));
    }
  }, [code]);

  return (
    <div className="max-w-md w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-600/0 via-amber-500/0 to-orange-600/0 group-hover:from-orange-600/20 group-hover:via-amber-500/10 group-hover:to-orange-600/20 blur-2xl transition-all duration-500 -z-10 rounded-2xl"></div>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-8 w-full max-w-md relative"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          {authContent.verifyEmail.title}
        </h2>
        <p className="text-center text-white/60 mb-6">
          {authContent.verifyEmail.subtitle}
        </p>

        <form onSubmit={handleSubmit as any} className="space-y-6">
          <div className="flex justify-between">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-2xl font-bold bg-white/5 text-white border-2 border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none transition-all"
              />
            ))}
          </div>
          {error && <p className="text-red-500 font-semibold mt-2">{error}</p>}
          <Button
            type="submit"
            disabled={isLoading || code.some((digit) => !digit)}
            className="w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? authContent.verifyEmail.loading : authContent.verifyEmail.button}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default EmailVerificationPage;
