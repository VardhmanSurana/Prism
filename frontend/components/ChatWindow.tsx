import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Bot, User, Sparkles } from 'lucide-react';
import { API_BASE, resolveUrl } from '../constants';
import { AgentLogo } from './AgentLogo';
import { Photo } from '../types';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  photos?: Photo[];
}

interface ChatWindowProps {
  onClose: () => void;
  onPhotoClick?: (photo: Photo) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ onClose, onPhotoClick }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm Prism, your AI photo assistant. How can I help you explore your memories today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await response.json();
      
      if (typeof data.response === 'object' && data.response !== null) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response.text,
          photos: data.response.photos 
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to my brain right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="fixed bottom-24 right-6 w-[400px] h-[550px] bg-surface/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10">
            <AgentLogo className="scale-75" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Prism AI</h3>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 font-medium">Ask anything, completely local</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="flex flex-col gap-2 max-w-[85%] select-none">
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-primary text-black font-semibold rounded-tr-none' 
                  : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'
              }`}>
                {m.content}
              </div>
              
              {/* Premium Photo Grid Previews */}
              {m.photos && m.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded-2xl animate-agent-pop shadow-inner">
                  {m.photos.map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => onPhotoClick && onPhotoClick(p)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 active:scale-95 transition-all border border-white/10 relative group"
                      title={p.filename}
                    >
                      <img src={resolveUrl(p.url)} alt={p.filename} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                        View
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-white/5">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Search by keywords, years, or favorites..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white placeholder-gray-500 font-medium"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-black rounded-xl hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
