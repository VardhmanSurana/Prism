import React from 'react';

interface ProgressBarProps {
    progress: number;
    total: number;
    processed: number;
    isScanning: boolean;
    label?: string;
    color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
    progress, total, processed, isScanning, 
    label = 'Syncing Memories...',
    color = 'bg-primary'
}) => {
    if (!isScanning && progress === 0) return null;
    if (!isScanning && progress === 100) return null; // Hide when done

    return (
        <div className="animate-in slide-in-from-right-5">
            <div className="bg-surface/90 backdrop-blur-md border border-border p-4 rounded-2xl shadow-2xl w-72">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${color.includes('primary') ? 'text-primary' : ''}`}>
                        {progress < 1 && isScanning && label.includes('Syncing') ? 'Discovering Library...' : label}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                        {processed} / {total}
                    </span>
                </div>
                
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${color} transition-all duration-500 ease-out`}
                        style={{ width: `${Math.max(2, progress)}%` }}
                    />
                </div>

                <p className="mt-2 text-[9px] text-gray-500 font-medium">
                    {progress === 100 ? 'Process complete' : 'This might take a while'}
                </p>
            </div>
        </div>
    );
};