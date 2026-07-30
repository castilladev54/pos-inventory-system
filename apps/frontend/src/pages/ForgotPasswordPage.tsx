import { motion } from 'framer-motion';
import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import Input from '../components/atoms/Input';
import { ArrowLeft, Loader, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/atoms/Button';
import { authContent } from '../constants';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { isLoading, forgotPassword } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await forgotPassword(email);
    setIsSubmitted(true);
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
          {authContent.forgotPassword.title}
        </h2>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit}>
            <p className="text-white/60 mb-6 text-center">
              {authContent.forgotPassword.subtitle}
            </p>
            <Input
              icon={Mail}
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button className="w-full" type="submit">
              {isLoading ? <Loader className="size-6 animate-spin mx-auto" /> : authContent.forgotPassword.button}
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/50"
            >
              <Mail className="h-8 w-8" />
            </motion.div>
            <p className="text-white/60 mb-6">
              {authContent.forgotPassword.successText} {email} {authContent.forgotPassword.successSubText}
            </p>
          </div>
        )}
      </div>

      <div className="px-8 py-4 bg-white/5 border-t border-white/10 flex justify-center relative z-10">
        <Link to="/login" className="text-sm text-amber-500 hover:text-amber-400 hover:underline flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" /> {authContent.forgotPassword.backToLogin}
        </Link>
      </div>
    </motion.div>
  );
};
export default ForgotPasswordPage;
