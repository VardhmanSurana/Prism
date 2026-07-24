import { useState, useRef, useEffect, useCallback } from 'react';
import { Photo } from '../../types';
import { Message, AgentViewProps, SessionItem } from './types';
import { API_BASE } from '../../constants';

const DEFAULT_GREETING: Message = {
  role: 'assistant',
  content: "Hello! I'm Prism, your dedicated AI photo assistant. Ask me to find photos, filter by year, view favorites, search tags, or upload an image to ask questions or find visually similar photos!"
};

export const useAgentView = ({ onPhotoClick }: AgentViewProps) => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [messages, setMessages] = useState<Message[]>([DEFAULT_GREETING]);
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

  const fetchSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          photos: m.photos || [],
          plan: m.plan || null,
          tools: m.tools || [],
          totalCandidates: m.totalCandidates ?? null,
        })));
        const lastWithPhotos = [...data.messages].reverse().find((m: any) => m.photos && m.photos.length > 0);
        if (lastWithPhotos) {
          setCurrentPhotos(lastWithPhotos.photos);
        } else {
          setCurrentPhotos([]);
        }
      } else {
        setMessages([DEFAULT_GREETING]);
        setCurrentPhotos([]);
      }
    } catch (e) {
      console.error('Failed to fetch session messages:', e);
    }
  }, []);

  const createSession = useCallback(async (title = 'New Chat') => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const newSess = await res.json();
        setSessions(prev => [newSess, ...prev]);
        setActiveSessionId(newSess.id);
        setMessages([DEFAULT_GREETING]);
        setCurrentPhotos([]);
        return newSess.id;
      }
    } catch (e) {
      console.error('Failed to create session:', e);
    }
    return null;
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions`);
      if (!res.ok) return;
      const data: SessionItem[] = await res.json();
      setSessions(data);
      if (data.length > 0) {
        setActiveSessionId(data[0].id);
        fetchSessionMessages(data[0].id);
      } else {
        createSession();
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  }, [fetchSessionMessages, createSession]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    fetchSessionMessages(sessionId);
  }, [activeSessionId, fetchSessionMessages]);

  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, title: newTitle } : s)));
      }
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSessions(prev => {
          const filtered = prev.filter(s => s.id !== sessionId);
          if (sessionId === activeSessionId) {
            if (filtered.length > 0) {
              setActiveSessionId(filtered[0].id);
              fetchSessionMessages(filtered[0].id);
            } else {
              createSession();
            }
          }
          return filtered;
        });
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }, [activeSessionId, fetchSessionMessages, createSession]);

  const toggleLog = useCallback((idx: number) => {
    setExpandedLogs(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const clearResults = useCallback(() => setCurrentPhotos([]), []);

  const handleSend = useCallback(async (textToSend?: string, attachedFiles?: File[]) => {
    let query = (textToSend || input).trim();
    const fileToUpload = attachedFiles && attachedFiles.length > 0 ? attachedFiles[0] : null;

    if (!query && !fileToUpload) return;
    if (isLoading) return;

    if (!query && fileToUpload) {
      query = "Describe this image and find similar photos in my library.";
    }

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      targetSessionId = await createSession();
      if (!targetSessionId) return;
    }

    if (!textToSend) setInput('');

    let uploadedImagePath: string | null = null;
    let uploadedImageUrl: string | null = null;

    setIsLoading(true);
    setProgressDetail('Processing request...');

    if (fileToUpload) {
      try {
        setProgressDetail('Uploading image to Prism AI...');
        const formData = new FormData();
        formData.append('file', fileToUpload);
        const upRes = await fetch(`${API_BASE}/api/v1/agent/upload_image`, {
          method: 'POST',
          body: formData,
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          uploadedImagePath = upData.image_path;
          uploadedImageUrl = upData.image_url;
        }
      } catch (e) {
        console.error('Failed to upload image:', e);
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: query,
      ...(uploadedImageUrl && uploadedImagePath ? { attachedImage: { url: uploadedImageUrl, path: uploadedImagePath } } : {})
    };

    setMessages(prev => [...prev, userMessage]);
    setProgressDetail('Formulating search strategy...');
    setCurrentPlan(null);
    setCurrentTools([]);
    setTotalCandidates(null);

    try {
      const historyPayload = targetSessionId
        ? []
        : messages
            .filter(m => m !== DEFAULT_GREETING)
            .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          session_id: targetSessionId,
          image_path: uploadedImagePath
        }),
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

      // Refresh session list to pick up auto-generated titles
      const sessRes = await fetch(`${API_BASE}/api/v1/agent/sessions`);
      if (sessRes.ok) {
        const updatedSessions: SessionItem[] = await sessRes.json();
        setSessions(updatedSessions);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue accessing my search indexing brain.' }]);
    } finally {
      setIsLoading(false);
      setProgressDetail(null);
    }
  }, [input, isLoading, messages, activeSessionId, createSession]);

  const modelPreloadedRef = useRef(false);

  const preloadModel = useCallback(() => {
    if (modelPreloadedRef.current) return;
    modelPreloadedRef.current = true;
    fetch(`${API_BASE}/api/v1/agent/preload`, { method: 'POST' }).catch((e) => {
      console.warn('Failed to preload AI agent model:', e);
    });
  }, []);

  const askAboutPhoto = useCallback((photo: Photo) => {
    const query = `Analyze and describe photo: "${photo.filename}" (ID: ${photo.id}). What date, metadata, and location details can you find?`;
    handleSend(query);
  }, [handleSend]);

  return {
    sessions,
    activeSessionId,
    isSidebarOpen,
    setIsSidebarOpen,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
    messages, input, isLoading, progressDetail, currentPhotos, currentPlan, currentTools, totalCandidates, expandedLogs, scrollRef,
    setInput, toggleLog, handleSend, clearResults, askAboutPhoto, preloadModel,
  };
};