import React from 'react';
import { motion } from 'framer-motion';
import { motionTokens } from '../lib/motion-tokens';

export const AgentLogo: React.FC<{ className?: string }> = ({ className }) => {
  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        duration: motionTokens.duration.slow,
        ease: motionTokens.easing.smooth as [number, number, number, number],
      }
    }
  };

  return (
    <div className={`relative w-12 h-12 flex items-center justify-center ${className}`}>
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round"
        className="text-primary"
      >
        {/* Pair 1 - Top Center / Right Side */}
        <motion.path 
          d="M 10 10 L 22 10" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
        />
        <motion.path 
          d="M 22 10 L 22 22" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
        />
        
        {/* Pair 2 - Rotated 120 deg */}
        <motion.path 
          d="M 11 26 L 5 16" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
        />
        <motion.path 
          d="M 5 16 L 11 6" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        />
        
        {/* Pair 3 - Rotated 240 deg */}
        <motion.path 
          d="M 27 16 L 21 26" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
        />
        <motion.path 
          d="M 21 6 L 27 16" 
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.5 }}
        />
      </svg>
      
      {/* Dynamic Glow */}
      <motion.div 
        className="absolute inset-0 bg-primary/20 rounded-full blur-xl -z-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};
