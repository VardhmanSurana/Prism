import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Calendar, Lock, Image as ImageIcon } from 'lucide-react';
import { springs, motionTokens } from '../../lib/motion-tokens';
import { Suggestion } from './types';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onSend: (text: string) => void;
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({ suggestions, onSend }) => {
  const iconMap: Record<string, React.ElementType> = {
    'Show my favorite photos': Heart,
    'Find photos from 2024': Calendar,
    'Search locked photos': Lock,
    'Show all my images': ImageIcon,
  };

  return (
    <div className="p-4 border-t border-white/5 space-y-2 bg-white/[0.01]">
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((s, idx) => {
          const Icon = iconMap[s.text] || ImageIcon;
          return (
            <motion.button
              key={idx}
              whileHover={{ scale: motionTokens.scale.hover }}
              whileTap={{ scale: motionTokens.scale.press }}
              transition={springs.snappy as any}
              onClick={() => onSend(s.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            >
              <Icon size={12} />
              <span>{s.text}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};