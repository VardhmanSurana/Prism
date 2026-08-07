import React from 'react';

export const CssTrashIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`trash-css ${className}`}>
    <div className="trash-css-lid">
      <div className="trash-css-handle" />
      <div className="trash-css-bar" />
    </div>
    <div className="trash-css-body">
      <div className="trash-css-strip" />
      <div className="trash-css-strip" />
    </div>
  </div>
);

export const CssFolderIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`folder-css ${className}`}>
    <div className="folder-css-back" />
    <div className="folder-css-tab" />
    <div className="folder-css-paper">
      <div className="folder-css-slot" />
      <div className="folder-css-slot" />
      <div className="folder-css-slot" />
      <div className="folder-css-slot" />
    </div>
    <div className="folder-css-front" />
  </div>
);

export const CssVaultIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-6 h-6 ${className}`}
  >
    <rect x="3" y="3" width="18" height="17" rx="2.5" />
    <path d="M5 20v1.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V20M16 20v1.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V20" />
    <rect x="5.5" y="5.5" width="13" height="12" rx="1.5" />
    <circle cx="12" cy="11.5" r="3.2" />
    <circle cx="12" cy="11.5" r="1.4" />
    <path d="M12 7.3v.9M12 14.8v.9M7.8 11.5h.9M15.3 11.5h.9M9.03 8.53l.64.64M14.33 13.83l.64.64M9.03 14.47l.64-.64M14.33 9.17l.64-.64" />
    <rect x="16.8" y="7" width="1.4" height="2.8" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="16.8" y="13.2" width="1.4" height="2.8" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);
