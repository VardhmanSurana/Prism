import React from 'react';
import { Shield, Loader2, ShieldAlert, Zap } from 'lucide-react';

interface SystemIntegrityProps {
  isResetting: boolean;
  onReset: () => void;
  systemStatus: string | null;
}

export const SystemIntegrity: React.FC<SystemIntegrityProps> = ({
  isResetting,
  onReset,
  systemStatus
}) => {
  return (
    <section className="reveal-item space-y-6" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center gap-3 mb-2">
        <Shield size={20} className="text-primary" />
        <h3 className="text-xl font-serif italic text-white">Core Integrity</h3>
      </div>
      
      <div 
        onClick={!isResetting ? onReset : undefined}
        className={`bg-surface border border-white/5 rounded-[2.5rem] p-8 flex items-center justify-between group transition-all ${isResetting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'}`}
      >
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center ${isResetting ? 'text-rose-500' : 'text-primary'}`}>
            {isResetting ? <Loader2 size={28} className="animate-spin" /> : <ShieldAlert size={28} />}
          </div>
          <div>
            <p className="text-white text-lg font-medium">System Reset</p>
            <p className="text-xs text-gray-500 max-w-xs">Completely purge the thumbnail cache and clear the photo library database. This action is irreversible.</p>
          </div>
        </div>
        {!isResetting && (
          <div className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl group-hover:bg-rose-500 group-hover:border-rose-500 transition-all duration-300">
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 group-hover:text-white transition-colors">Execute Purge</span>
            <Zap size={14} className="text-rose-500 group-hover:text-white transition-colors" />
          </div>
        )}
      </div>

      {systemStatus && (
        <p className={`text-xs font-mono tracking-wider animate-in fade-in pt-2 ${systemStatus.startsWith('✓') ? 'text-emerald-400' : systemStatus.startsWith('✗') ? 'text-rose-400' : 'text-gray-400'}`}>
          {systemStatus}
        </p>
      )}
    </section>
  );
};
