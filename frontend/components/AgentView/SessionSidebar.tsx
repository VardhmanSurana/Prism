import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Edit2, Trash2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SessionItem } from './types';

interface SessionSidebarProps {
  sessions: SessionItem[];
  activeSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  isOpen,
  onToggle,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEditing = (e: React.MouseEvent, session: SessionItem) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      onDeleteSession(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId((current) => (current === id ? null : current)), 3000);
    }
  };

  return (
    <div className="relative z-20 flex h-full">
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 260 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-full bg-[#08080a] border-r border-white/5 flex flex-col overflow-hidden shrink-0 shadow-2xl relative"
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <button
            onClick={onCreateSession}
            className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold py-2 px-3 rounded-xl border border-white/10 transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {sessions.length > 0 ? (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;
              const isDeleting = deletingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && onSelectSession(session.id)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold shadow-md border border-white/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                    <MessageSquare size={14} className={isActive ? 'text-purple-400 shrink-0' : 'text-gray-500 shrink-0'} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing();
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="bg-black/60 text-white text-xs px-2 py-0.5 rounded border border-purple-500/50 outline-none w-full"
                      />
                    ) : (
                      <span className="truncate text-left">{session.title}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEditing}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                          title="Save title"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 text-gray-400 hover:bg-white/10 rounded transition-colors"
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : isDeleting ? (
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className="px-1.5 py-0.5 text-[10px] bg-red-500/30 text-red-300 border border-red-500/40 rounded hover:bg-red-500/50 font-bold transition-colors"
                        title="Click again to confirm delete"
                      >
                        Confirm?
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startEditing(e, session)}
                          className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Rename chat"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-gray-500 text-[11px]">No chat history</div>
          )}
        </div>
      </motion.div>

      {/* Collapse/Expand Toggle Handle */}
      <button
        onClick={onToggle}
        className="absolute left-full top-3 z-30 bg-[#0d0f14] hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 p-1 rounded-r-lg transition-colors shadow-lg"
        title={isOpen ? 'Collapse history' : 'Expand chat history'}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </div>
  );
};
