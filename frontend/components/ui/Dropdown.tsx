import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  style?: React.CSSProperties;
}

export function Dropdown<T extends string | number>({
  value,
  onChange,
  options,
  className,
  style,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className || ''}`} style={style}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-[#1a1a1a] hover:bg-[#252525] text-[#ccc] text-xs rounded px-2.5 py-1.5 border border-[#2a2a2a] cursor-pointer transition-colors outline-none focus:border-[#3b82f6]/50"
      >
        <span className="truncate select-none">{selectedOption?.label ?? String(value)}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`w-3 h-3 text-[#666] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div 
          className="absolute left-0 mt-1 w-full min-w-[120px] bg-[#161616] border border-[#2a2a2a] rounded-lg shadow-xl py-1 z-50 transition-all duration-100 ease-out origin-top transform scale-y-100 opacity-100"
          style={{ animation: 'dropdownFadeIn 0.12s ease-out' }}
        >
          <style>{`
            @keyframes dropdownFadeIn {
              from {
                opacity: 0;
                transform: scaleY(0.95);
              }
              to {
                opacity: 1;
                transform: scaleY(1);
              }
            }
          `}</style>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-[#3b82f6]/10 text-blue-400 font-medium'
                    : 'text-[#aaa] hover:bg-[#222] hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
