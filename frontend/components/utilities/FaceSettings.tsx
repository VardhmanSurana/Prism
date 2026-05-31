import React from 'react';
import { Users, Zap, Search } from 'lucide-react';

interface FaceSettingsProps {
  onTriggerSync: () => void;
  status: string | null;
}

export const FaceSettings: React.FC<FaceSettingsProps> = ({ onTriggerSync, status }) => {
  return (
    <section className="reveal-item" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20">
          <Users size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">People discovery</h3>
          <p className="text-sm text-gray-500">Local facial recognition & clustering</p>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-[2rem] p-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
              Manual Scan
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">GPU Optimized</span>
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
              Triggers a full-library scan for faces using CenterFace. This will group detected faces into the People tab in your albums.
            </p>
          </div>
          
          <button 
            onClick={onTriggerSync}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 hover:border-white/20 transition-all font-bold text-sm whitespace-nowrap active:scale-95 group"
          >
            <Search size={18} className="group-hover:text-primary transition-colors" />
            <span>Discover People</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
           <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
              <Zap size={16} className="text-amber-400" />
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Engine</h5>
              <p className="text-xs text-gray-500 italic">CenterFace ONNX</p>
           </div>
           <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
              <Search size={16} className="text-blue-400" />
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Clustering</h5>
              <p className="text-xs text-gray-500 italic">DBSCAN Vector</p>
           </div>
           <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
              <Users size={16} className="text-primary" />
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Privacy</h5>
              <p className="text-xs text-gray-500 italic">100% Offline</p>
           </div>
        </div>

        {status && status.includes('discovery') && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <p className="text-xs text-primary font-bold uppercase tracking-widest">{status}</p>
          </div>
        )}
      </div>
    </section>
  );
};
