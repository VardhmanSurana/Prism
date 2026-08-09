import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

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
    const barRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // GSAP tween for smooth progress bar animation
    useEffect(() => {
        if (barRef.current) {
            gsap.to(barRef.current, {
                width: `${Math.max(2, progress)}%`,
                duration: 0.8,
                ease: 'power2.out',
                overwrite: 'auto',
            });
        }
    }, [progress]);

    // Entrance animation
    useEffect(() => {
        if (containerRef.current && isScanning && progress > 0 && progress < 100) {
            gsap.fromTo(containerRef.current,
                { x: 20, autoAlpha: 0 },
                { x: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' }
            );
        }
    }, [isScanning, progress]);

    if (!isScanning && progress === 0) return null;
    if (!isScanning && progress === 100) return null;

    return (
        <div ref={containerRef} className="pointer-events-auto">
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
                    <div 
                        ref={barRef} 
                        className={`h-full ${color}`}
                        style={{ width: '2%' }}
                    />
                </div>

                <p className="mt-2 text-[9px] text-gray-500 font-medium">
                    {progress === 100 ? 'Process complete' : 'This might take a while'}
                </p>
            </div>
        </div>
    );
};
