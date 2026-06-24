import { useState, useRef, useEffect, useCallback } from 'react';
import { Photo } from '../../types';
import { Message, AgentViewProps } from './types';
import { API_BASE } from '../../constants';

export const useAgentView = ({ onPhotoClick }: AgentViewProps) => {
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
      const el = scrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const toggleLog = useCallback((idx: number) => {
    setExpandedLogs(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const clearResults = useCallback(() => setCurrentPhotos([]), []);

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);
    setProgressDetail('Formulating search strategy...');
    setCurrentPlan(null);
    setCurrentTools([]);
    setTotalCandidates(null);

    try {
      const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, history: historyPayload }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body reader on response');

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
              if (data.plan) { activePlan = data.plan; setCurrentPlan(data.plan); }
              if (data.tools) { activeTools = data.tools; setCurrentTools(data.tools); }
              if (typeof data.total_candidates === 'number') { activeTotalCandidates = data.total_candidates; setTotalCandidates(data.total_candidates); }
            } else if (data.type === 'result') {
              resultText = data.text;
              resultPhotos = data.photos || [];
              hasResult = true;
            }
          } catch (err) {
            console.error('Failed to parse progress chunk:', err);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.type === 'progress') {
            setProgressDetail(data.detail || null);
            if (data.plan) { activePlan = data.plan; setCurrentPlan(data.plan); }
            if (data.tools) { activeTools = data.tools; setCurrentTools(data.tools); }
            if (typeof data.total_candidates === 'number') { activeTotalCandidates = data.total_candidates; setTotalCandidates(data.total_candidates); }
          } else if (data.type === 'result') {
            resultText = data.text;
            resultPhotos = data.photos || [];
            hasResult = true;
          }
        } catch (err) {
          console.error('Failed to parse final progress chunk:', err);
        }
      }

      if (hasResult) {
        setMessages(prev => [...prev, { role: 'assistant', content: resultText, photos: resultPhotos, plan: activePlan, tools: activeTools, totalCandidates: activeTotalCandidates }]);
        if (resultPhotos.length > 0) setCurrentPhotos(resultPhotos);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't retrieve a valid search response." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue accessing my search indexing brain.' }]);
    } finally {
      setIsLoading(false);
      setProgressDetail(null);
    }
  }, [input, isLoading, messages, onPhotoClick]);

  return {
    messages, input, isLoading, progressDetail, currentPhotos, currentPlan, currentTools, totalCandidates, expandedLogs, scrollRef,
    setInput, toggleLog, handleSend, clearResults,
  };
};