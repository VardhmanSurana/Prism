import React from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { springs, motionTokens } from '../../lib/motion-tokens';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, disabled }) => {
  return (
    <div className="p-4 border-t border-white/5 bg-white/[0.02]">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Ask Prism to find something..."
          className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-4 pr-14 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white placeholder-gray-500 font-semibold"
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={springs.snappy as any}
          onClick={onSend}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl disabled:opacity-30 disabled:hover:bg-white/10 transition-all shadow-sm"
        >
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
};