import { useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import Input from '../components/atoms/Input';
import { Lock } from 'lucide-react';
import Button from '../components/atoms/Button';
import toast from 'react-hot-toast';
import { authContent } from '../constants';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { resetPassword, error, isLoading, message } = useAuthStore();

  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      if (!token) {
        toast.error('Token no válido');
        return;
      }
      await resetPassword(token, password);
      toast.success('Password reset successfully, redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
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
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          {authContent.resetPassword.title}
        </h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {message && <p className="text-green-500 text-sm mb-4">{message}</p>}

        <form onSubmit={handleSubmit}>
          <Input
            icon={Lock}
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            icon={Lock}
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button
            className="w-full"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? authContent.resetPassword.loading : authContent.resetPassword.button}
          </Button>
        </form>
      </div>
    </motion.div>
  );
};
export default ResetPasswordPage;
