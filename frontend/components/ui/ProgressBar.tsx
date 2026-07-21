import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { springs } from '@/lib/motion-tokens';

interface ProgressBarProps {
    progress: number;
    total: number;
    processed: number;
    isScanning: boolean;
    label?: string;
    color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    total,
    processed,
    isScanning,
    label = 'Syncing Memories...',
    color = 'bg-primary'
}) => {
    const springProgress = useSpring(0, springs.gentle);
    const barWidth = useTransform(springProgress, (v) => `${Math.max(2, v)}%`);

    // Drive the spring whenever the progress prop changes
    useEffect(() => {
        springProgress.set(progress);
    }, [progress, springProgress]);

    if (!isScanning && progress === 0) return null;
    if (!isScanning && progress === 100) return null;

    return (
        <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="pointer-events-auto"
        >
            <div className="bg-surface border border-white/5 p-4 rounded-2xl shadow-2xl w-72">
                <div className="flex items-center justify-between mb-2">
                    <span
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                            color.includes('primary') ? 'text-primary' : 'text-gray-300'
                        }`}
                    >
                        {progress < 1 && isScanning && label.includes('Syncing') ? 'Discovering Library...' : label}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                        {processed} / {total}
                    </span>
                </div>

                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div className={`h-full ${color}`} style={{ width: barWidth }} />
                </div>

                <p className="mt-2 text-[9px] text-gray-500 font-medium">
                    {progress === 100 ? 'Process complete' : 'This might take a while'}
                </p>
            </div>
        </motion.div>
    );
};
