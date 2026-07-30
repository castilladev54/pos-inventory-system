import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import Input from '../components/atoms/Input';
import Button from '../components/atoms/Button';
import { useAuthStore } from '../store/authStore';
import { authContent } from '../constants';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-orange-600/0 via-amber-500/0 to-orange-600/0 group-hover:from-orange-600/20 group-hover:via-amber-500/10 group-hover:to-orange-600/20 blur-2xl transition-all duration-500 -z-10 rounded-2xl"></div>
      <div className="p-8 relative">
        <h2 className="text-3xl font-bold mb-2 text-center text-white">
          {authContent.login.title}
        </h2>
        <p className="text-white/60 text-center mb-6">{authContent.login.subtitle}</p>

        <form onSubmit={handleLogin}>
          <Input
            icon={Mail}
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            icon={Lock}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex items-center mb-6">
            <Link to="/forgot-password" className="text-sm text-amber-500 hover:text-amber-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-red-500 font-semibold mb-2">{error}</p>}

          <Button
            className="w-full mt-2"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader className="w-6 h-6 animate-spin mx-auto" /> : authContent.login.button}
          </Button>
        </form>
      </div>
      <div className="px-8 py-4 bg-white/5 border-t border-white/10 flex justify-center relative z-10">
        <p className="text-sm text-white/60">
          {authContent.login.footer}
        </p>
      </div>
    </motion.div>
  );
};
export default LoginPage;
