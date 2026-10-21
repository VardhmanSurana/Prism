import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😂', '🥰', '😎', '🤩', '😊', '🙂', '😉', '🤔', '😤', '😴', '🥳', '😇', '🤪', '😬', '🤯'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💖', '💗', '💝', '💘', '💞', '💓'],
  'Gestures': ['👍', '👎', '👋', '✌️', '🤝', '🙏', '💪', '👏', '🫶', '🤙', '🤞', '🫡', '☝️', '👆', '👇', '👈'],
  'Objects': ['⭐', '🔥', '✨', '💡', '🎉', '🎊', '🏆', '🎵', '📸', '🌟', '💫', '🌈', '☀️', '🌙', '⚡', '❄️'],
  'Food': ['🍕', '🍔', '🌮', '🍣', '🍰', '☕', '🍺', '🍷', '🥤', '🍎', '🍓', '🥑', '🍿', '🧁', '🍩', '🍪'],
  'Nature': ['🌸', '🌺', '🌻', '🌹', '🍀', '🌿', '🌵', '🍁', '🍂', '🌊', '🏔️', '🌅', '🦋', '🐝', '🐾', '🐛'],
};

/**
 * EmojiPicker - Renders emoji picker.
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [activeCategory, setActiveCategory] = useState('Smileys');

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeCategory === cat ? 'bg-primary text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, i) => (
          <motion.button
            key={`${activeCategory}-${i}`}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-lg transition-colors"
          >
            {emoji}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
