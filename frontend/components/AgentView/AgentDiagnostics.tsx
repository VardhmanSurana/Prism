import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Lock, Heart, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { springs } from '../../lib/motion-tokens';
import { AgentDiagnosticsProps } from './types';

export const AgentDiagnostics: React.FC<AgentDiagnosticsProps> = ({
  plan,
  tools,
  totalCandidates,
  isStreaming = false
}) => {
  if (!plan && (!tools || tools.length === 0)) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={springs.gentle as any}
      className="mt-3 overflow-hidden w-full"
    >
      <div className="p-3.5 bg-black/60 border border-white/5 rounded-2xl text-[11px] text-gray-300 space-y-3 font-sans shadow-inner w-full">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-primary/95 text-[10px] uppercase tracking-wider">
            <Cpu size={12} className={isStreaming ? "animate-spin text-primary" : "text-primary"} />
            <span>Agent Execution Log</span>
          </div>
          {totalCandidates !== null && (
            <div className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[9px] font-bold">
              {totalCandidates} Candidates
            </div>
          )}
        </div>

        {plan && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {plan.intent && (
                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[9px] font-semibold text-gray-400">
                  Intent: {plan.intent}
                </span>
              )}
              {plan.is_locked && (
                <span className="bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md text-[9px] font-semibold text-rose-400 flex items-center gap-1">
                  <Lock size={9} /> Locked
                </span>
              )}
              {plan.refine_previous && (
                <span className="bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md text-[9px] font-semibold text-cyan-400">
                  Refinement
                </span>
              )}
              {plan.ranking?.prefer_favorites && (
                <span className="bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md text-[9px] font-semibold text-pink-400 flex items-center gap-1">
                  <Heart size={9} fill="currentColor" /> Favorites
                </span>
              )}
            </div>

            {plan.entities && (
              <div className="bg-white/[0.01] border border-white/5 p-2 rounded-lg space-y-1.5">
                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Extracted Entities</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {plan.entities.people && plan.entities.people.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-16 select-none shrink-0">People:</span>
                      <div className="flex flex-wrap gap-1">
                        {plan.entities.people.map((p: string, i: number) => (
                          <span key={i} className="bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded text-[9px] text-purple-300 font-semibold">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.entities.locations && plan.entities.locations.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-16 select-none shrink-0">Locations:</span>
                      <div className="flex flex-wrap gap-1">
                        {plan.entities.locations.map((l: string, i: number) => (
                          <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] text-emerald-300 font-semibold">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.entities.events && plan.entities.events.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-16 select-none shrink-0">Events:</span>
                      <div className="flex flex-wrap gap-1">
                        {plan.entities.events.map((e: string, i: number) => (
                          <span key={i} className="bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] text-amber-300 font-semibold">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.entities.objects && plan.entities.objects.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-16 select-none shrink-0">Objects:</span>
                      <div className="flex flex-wrap gap-1">
                        {plan.entities.objects.map((o: string, i: number) => (
                          <span key={i} className="bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-[9px] text-blue-300 font-semibold">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.entities.time_range && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-16 select-none shrink-0">Time Range:</span>
                      <span className="bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded text-[9px] text-teal-300 font-semibold">{plan.entities.time_range}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tools && tools.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Tool Execution Timeline</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
              {tools.map((t, idx) => (
                <div key={idx} className="bg-black/30 border border-white/5 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                      <span className="font-mono text-[9px] font-bold text-white truncate max-w-[150px]">{t.name}</span>
                    </div>
                    <span className="text-[8px] font-semibold text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 shrink-0">
                      {t.count} matches
                    </span>
                  </div>
                  {t.params && Object.keys(t.params).length > 0 && (
                    <pre className="text-[8px] font-mono text-gray-400 bg-black/25 p-1 rounded overflow-x-auto custom-scrollbar leading-tight border border-white/[0.02]">
                      {JSON.stringify(t.params)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};