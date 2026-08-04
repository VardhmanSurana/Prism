import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { Photo } from '@/types';
import { API_BASE } from '@/constants';
import { InputMessage } from '@/components/AgentView/InputMessage';

interface AskAIPanelProps {
  photo: Photo;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  photos?: any[];
}

const GREETING: Message = {
  role: 'assistant',
  content: "Ask me anything about this photo — composition, mood, subjects, technical details, or similar photos in your library.",
};

export const AskAIPanel: React.FC<AskAIPanelProps> = ({ photo, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Create a session when the panel opens
  useEffect(() => {
    let cancelled = false;
    const createSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/agent/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `About: ${photo.filename || 'photo'}` }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSessionId(data.id);
        }
      } catch (e) {
        console.error('Failed to create AI session:', e);
      }
    };
    createSession();
    return () => { cancelled = true; };
  }, [photo.id]);

  // Cleanup session on unmount (optional: could delete empty sessions)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    if (!query || isLoading) return;

    const targetSessionId = sessionId;
    if (!targetSessionId) return;

    setInput('');

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setProgressDetail('Thinking...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: [],
          session_id: targetSessionId,
          image_path: photo.path || undefined,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let resultText = '';
      let resultPhotos: any[] = [];
      let hasResult = false;

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
              setProgressDetail(data.detail || 'Thinking...');
            } else if (data.type === 'result') {
              resultText = data.text;
              resultPhotos = data.photos || [];
              hasResult = true;
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.type === 'result') {
            resultText = data.text;
            resultPhotos = data.photos || [];
            hasResult = true;
          }
        } catch {
          // skip
        }
      }

      if (hasResult) {
        setMessages(prev => [...prev, { role: 'assistant', content: resultText, photos: resultPhotos }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't generate a response. Please try again." }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
      }
    } finally {
      setIsLoading(false);
      setProgressDetail(null);
      abortRef.current = null;
    }
  }, [input, isLoading, sessionId, photo.path]);

  return (
    <div className="w-96 h-full bg-[#0D0F14]/95 backdrop-blur-xl border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300 z-30">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white/90">Ask AI</h3>
            <p className="text-[10px] text-white/40 truncate max-w-[200px]">{photo.filename}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary/20 text-white/90 border border-primary/20'
                  : 'bg-white/5 text-white/80 border border-white/5'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.photos && msg.photos.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {msg.photos.slice(0, 4).map((p: any, j: number) => (
                    <div key={j} className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 border border-white/10">
                      {p.thumbnail_url ? (
                        <img src={`${API_BASE}${p.thumbnail_url}`} alt="" className="w-full h-full object-cover" />
                      ) : p.url ? (
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-white/30">IMG</div>
                      )}
                    </div>
                  ))}
                  {msg.photos.length > 4 && (
                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/40">
                      +{msg.photos.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="text-primary animate-spin" />
              <span className="text-xs text-white/50">{progressDetail || 'Thinking...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <InputMessage
          value={input}
          onValueChange={setInput}
          onSend={(text) => handleSend(text)}
          placeholder="Ask about this photo..."
          disabled={isLoading || !sessionId}
          minRows={1}
          maxRows={4}
          clickToFocus
          sendLabel="Send"
        />
      </div>
    </div>
  );
};
