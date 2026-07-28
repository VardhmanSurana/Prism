import React from 'react';
import { useGalleryLayout, GalleryStyle } from '../../hooks/useGalleryLayout';
import { Palette } from 'lucide-react';

const GooglePhotosIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#4285F4"/>
    <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16Z" fill="#EA4335"/>
    <path d="M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="#FBBC05"/>
    <path d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="#34A853"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.06 4.83 18.82 5.06 19.95 6.78C19.87 6.84 17.56 8.18 17.58 11.03C17.61 14.43 20.55 15.54 20.58 15.55C20.55 15.63 20.12 17.15 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" fill="white"/>
  </svg>
);

const GALLERY_STYLE_OPTIONS: { value: GalleryStyle; label: string; desc: string; icon: React.ReactNode; bgColor: string; available: boolean }[] = [
  { 
    value: 'prism', 
    label: 'Prism', 
    desc: 'Original layout', 
    icon: <Palette size={20} />,
    bgColor: 'bg-[#5e6ad2]',
    available: true 
  },
  { 
    value: 'google', 
    label: 'Google Photos', 
    desc: 'Coming soon', 
    icon: <GooglePhotosIcon />,
    bgColor: 'bg-white',
    available: false 
  },
  { 
    value: 'apple', 
    label: 'Apple Photos', 
    desc: 'Coming soon', 
    icon: <AppleIcon />,
    bgColor: 'bg-black',
    available: false 
  },
];

export const Appearance: React.FC = () => {
  const { settings, setGalleryStyle } = useGalleryLayout();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
      {/* Left Column: Title & Description */}
      <div className="lg:col-span-1 pr-2">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={16} className="text-[#5e6ad2]" />
          <h4 className="font-serif font-semibold text-white text-xl leading-tight">
            Themes
          </h4>
        </div>
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          Choose a gallery theme to change the overall look and feel of your photo library. Each theme offers a unique visual experience.
        </p>
      </div>

      {/* Right Column: Interactive cards */}
      <div className="lg:col-span-2 space-y-6 bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-500 mb-4">
            Gallery Theme
          </p>
          <div className="grid grid-cols-3 gap-3">
            {GALLERY_STYLE_OPTIONS.map((opt) => {
              const isActive = settings.galleryStyle === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => opt.available && setGalleryStyle(opt.value)}
                  disabled={!opt.available}
                  className={`flex flex-col items-center p-4 rounded-2xl border transition-all duration-300 h-36 justify-center gap-3 ${
                    !opt.available
                      ? 'opacity-40 cursor-not-allowed border-white/[0.03] bg-white/[0.002]'
                      : isActive
                        ? 'border-[#5e6ad2] bg-[#5e6ad2]/[0.04] shadow-[0_0_15px_rgba(94,106,210,0.15)] cursor-pointer active:scale-[0.98]'
                        : 'border-white/[0.05] bg-white/[0.005] hover:border-white/[0.1] hover:bg-white/[0.02] cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${opt.bgColor} ${
                    opt.value === 'google' ? 'shadow-md' : ''
                  }`}>
                    {opt.icon}
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-[11px] font-mono tracking-[0.1em] ${
                      isActive ? 'text-white' : 'text-gray-400'
                    }`}>
                      {opt.label}
                    </span>
                    <span className={`text-[9px] font-mono mt-1 ${
                      opt.available ? 'text-gray-600' : 'text-gray-700'
                    }`}>
                      {opt.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
