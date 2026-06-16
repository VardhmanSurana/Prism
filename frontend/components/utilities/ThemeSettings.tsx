import React from 'react';
import { Palette } from 'lucide-react';

interface ThemeSettingsProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ currentTheme, onThemeChange }) => {
  const themes = [
    { id: 'default', name: 'Obsidian', color: 'bg-zinc-900' },
    { id: 'theme-purple', name: 'Amethyst', color: 'bg-purple-900' },
    { id: 'theme-green', name: 'Emerald', color: 'bg-emerald-900' },
    { id: 'theme-orange', name: 'Amber', color: 'bg-orange-900' },
    { id: 'theme-rose', name: 'Crimson', color: 'bg-rose-900' },
  ];

  return (
    <section className="reveal-item space-y-6" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-3 mb-2">
        <Palette size={20} className="text-primary" />
        <h3 className="text-xl font-serif italic text-white">Visual Identity</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            title={`Switch to ${theme.name} theme`}
            className={`group flex flex-col items-center gap-3 p-4 rounded-[2rem] border transition-all duration-500
              ${currentTheme === theme.id ? 'bg-primary/10 border-primary shadow-lg' : 'bg-surface border-white/5 hover:border-white/20'}
            `}
          >
            <div className={`w-12 h-12 rounded-full ${theme.color} border-2 border-white/10 group-hover:scale-110 transition-transform`} />
            <span className={`text-[10px] font-mono uppercase tracking-widest ${currentTheme === theme.id ? 'text-primary font-bold' : 'text-gray-500'}`}>
              {theme.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
