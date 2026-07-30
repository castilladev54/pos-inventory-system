import { useState, FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface AiInputAreaProps {
  onSend: (question: string) => void;
  isProcessing: boolean;
}

export const AiInputArea = ({ onSend, isProcessing }: AiInputAreaProps) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      onSend(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center space-x-2 bg-gray-800/60 p-2 rounded-2xl border border-gray-700/50 backdrop-blur-md shadow-inner"
    >
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Pregunta sobre ventas o stock..."
        disabled={isProcessing}
        className="flex-1 bg-transparent text-gray-200 placeholder-gray-400 px-3 py-2 outline-none focus:ring-0 text-sm disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!inputValue.trim() || isProcessing}
        className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center ${
          !inputValue.trim() || isProcessing
            ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20 hover:scale-105'
        }`}
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </form>
  );
};
