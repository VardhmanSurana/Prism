import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '../../lib/motion-tokens';

interface MessageRevealProps {
  text: string;
  role: 'assistant' | 'user';
}

export const MessageReveal: React.FC<MessageRevealProps> = ({ text, role }) => {
  if (role === 'user') return <>{text}</>;

  const words = text.split(' ');
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.02 } }
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-1"
          variants={{
            hidden: { opacity: 0, y: 5 },
            visible: { opacity: 1, y: 0, transition: springs.gentle as any }
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};