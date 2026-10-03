import React, { useRef, useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, MapPin, Tv, FileText, 
  Maximize2, Camera, Star, FolderOpen, Wallpaper,
  Edit2, Download, Share2, Trash2
} from 'lucide-react';
import { Album, SmartAlbum } from '../../types';
import { AlbumCard } from './AlbumCard';

export interface SystemAlbumItem {
  id: string;
  name: string;
  countLabel: string;
  iconName: string;
  coverUrl: string;
  type: 'smart';
  smart_type?: 'places' | 'screenshots' | 'documents';
}

export const PRISM_SYSTEM_ALBUMS: SystemAlbumItem[] = [
  {
    id: 'places',
    name: 'Places & Geotags',
    countLabel: '3,420 assets · 42 spots',
    iconName: 'location',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeKwRXrXCahY-oLZuM5BHbLqi0VzMlt86NpTRoF-0EJNdCcZwX3Bdgdl0HyZxmLQxdQogJmUMqzTom9gjCGYySi4QNhZTlZBbIGZYurw6SGCL2kdumgjPAOtza-ci5lKes-pWpETgIUts2_QC6MfdP0UujFxQFwPFyEpdESOS1_iZJ4z05LAZv8DX565111R9_icVRBj8e8ncdEEns-4VL-p5dSbNOItXMRTINAq7QTU_WdHjkYXot1A',
    type: 'smart',
    smart_type: 'places',
  },
  {
    id: 'screenshots',
    name: 'Screenshots & Captures',
    countLabel: '684 assets · PNG / WebP',
    iconName: 'screenshot',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCml2mGVfIwTgzXj7RPNMjgz0rqFJGkp0RcMgpjdwE7YyxTG0WDiYaJjYTc2xa8jwfBcahttrC3LaIcBMpRxOTOosvpsOXi4iFDn-LS_h6HZDC8WFLN96MXgI9LWh7XktRxGNFRFezJ7HrUyLV6Nqj6DJHzETu5K7XDHDUZqOGWBlhYnlpXN9FmZUc4c8CKu1k0W4YB37aBOTCEDhGnvUs_p_N38KcwMSWw_fe2dOvFDkKaC7Hv5yhHzg',
    type: 'smart',
    smart_type: 'screenshots',
  },
  {
    id: 'documents',
    name: 'Documents & OCR',
    countLabel: '182 files · Text searchable',
    iconName: 'document',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaHCJLhsFEdSGV1ilVFbm1qmVenGfQCgyPlHeLqf0rs2Bydw2or6k3ECN4mHaS6jSS3A-Z8R78S1IK4-RVEeouROZ4QIx4Ew6tkOShoZ6lPj5qq0gTuBFPt4yjHHy4uomhYvtXvldyr8JwssADSEmS40Tq14K6EQdrRkIez8XnkiGhkoGG2r1MoOqtTvqCV3StACxGac5h1raOOpYaAuCFGwgk_JmBv98SMvZzWJq25G3n8aVmIYEZaw',
    type: 'smart',
    smart_type: 'documents',
  },
  {
    id: 'panoramas',
    name: 'Panoramas & Ultra-Wide',
    countLabel: '94 exposures · Multi-stitch',
    iconName: 'panorama',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDMQU4QLr6hwFqikP9sOPv_HDoiIx58SWjh7cmmt4wAh5K6WZlSWrFFUVxR4aNCSJ2Tl4w4Xwp5BT5eGb8AN3ROQUGO12eTU1zW7cyWA24-vzi0_99ROMWND6aSCWwhAnYv5c3cxqdU7PMmqZ-GXhLCWR3Xl0C2cviRtdJNzXPq5ar_Qt9ShJDkrpRnyJFHk_EWY5zLv1c3RD3ATpq4IBKJwJazVx6Bq4Xb5mNFAvTjT3gN_F3oryzFVQ',
    type: 'smart',
  },
  {
    id: 'raw',
    name: 'RAW Negatives',
    countLabel: '4,110 masters · DNG & IIQ',
    iconName: 'raw',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRZH78Vnk8K37Ee8OO6BZ-Ajgdji0Bu3axnBVRPB-lWZhrVPMC7q3fEMv9vrcKsDXzkYyT2K1eKyzV2MLsaoHcTScQKvSWnYG68CFA6gtaNDApP4tzDaKNgU_HYUcqXUz09-RrH584FFCbuIrvIbPCzXWneMX3nH3fXS6-WTDivm1R-cMWt10tSLeOlGvgq6IdYC4P2ZIOlDhz8b_45ixy86DSa_-giDkJjlBkBIysqWPmyU_xhs_R3g',
    type: 'smart',
  },
  {
    id: 'favorites',
    name: 'Favorites & Starred',
    countLabel: '312 curated highlights',
    iconName: 'star',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBE-ll7MHyNkQbxauDW6zommRBEs05xLVHWcddl33X06w4orDdZeWbG_f_92Gv3lRYyPFPqfvHl-aDV9tNRmk3cVk6vZBYK57Qdx0V4INg_XzafMwty94uvHUTchDs55vZ4vmKAQI0CNEZDXnIjA9pssf2yLUbDAI0KOTnxF5Lhga0eRrPLd9A4s1n-FkebJrAJ_ZGH90jKSaJRgDg7ifG1adkhSJpcYflhxjM4EO_N6GlSg_ecmnaXYw',
    type: 'smart',
  },
];

export const PRISM_FEATURED_COLLECTIONS: Album[] = [
  {
    id: 'prism-chitrakote',
    name: 'Chitrakote Waterfalls Trip',
    type: 'custom',
    category: 'travel',
    photo_count: 340,
    video_count: 12,
    date_label: 'October 2023',
    location_label: 'Jagdalpur, Bastar',
    badge_label: '12 4K Clips',
    badge_icon: 'video',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-34colNfUL11ORoXotZaNEl13R7zgLiWqBjYY1lEF_dK_j1BFZxdyjjcZw4G2AWZPvS1raxsq9NigiQ01BJ_zwRsCiWSPJSwiv7Jq625bnW4yjmTQMOQ8WZxZhGp4VYbnM_69DrBOENJBZBm_SFVmiQz_LuJeJG7HuP5kbH92qXndnry0cdbOO1sj-QegtsEYlSSD_5seahvbSt0_cq6HfDGS-5PRqQ71DZK5FsD47Kdpm9vF56SlGA',
    created_at: '2023-10-15T00:00:00Z',
  },
  {
    id: 'prism-geedam',
    name: 'Geedam Wedding',
    type: 'custom',
    category: 'events',
    photo_count: 1280,
    video_count: 45,
    date_label: 'December 2023',
    location_label: 'Chhattisgarh',
    badge_label: 'Master Archive',
    badge_icon: 'verified',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYBlUaezqiVezTx0PO8QDhOJ6SZQT-qX618qBhowXKT-LFI1eEsZXuijLK9urZWWP8kGfBdiAr-GBuWnpiUOoyvo3ZZxqxWa7Vv15BcsXFRJIbBPvCauf6yc9iFMJKTb9X61kpbSa0X6D99RMe_SrK-AAigvp8pbN1iE5UeIk5tWyg7sbK2DxeekPXQdHYsPZRf05owNXRopxgqLz0YOK4cfnMCBSRRBKgmSdv00BAdNa2G5o-NK8hig',
    created_at: '2023-12-20T00:00:00Z',
  },
  {
    id: 'prism-atal-nagar',
    name: 'Atal Nagar-Nava Raipur Event',
    type: 'custom',
    category: 'events',
    photo_count: 520,
    video_count: 8,
    date_label: 'January 2024',
    location_label: 'Nava Raipur',
    badge_label: '8 Timelapses',
    badge_icon: 'timelapse',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOACdRkpuMNgdCSdaDegL22QXrbbl1-wvy4ygPfx26HcTd6wfUgkJriE51Inql1hSY8ULLRy16XqjJ5rStC5B7ic92PfaQeb4Ck7C-W6tdeh-E09-z8nHz-c0xG1hsAsavvttyOfNuiJuZb_RI7zrOsP0f46ws71IXil6Yk-XmieV0ZMvwfJuJAtJ8cwstJO_dkJ2lgewFoYXJTdUUqcRc2X6TriHpQtWwXz3EtURmTTh1r_pqYfJKBw',
    created_at: '2024-01-22T00:00:00Z',
  },
  {
    id: 'prism-lisbon',
    name: 'Lisbon & Sintra Monograph',
    type: 'custom',
    category: 'projects',
    photo_count: 620,
    video_count: 16,
    date_label: 'May 2024',
    location_label: 'Portugal',
    badge_label: '16 RAWs',
    badge_icon: 'camera',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwGyWVvbpYDLYM3AM0pGPFzNPYmz_RZoz3lCdRYkmPrCCVkTgQzL1FD9Ty6MxxU7SKNv2HcrnJbLDV7vzedPNyLhh0PlWG0j9CtUNaE8he7itRPK_ZaQZ6gcmOZbaImEm65o1Hl5O2q6PhXLZVZYOW1JjQW9OxByNs9y9P1hs3oHArGCiRnmZsyOK6FmmjhPKL2bLs2aj2D0UHrAZVOnba6JwGRSEJzYBDr87l7RGFs448Jr32Fg7fnQ',
    created_at: '2024-05-10T00:00:00Z',
  },
  {
    id: 'prism-kyoto',
    name: 'Kyoto Tea Houses & Zen Gardens',
    type: 'custom',
    category: 'travel',
    photo_count: 480,
    video_count: 0,
    date_label: 'September 2023',
    location_label: 'Kansai',
    badge_label: '4K HDR',
    badge_icon: 'hdr',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBB0Cl8j4Z984kjuEsGgEesH8ScnmextelcR1eKqlFmu-oWBYbgeIGvfkgfitQqVXm6_3IKHh5SFzGGBUDVt0RQ4-zYaG-x2_vSClTr_T8tzokwZrex017ZEMI46909sfXh6EJ91UKdf7syic5mOlysR4k8_3mxzySP_3uNS4KkuyytxOadSog7Sl67g8V_s0hE-7L1at766eDm9uwmNMXtUi8hFYvB765U1BJHKwHhWmIW3MUp44V9sg',
    created_at: '2023-09-18T00:00:00Z',
  },
  {
    id: 'prism-douro',
    name: 'Douro Valley Harvest Chronicles',
    type: 'custom',
    category: 'travel',
    photo_count: 750,
    video_count: 22,
    date_label: 'October 2023',
    location_label: 'Portugal',
    badge_label: '22 Videos',
    badge_icon: 'video',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHEbQ9323-rACGJTX6Azq2aEKwE46B8TX30MmWg49G3PI7HHu3r2FtEarqL-7uuSnZ2ZxusJBo_9ah53HmgpMq48d4f12TnSaV89bpxmGiRKi3FanEK9XfwLmjUmDn8qkdp5b4G4Arcni3-4qhX_XnSrMSaauAY1xVE66fvp9QOWJECP8FD2TDZx7fEJSdFGHJ4MSTRs_0cG7NeUajm6hECJ8DrCv-AzhtJpDrtwsUEwqBRw97N5UReg',
    created_at: '2023-10-28T00:00:00Z',
  },
  {
    id: 'prism-ceramics',
    name: 'Studio Ceramic Works Vol. II',
    type: 'custom',
    category: 'projects',
    photo_count: 195,
    video_count: 0,
    date_label: 'August 2023',
    location_label: 'Prism Archive',
    badge_label: 'Macro Proofs',
    badge_icon: 'verified',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAenKXv2t8JT6dhN99pKTSRHNrCpY5xPkdAlXozDxCi8ukldaa4B01MjJDhLcd2o7QqdL27mwFGvJtCme86Iejvj-vF3YlfRWnNpXaGEsyS90nuoVaqya00C2CCBgZmVFayWSCLUihFWP6mNGTDBR1gEOb-ZDCsC_k4FnpeBTbMigb1v27VRaaKqDOWsbDx3pxoz8W2r9E8mQfWvkefAiHphpfZg0kK7RQa2q79kMOPQ2zntr3LWWi3zA',
    created_at: '2023-08-14T00:00:00Z',
  },
  {
    id: 'prism-nordic',
    name: 'Nordic Coastlines & Fjords',
    type: 'custom',
    category: 'travel',
    photo_count: 890,
    video_count: 0,
    date_label: 'June 2023',
    location_label: 'Lofoten Islands',
    badge_label: 'Hasselblad X2D',
    badge_icon: 'camera',
    cover_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRv0KgEzg4DVQjyOc1irE_RpCM1I8Vuga5A9A7uLu1nNjDNVry0KuHMrdgTW9cPEk4RkSM60lymwE7UlVuOfe5PleoFm3HHQQgfrx0ZA07qsThWFkJRX8UAancbmj2u7-5XzxTepm-hNU7BMD47BQvh6Gxplvz0x9YGWKgO_6ESq7E67qMhlqlPpktlJURr4-x4LCDSXbPDMQe4GKMK3Y-54gz0yFi3OB6D7ZWdTCVfAsgb-6aRxRw7A',
    created_at: '2023-06-04T00:00:00Z',
  },
];

interface AlbumsListProps {
  albums: (Album | SmartAlbum)[];
  onAlbumClick: (album: Album | SmartAlbum) => void;
  onRenameAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onCreateAlbum: () => void;
  searchQuery?: string;
  sortBy?: 'Date Created' | 'Album Name' | 'Asset Count' | 'Recent Activity';
  viewMode?: 'comfortable' | 'compact' | 'detailed';
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

/**
 * AlbumsList - Prism smart & system albums carousel + custom collections grid.
 */
export const AlbumsList: React.FC<AlbumsListProps> = ({ 
  albums, 
  onAlbumClick, 
  onRenameAlbum,
  onDeleteAlbum,
  onCreateAlbum,
  searchQuery = '',
  sortBy = 'Date Created',
  viewMode = 'comfortable',
  activeCategory = 'all',
  onSelectCategory
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [internalCategory, setInternalCategory] = useState<string>('all');
  const currentCategory = onSelectCategory ? activeCategory : internalCategory;
  const setCategory = onSelectCategory || setInternalCategory;

  // Context menu state
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number;
    y: number;
    album: Album | SmartAlbum;
  } | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setMenuAnchor(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleScroll = (offset: number) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Smart backend albums mapped with demo hubs
  const backendSmart = albums.filter((a): a is SmartAlbum => a.type === 'smart');
  const customAlbumsFromBackend = albums.filter((a): a is Album => a.type !== 'smart');

  // Merge custom albums with Prism showcase if backend has few or no albums
  const mergedCustomAlbums: Album[] = [
    ...customAlbumsFromBackend,
    ...PRISM_FEATURED_COLLECTIONS.filter(
      featured => !customAlbumsFromBackend.some(b => String(b.id) === String(featured.id) || b.name === featured.name)
    ),
  ];

  // Filter custom albums by search query and category
  const filteredCustomAlbums = mergedCustomAlbums.filter(album => {
    const matchesSearch = !searchQuery || album.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = currentCategory === 'all' || (album.category || 'travel') === currentCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort filtered custom albums
  const sortedCustomAlbums = [...filteredCustomAlbums].sort((a, b) => {
    if (sortBy === 'Album Name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'Asset Count') {
      return (b.photo_count || 0) - (a.photo_count || 0);
    }
    if (sortBy === 'Date Created' || sortBy === 'Recent Activity') {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    }
    return 0;
  });

  const renderSmartIcon = (iconName: string) => {
    switch (iconName) {
      case 'location':
        return <MapPin size={16} className="text-[#e7e1df]" />;
      case 'screenshot':
        return <Tv size={16} className="text-[#e7e1df]" />;
      case 'document':
        return <FileText size={16} className="text-[#e7e1df]" />;
      case 'panorama':
        return <Maximize2 size={16} className="text-[#e7e1df]" />;
      case 'raw':
        return <Camera size={16} className="text-[#e7e1df]" />;
      case 'star':
        return <Star size={16} className="text-amber-300 fill-amber-300" />;
      default:
        return <FolderOpen size={16} className="text-[#e7e1df]" />;
    }
  };

  const handleOpenMenu = (album: Album | SmartAlbum, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuAnchor({
      x: Math.min(rect.left, window.innerWidth - 220),
      y: rect.bottom + 6,
      album,
    });
  };

  const handleSmartAlbumClick = (hub: SystemAlbumItem) => {
    // If there is an exact backend smart album match, use it
    const match = backendSmart.find(s => s.smart_type === hub.smart_type || s.id === hub.id);
    if (match) {
      onAlbumClick(match);
    } else {
      // Pass a synthesized smart album so the detail view can display it
      onAlbumClick({
        id: hub.id,
        name: hub.name,
        type: 'smart',
        smart_type: hub.smart_type || 'places',
        photo_count: parseInt(hub.countLabel.replace(/,/g, '')) || 100,
        cover_url: hub.coverUrl,
      });
    }
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* ── SECTION 1: SMART & SYSTEM ALBUMS ── */}
      <section className="flex flex-col gap-3 mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-[#a8a29e]">
              Smart &amp; System Albums
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#2c2928] text-[#c6c6c7] font-mono text-[10px] tracking-wider uppercase border border-white/[0.04]">
              Auto-Indexed
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll(-260)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#a8a29e] hover:text-[#f5f5f4] bg-[#1d1b1a] hover:bg-[#2c2928] border border-white/[0.06] transition-colors cursor-pointer shadow-sm"
              title="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll(260)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#a8a29e] hover:text-[#f5f5f4] bg-[#1d1b1a] hover:bg-[#2c2928] border border-white/[0.06] transition-colors cursor-pointer shadow-sm"
              title="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Horizontal Snap Scroll Carousel */}
        <div 
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {PRISM_SYSTEM_ALBUMS.map((hub) => (
            <article 
              key={hub.id}
              onClick={() => handleSmartAlbumClick(hub)}
              className="snap-start flex-shrink-0 w-64 group cursor-pointer select-none"
            >
              <div className="relative h-36 rounded-2xl bg-[#1d1b1a] overflow-hidden shadow-md border border-white/[0.05]">
                <img 
                  src={hub.coverUrl} 
                  alt={hub.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out brightness-[0.78] group-hover:brightness-95"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d] via-[#100e0d]/30 to-transparent" />
                
                {/* Floating Icon Badge */}
                <div className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-[#151312]/80 backdrop-blur-md flex items-center justify-center border border-white/[0.08] shadow-sm">
                  {renderSmartIcon(hub.iconName)}
                </div>

                {/* Bottom Labeling */}
                <div className="absolute bottom-2.5 left-3 right-3 flex flex-col">
                  <h3 className="font-serif text-[1.125rem] leading-tight text-[#f5f5f4] group-hover:text-white transition-colors truncate">
                    {hub.name}
                  </h3>
                  <p className="font-sans text-[0.75rem] text-[#a8a29e] mt-0.5 truncate">
                    {hub.countLabel}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── SECTION 2: CUSTOM COLLECTIONS ── */}
      <section className="flex flex-col gap-6">
        {/* Header with Category Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl sm:text-3xl text-[#f5f5f4] tracking-tight">
              Custom Collections
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#211f1e] border border-white/[0.08] text-[#a8a29e] font-mono text-[11px]">
              {sortedCustomAlbums.length} {sortedCustomAlbums.length === 1 ? 'Album' : 'Albums'}
            </span>
          </div>

          {/* Filter Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All' },
              { id: 'travel', label: 'Travel & Expeditions' },
              { id: 'events', label: 'Events & Ceremonies' },
              { id: 'projects', label: 'Projects & Monograph' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`category-chip px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  currentCategory === cat.id
                    ? 'bg-[#e7e1df] text-[#151312] shadow-sm'
                    : 'bg-[#1d1b1a] text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] border border-white/[0.04]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-column Grid based on View Mode */}
        {sortedCustomAlbums.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center rounded-2xl bg-[#1d1b1a]/40 border border-white/[0.04] p-8">
            <div className="w-14 h-14 rounded-2xl bg-[#211f1e] flex items-center justify-center text-[#78716c] mb-3 border border-white/[0.06]">
              <FolderOpen size={28} />
            </div>
            <h3 className="font-serif text-lg text-[#f5f5f4] mb-1">No collections found</h3>
            <p className="text-xs text-[#a8a29e] max-w-sm mb-4">
              {searchQuery ? `No albums matching "${searchQuery}".` : 'Create your first custom collection to organize master plates.'}
            </p>
            <button
              type="button"
              onClick={onCreateAlbum}
              className="px-4 py-2 rounded-full bg-[#e7e1df] text-[#151312] hover:bg-white text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              + Create New Collection
            </button>
          </div>
        ) : (
          <div 
            className={
              viewMode === 'compact'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 transition-all duration-300'
                : viewMode === 'detailed'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-6 transition-all duration-300'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300'
            }
          >
            {sortedCustomAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={onAlbumClick}
                onRename={onRenameAlbum}
                onDelete={onDeleteAlbum}
                onOpenMenu={handleOpenMenu}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Context Menu Floating Element ── */}
      {menuAnchor && (
        <div 
          className="fixed z-50 w-52 rounded-xl bg-[#211f1e] border border-white/[0.12] shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${menuAnchor.y}px`, left: `${menuAnchor.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            onClick={() => {
              alert(`Cover photo updated for "${menuAnchor.album.name}".`);
              setMenuAnchor(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium text-[#e7e1df] hover:bg-[#2c2928] hover:text-white transition-colors cursor-pointer"
          >
            <Wallpaper size={15} className="text-[#a8a29e]" />
            <span>Set Cover Photo</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (menuAnchor.album.type !== 'smart') {
                onRenameAlbum(menuAnchor.album as Album);
              }
              setMenuAnchor(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium text-[#e7e1df] hover:bg-[#2c2928] hover:text-white transition-colors cursor-pointer"
          >
            <Edit2 size={15} className="text-[#a8a29e]" />
            <span>Rename Album</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              alert(`Batch export initialized for "${menuAnchor.album.name}".`);
              setMenuAnchor(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium text-[#e7e1df] hover:bg-[#2c2928] hover:text-white transition-colors cursor-pointer"
          >
            <Download size={15} className="text-[#a8a29e]" />
            <span>Batch Export...</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(`prism://album/${menuAnchor.album.id}`);
                alert(`Vault link copied to clipboard: prism://album/${menuAnchor.album.id}`);
              }
              setMenuAnchor(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium text-[#e7e1df] hover:bg-[#2c2928] hover:text-white transition-colors cursor-pointer"
          >
            <Share2 size={15} className="text-[#a8a29e]" />
            <span>Share Vault Link</span>
          </button>

          <div className="h-[1px] bg-white/[0.08] my-1" />

          <button 
            type="button"
            onClick={() => {
              if (menuAnchor.album.type !== 'smart') {
                onDeleteAlbum(menuAnchor.album as Album);
              }
              setMenuAnchor(null);
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Delete Album</span>
          </button>
        </div>
      )}
    </div>
  );
};

