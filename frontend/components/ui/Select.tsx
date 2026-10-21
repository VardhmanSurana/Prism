import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Uses the native select control so its keyboard, focus, and assistive-technology
 * behaviour remains reliable in the desktop webview.
 */
export const Select: React.FC<SelectProps> = ({ options, value, onChange, disabled = false, ariaLabel = 'Select option' }) => (
  <div className="relative w-full">
    <select
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full appearance-none rounded-lg border border-[#23252a] bg-[#0c0c0c] px-3.5 py-2 pr-9 text-[13px] text-[#f7f8f8] transition-colors duration-150 hover:border-[#34343a] hover:bg-[#141516] focus:border-[#5e6ad2] focus:outline-none focus:ring-1 focus:ring-[#5e6ad2] ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown
      aria-hidden="true"
      size={14}
      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a8f98]"
    />
  </div>
);
