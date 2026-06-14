import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Image as ImageIcon, Heart, Calendar, Lock } from 'lucide-react';
import { API_BASE, resolveUrl } from '../constants';
import { Photo } from '../types';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  photos?: Photo[];
}

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
  const [currentPhotos, setCurrentPhotos] = useState<Photo[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) {
      setInput('');
    }

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);

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
      const data = await response.json();
      
      if (typeof data.response === 'object' && data.response !== null) {
        const text = data.response.text;
        const photos = data.response.photos || [];
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: text,
          photos: photos 
        }]);
        if (photos.length > 0) {
          setCurrentPhotos(photos);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an issue accessing my search indexing brain." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full overflow-hidden bg-background/30">
      {/* Left Panel: Chat Stream */}
      <div className="w-[450px] border-r border-white/5 flex flex-col h-full bg-black/20 backdrop-blur-md">
        {/* Chat Title / Banner */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Bot size={22} className="animate-pulse" />
          </div>
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
                  <Bot size={16} />
                </div>
              )}
              <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-primary text-black font-semibold rounded-tr-none shadow-[0_4px_20px_rgba(var(--color-primary),0.15)]' 
                    : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
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
                <Bot size={16} />
              </div>
              <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
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
                <button
                  key={idx}
                  onClick={() => handleSend(s.text)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-300 ${s.color}`}
                >
                  <Icon size={12} />
                  <span>{s.text}</span>
                </button>
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
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-black rounded-xl hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all shadow-md"
            >
              <Send size={18} />
            </button>
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
                    onClick={() => onPhotoClick(photo)}
                    className="aspect-square rounded-2xl overflow-hidden cursor-pointer hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/5 relative group transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 bg-surface/40"
                  >
                    <img 
                      src={resolveUrl(photo.url)} 
                      alt={photo.filename} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                      <span className="text-xs font-bold text-white truncate">{photo.filename}</span>
                      {photo.date && (
                        <span className="text-[10px] text-gray-300 mt-1 font-medium">
                          {new Date(photo.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
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
                  <Bot size={32} />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-ping opacity-75" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full" />
                </div>
                <div className="max-w-md space-y-2">
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
