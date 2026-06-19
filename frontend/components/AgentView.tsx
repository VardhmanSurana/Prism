import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Sparkles, Image as ImageIcon, Heart, Calendar, Lock, ChevronDown, ChevronUp, Cpu, Terminal } from 'lucide-react';
import { API_BASE, resolveUrl } from '../constants';
import { Photo } from '../types';
import { AgentLogo } from './AgentLogo';
import { springs, motionTokens } from '../lib/motion-tokens';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  photos?: Photo[];
  plan?: any;
  tools?: any[];
  totalCandidates?: number;
}

const MessageReveal: React.FC<{ text: string; role: 'assistant' | 'user' }> = ({ text, role }) => {
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

interface AgentDiagnosticsProps {
  plan: any;
  tools: any[];
  totalCandidates: number | null;
  isStreaming?: boolean;
}

const AgentDiagnostics: React.FC<AgentDiagnosticsProps> = ({
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
      <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl text-[11px] text-gray-300 space-y-3 font-sans shadow-inner backdrop-blur-md w-full">
        {/* Plan Header */}
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

        {/* Plan Details */}
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

        {/* Tool Invocations */}
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


interface AgentViewProps {
  onPhotoClick: (photo: Photo) => void;
}

const SUGGESTIONS = [
  { text: "Show my favorite photos", icon: Heart, color: "text-rose-400 border-rose-500/20 hover:bg-rose-500/10" },
  { text: "Find photos from 2024", icon: Calendar, color: "text-amber-400 border-amber-500/20 hover:bg-amber-500/10" },
  { text: "Search locked photos", icon: Lock, color: "text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10" },
  { text: "Show all my images", icon: ImageIcon, color: "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10" },
];

export const AgentView: React.FC<AgentViewProps> = ({ onPhotoClick }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm Prism, your dedicated AI photo assistant. Ask me to find photos, filter by year, view favorites, or search tags. How can I help you explore your memories today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressDetail, setProgressDetail] = useState<string | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<Photo[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [currentTools, setCurrentTools] = useState<any[]>([]);
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const toggleLog = (idx: number) => {
    setExpandedLogs(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) {
      setInput('');
    }

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);
    setProgressDetail("Formulating search strategy...");
    
    // Reset diagnostics
    setCurrentPlan(null);
    setCurrentTools([]);
    setTotalCandidates(null);

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: query,
          history: historyPayload
        })
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No body reader on response");
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let resultText = '';
      let resultPhotos: Photo[] = [];
      let hasResult = false;
      let activePlan: any = null;
      let activeTools: any[] = [];
      let activeTotalCandidates: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setProgressDetail(data.detail || null);
              if (data.plan) {
                activePlan = data.plan;
                setCurrentPlan(data.plan);
              }
              if (data.tools) {
                activeTools = data.tools;
                setCurrentTools(data.tools);
              }
              if (typeof data.total_candidates === 'number') {
                activeTotalCandidates = data.total_candidates;
                setTotalCandidates(data.total_candidates);
              }
            } else if (data.type === 'result') {
              resultText = data.text;
              resultPhotos = data.photos || [];
              hasResult = true;
            }
          } catch (err) {
            console.error("Failed to parse progress chunk:", err);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.type === 'progress') {
            setProgressDetail(data.detail || null);
            if (data.plan) {
              activePlan = data.plan;
              setCurrentPlan(data.plan);
            }
            if (data.tools) {
              activeTools = data.tools;
              setCurrentTools(data.tools);
            }
            if (typeof data.total_candidates === 'number') {
              activeTotalCandidates = data.total_candidates;
              setTotalCandidates(data.total_candidates);
            }
          } else if (data.type === 'result') {
            resultText = data.text;
            resultPhotos = data.photos || [];
            hasResult = true;
          }
        } catch (err) {
          console.error("Failed to parse final progress chunk:", err);
        }
      }

      if (hasResult) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: resultText,
          photos: resultPhotos,
          plan: activePlan,
          tools: activeTools,
          totalCandidates: activeTotalCandidates
        }]);
        if (resultPhotos.length > 0) {
          setCurrentPhotos(resultPhotos);
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Sorry, I couldn't retrieve a valid search response." 
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an issue accessing my search indexing brain." }]);
    } finally {
      setIsLoading(false);
      setProgressDetail(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full overflow-hidden bg-background/30">
      {/* Left Panel: Chat Stream */}
      <div className="w-[450px] border-r border-white/5 flex flex-col h-full bg-black/20 backdrop-blur-md">
        {/* Chat Title / Banner */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
          <AgentLogo className="scale-75" />
          <div>
            <h2 className="text-md font-bold text-white tracking-wide">Prism AI Assistant</h2>
            <p className="text-[11px] text-gray-400 font-medium">Completely offline neural search helper</p>
          </div>
        </div>

        {/* Message Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-primary">
                  <AgentLogo className="scale-[0.4]" />
                </div>
              )}
              <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-primary text-black font-semibold rounded-tr-none shadow-[0_4px_20px_rgba(var(--color-primary),0.15)]' 
                    : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'
                }`}>
                  <MessageReveal text={m.content} role={m.role} />
                </div>
                {m.role === 'assistant' && (m.plan || (m.tools && m.tools.length > 0)) && (
                  <div className="w-full">
                    <button
                      onClick={() => toggleLog(idx)}
                      className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white transition-colors py-1.5 px-2.5 bg-white/5 rounded-xl border border-white/5 font-semibold"
                    >
                      <Terminal size={11} />
                      <span>{expandedLogs[idx] ? 'Hide execution details' : 'Show execution details'}</span>
                      {expandedLogs[idx] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    <AnimatePresence>
                      {expandedLogs[idx] && (
                        <AgentDiagnostics
                          plan={m.plan}
                          tools={m.tools || []}
                          totalCandidates={m.totalCandidates || null}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary/25 border border-primary/50 flex items-center justify-center shrink-0 text-white">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-primary">
                <AgentLogo className="scale-[0.4]" />
              </div>
              <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 flex flex-col gap-2 max-w-[80%] items-start w-full">
                <div className="flex gap-1.5 items-center">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                  <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-widest ml-1">AI Thinking</span>
                </div>
                <p className="text-xs text-gray-400 font-medium italic animate-pulse">
                  {progressDetail || "Formulating search strategy..."}
                </p>
                <AnimatePresence>
                  {(currentPlan || (currentTools && currentTools.length > 0)) && (
                    <AgentDiagnostics
                      plan={currentPlan}
                      tools={currentTools}
                      totalCandidates={totalCandidates}
                      isStreaming={true}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions list when feed is fresh */}
        <div className="p-4 border-t border-white/5 space-y-2 bg-white/[0.01]">
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s, idx) => {
              const Icon = s.icon;
              return (
                <motion.button
                  key={idx}
                  whileHover={{ scale: motionTokens.scale.hover }}
                   whileTap={{ scale: motionTokens.scale.press }}
                  transition={springs.snappy as any}
                  onClick={() => handleSend(s.text)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-300 ${s.color}`}
                >
                  <Icon size={12} />
                  <span>{s.text}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Input Controls */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02]">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Prism to find something..."
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-4 pr-14 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white placeholder-gray-500 font-semibold"
            />
             <motion.button
               whileHover={{ scale: 1.1 }}
               whileTap={{ scale: 0.9 }}
               transition={springs.snappy as any}
               onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-black rounded-xl hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all shadow-md"
            >
              <Send size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Right Panel: Immersive Photo Gallery Results */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" />
            <span>Search Results {currentPhotos.length > 0 && `(${currentPhotos.length} matches)`}</span>
          </h3>
          {currentPhotos.length > 0 && (
            <button 
              onClick={() => setCurrentPhotos([])}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Clear Results
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {currentPhotos.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {currentPhotos.map((photo) => (
                  <motion.div
                    key={photo.id}
                    layoutId={`agent-photo-${photo.id}`}
                    whileHover={{ y: -4, borderColor: 'rgba(var(--color-primary), 0.2)' }}
                    onClick={() => onPhotoClick(photo)}
                    className="aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-lg border border-white/5 relative group transition-colors duration-300 bg-surface/40"
                  >
                    <img 
                      src={resolveUrl(photo.url)} 
                      alt={photo.filename} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                      <span className="text-xs font-bold text-white truncate">{photo.filename}</span>
                      {photo.date && (
                        <span className="text-[10px] text-gray-300 mt-0.5 font-medium">
                          {new Date(photo.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {photo.search_explanation && photo.search_explanation.matched.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-0.5 border-t border-white/10 pt-1.5 text-[9px] text-gray-300">
                          {photo.search_explanation.matched.slice(0, 3).map((reason, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-1 font-semibold">
                              <span className="text-primary font-bold">✓</span>
                              <span className="truncate">{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6"
              >
                <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-inner text-primary relative">
                  <AgentLogo />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-ping opacity-75" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full" />
                </div>
                <div className="max-max-w-md space-y-2">
                  <h4 className="text-white font-bold tracking-tight">Interactive Local Agent Index</h4>
                  <p className="text-sm text-gray-400 font-medium">
                    Type a query or tap a suggestion in the left pane. Prism's local engine will scour metadata, tags, years, and favorites to instantly render matching results right here.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
