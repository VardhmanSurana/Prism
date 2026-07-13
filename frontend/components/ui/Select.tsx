import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelectOption = (e: React.MouseEvent, optValue: string) => {
    e.stopPropagation();
    onChange(optValue);
    setIsOpen(false);
  };

  const springTransition = {
    type: 'spring',
    stiffness: 600,
    damping: 30,
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className={`flex w-full items-center justify-between rounded-lg border border-[#23252a] bg-[#0c0c0c] px-3.5 py-2 text-[13px] text-[#f7f8f8] outline-none transition-all duration-150 hover:bg-[#141516] hover:border-[#34343a] focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2] ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown
          size={14}
          className={`text-[#8a8f98] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#f7f8f8]' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={springTransition}
            style={{ originY: 0 }}
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-[#23252a] bg-[#050505] p-1 shadow-2xl backdrop-blur-md"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={(e) => handleSelectOption(e, opt.value)}
                  className={`group relative flex items-center justify-between rounded-md px-3 py-2 text-[13px] transition-colors duration-100 cursor-pointer ${
                    isSelected
                      ? 'bg-[#5e6ad2]/10 text-[#f7f8f8]'
                      : 'text-[#8a8f98] hover:bg-[#141516] hover:text-[#f7f8f8]'
                  }`}
                >
                  <span className="truncate font-medium">{opt.label}</span>
                  {isSelected && (
                    <motion.div
                      layoutId="checkmark"
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Check size={14} className="text-[#5e6ad2]" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
