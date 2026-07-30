import { motion } from 'framer-motion';

export const AiTypingIndicator = () => (
  <div className="flex space-x-1 p-3 bg-gray-800/50 backdrop-blur-md rounded-2xl w-16 items-center justify-center border border-gray-700/50 shadow-sm mt-2">
    {([0, 1, 2] as const).map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-green-400 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
      />
    ))}
  </div>
);
