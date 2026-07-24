import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar } from 'lucide-react';
import { Photo } from '../../types';
import { useAgentView } from './useAgentView';
import { AgentBanner } from './AgentBanner';
import { MessageReveal } from './MessageReveal';
import { AgentDiagnostics } from './AgentDiagnostics';
import { SuggestionsPanel } from './SuggestionsPanel';
import { ChatInput } from './ChatInput';
import { InlinePhotoGrid } from './InlinePhotoGrid';
import { GalleryDrawer } from './GalleryDrawer';
import { ThinkingIndicator } from './ThinkingIndicator';
import { SuggestedFollowups } from './SuggestedFollowups';
import { SmartAlbumModal } from './SmartAlbumModal';
import { SessionSidebar } from './SessionSidebar';

const SUGGESTIONS = [
  { text: "Show my favorite photos", icon: 'Heart' },
  { text: "Find photos from 2024", icon: 'Calendar' },
  { text: "Search locked photos", icon: 'Lock' },
  { text: "Show all my images", icon: 'ImageIcon' },
];

export const AgentView: React.FC<{ onPhotoClick: (photo: Photo) => void }> = ({ onPhotoClick }) => {
  const {
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
  } = useAgentView({ onPhotoClick });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);


  // Auto-open drawer when new search photos are fetched
  useEffect(() => {
    if (currentPhotos.length > 0) {
      setIsDrawerOpen(true);
    }
  }, [currentPhotos]);

  const handleClear = () => {
    clearResults();
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#050505] relative">
      {/* Sessions Left Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectSession={selectSession}
        onCreateSession={() => createSession()}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
      />

      {/* Background Decorative Aura (only visible when drawer is closed) */}
      {!isDrawerOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none transition-all duration-700" />
      )}

      {/* Left/Main Column: Chat Feed Container */}
      <div
        className={`flex flex-col h-full bg-[#0a0a0c]/40 transition-all duration-500 relative z-10 ${
          isDrawerOpen ? 'w-[42%] border-r border-white/[0.02]' : 'flex-1'
        }`}
      >
        <AgentBanner title="Prism AI Assistant" subtitle="Completely offline neural search helper" />

        {/* Message Feed with dual CSS mask soft edge fades */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)'
          }}
        >
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
                  <img src="/agent-logo.jpeg" className="w-full h-full object-cover" alt="Agent Logo" />
                </div>
              )}
              <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-white to-gray-200 text-black font-semibold rounded-tr-none shadow-[0_4px_24px_rgba(255,255,255,0.06)]'
                    : 'bg-[#121216]/95 text-gray-200 border border-white/[0.06] rounded-tl-none shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
                }`}>
                  {m.attachedImage && (
                    <div className="mb-2 max-w-[200px] rounded-xl overflow-hidden border border-black/10 shadow-sm">
                      <img src={m.attachedImage.url} alt="Uploaded attachment" className="w-full h-auto object-cover max-h-48" />
                    </div>
                  )}
                  <MessageReveal text={m.content} role={m.role} />

                  {/* WhatsApp-style Inline Grid for Assistant Photos */}
                  {m.role === 'assistant' && m.photos && m.photos.length > 0 && (
                    <InlinePhotoGrid
                      photos={m.photos}
                      onPhotoClick={onPhotoClick}
                      onShowMore={() => setIsDrawerOpen(true)}
                    />
                  )}

                  {/* Interactive Suggested Follow-up Chips */}
                  {m.role === 'assistant' && idx === messages.length - 1 && !isLoading && (
                    <SuggestedFollowups
                      photos={m.photos || currentPhotos}
                      onSelectFollowup={(prompt) => handleSend(prompt)}
                      onCreateAlbum={() => setIsAlbumModalOpen(true)}
                    />
                  )}
                </div>
                {m.role === 'assistant' && (m.plan || (m.tools && m.tools.length > 0)) && (
                  <div className="w-full">
                    <button
                      onClick={() => toggleLog(idx)}
                      className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white transition-colors py-1.5 px-2.5 bg-white/5 rounded-xl border border-white/5 font-semibold shadow-sm"
                    >
                      <span>{expandedLogs[idx] ? 'Hide' : 'Show'} execution details</span>
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
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                  <span>U</span>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
                <img src="/agent-logo.jpeg" className="w-full h-full object-cover" alt="Agent Logo" />
              </div>
              <div className="bg-[#121216]/95 px-3 py-3 rounded-2xl rounded-tl-none border border-white/[0.06] flex flex-col gap-2 max-w-[80%] items-start w-full">
                <ThinkingIndicator
                  words={['Searching', 'Planning', 'Scanning', 'Refining']}
                />
                {progressDetail && (
                  <p className="text-[11px] text-white/30 font-medium pl-1">
                    {progressDetail}
                  </p>
                )}
                <AnimatePresence>
                  {(currentPlan || (currentTools && currentTools.length > 0)) && (
                    <AgentDiagnostics plan={currentPlan} tools={currentTools} totalCandidates={totalCandidates} isStreaming />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Intro Screen/Empty State for Centered Chat View */}
        {!isDrawerOpen && messages.length <= 1 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-8 py-10 flex flex-col items-center text-center space-y-6 max-w-lg mx-auto"
          >
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 relative shadow-lg">
              <img src="/agent-logo.jpeg" className="w-full h-full object-cover" alt="Agent Logo" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-60" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full" />
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-bold tracking-tight text-md">Prism Neural Search Index</h4>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                Type a query below or select a suggestions template. Prism's local AI engine scours metadata, FTS5 labels, objects, and geolocation instantly.
              </p>
            </div>

            {/* Cards layout showing Capabilities */}
            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-left space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  <Search size={11} /> Semantic
                </div>
                <p className="text-[10px] text-gray-500 leading-normal font-medium">"Find pictures of a birthday cake in the park"</p>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-left space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  <Calendar size={11} /> Temporal
                </div>
                <p className="text-[10px] text-gray-500 leading-normal font-medium">"Photos from last summer or favorites in Paris"</p>
              </div>
            </div>
          </motion.div>
        )}

        <SuggestionsPanel suggestions={SUGGESTIONS} onSend={(prompt) => { preloadModel(); handleSend(prompt); }} />
        <ChatInput value={input} onChange={setInput} onSend={() => handleSend()} disabled={isLoading} onActivate={preloadModel} />

      </div>

      {/* Sliding Right Gallery Drawer */}
      <GalleryDrawer
        photos={currentPhotos}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPhotoClick={onPhotoClick}
        onClear={handleClear}
        onCreateAlbum={() => setIsAlbumModalOpen(true)}
        onAskAboutPhoto={askAboutPhoto}
      />

      <SmartAlbumModal
        isOpen={isAlbumModalOpen}
        photos={currentPhotos}
        onClose={() => setIsAlbumModalOpen(false)}
      />
    </div>
  );
};