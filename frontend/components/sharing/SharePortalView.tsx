import React, { useState, useEffect } from 'react';
import {
  Download,
  Lock,
  Clock,
  Shield,
  Image as ImageIcon,
  AlertTriangle,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo, Album } from '@/types';

interface SharedResourceData {
  share: {
    id: number;
    share_token: string;
    resource_type: string;
    expires_at?: string | null;
    max_downloads?: number | null;
    download_count: number;
    hide_exif: boolean;
    hide_gps: boolean;
    download_original: boolean;
  };
  resource_type: string;
  photo?: Photo;
  album?: Album;
  album_photos?: Photo[];
}

export const SharePortalView: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [data, setData] = useState<SharedResourceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Extract token from URL pathname: /share/:token
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/share\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setToken(match[1]);
    } else {
      setError('Invalid or missing share link token');
      setLoading(false);
    }
  }, []);

  const loadSharedResource = async (pwd?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const pwdParam = pwd ? `?password=${encodeURIComponent(pwd)}` : '';
      const res = await fetch(`${API_BASE}/api/v1/shares/${token}${pwdParam}`);

      if (res.status === 401) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (res.status === 404 || res.status === 410) {
        const text = await res.text();
        setError(text || 'This share link has expired or is no longer available.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load shared content (status ${res.status})`);
      }

      const resData: SharedResourceData = await res.json();
      setData(resData);
      setNeedsPassword(false);
      if (resData.resource_type === 'photo' && resData.photo) {
        setSelectedPhoto(resData.photo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSharedResource();
    }
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    loadSharedResource(password.trim());
  };

  const getDownloadUrl = (photoId?: string | number) => {
    let url = `${API_BASE}/api/v1/shares/${token}/download`;
    const params = new URLSearchParams();
    if (password) params.append('password', password);
    if (photoId) params.append('photo_id', String(photoId));
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white flex flex-col selection:bg-primary/30 selection:text-white">
      {/* Top Navbar */}
      <header className="h-16 px-6 sm:px-10 border-b border-white/10 bg-[#12141f]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles size={18} className="text-black" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">Prism Share</h1>
            <p className="text-[10px] text-gray-400 font-mono">Private Local Cloud</p>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:inline">
              Downloads: <strong className="text-white">{data.share.download_count}</strong>
              {data.share.max_downloads ? ` / ${data.share.max_downloads}` : ''}
            </span>
            {data.resource_type === 'photo' && (
              <a
                href={getDownloadUrl()}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95"
              >
                <Download size={14} />
                <span>Download Photo</span>
              </a>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Loading shared media...</span>
          </div>
        )}

        {/* Error / Expired State */}
        {!loading && error && (
          <div className="max-w-md w-full p-8 rounded-2xl bg-[#151824] border border-white/10 text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Share Unavailable</h2>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">{error}</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 transition-colors border border-white/10"
            >
              <ArrowLeft size={14} />
              <span>Back to Library</span>
            </a>
          </div>
        )}

        {/* Password Prompt */}
        {!loading && needsPassword && (
          <div className="max-w-sm w-full p-8 rounded-2xl bg-[#151824] border border-white/10 shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Lock size={24} />
            </div>
            <h2 className="text-base font-semibold text-white text-center mb-1">Protected Media</h2>
            <p className="text-xs text-gray-400 text-center mb-6">
              Enter the passcode set by the owner to view this content.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1e2230] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all shadow-md"
              >
                Unlock Media
              </button>
            </form>
          </div>
        )}

        {/* Single Photo Display */}
        {!loading && data && data.resource_type === 'photo' && data.photo && (
          <div className="max-w-4xl w-full flex flex-col items-center gap-6">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl max-h-[75vh] flex items-center justify-center group">
              <img
                src={getDownloadUrl()}
                alt={data.photo.filename || data.photo.caption || 'Shared Photo'}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>

            {/* Photo Metadata Card */}
            <div className="w-full max-w-xl p-5 rounded-2xl bg-[#151824] border border-white/10 flex items-center justify-between shadow-xl">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {data.photo.filename || data.photo.caption || 'Untitled Photo'}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {data.photo.width && data.photo.height && (
                    <span>{data.photo.width} × {data.photo.height}</span>
                  )}
                  {formatFileSize(data.photo.file_size) && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(data.photo.file_size)}</span>
                    </>
                  )}
                  {data.photo.date_taken && (
                    <>
                      <span>•</span>
                      <span>{new Date(data.photo.date_taken).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>

              <a
                href={getDownloadUrl()}
                download
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95"
              >
                <Download size={14} />
                <span>Download</span>
              </a>
            </div>
          </div>
        )}

        {/* Album Display */}
        {!loading && data && data.resource_type === 'album' && (
          <div className="max-w-6xl w-full flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#151824] border border-white/10 shadow-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-primary/20 text-primary border border-primary/30">
                    SHARED ALBUM
                  </span>
                  <span className="text-xs text-gray-400">
                    {data.album_photos?.length || 0} items
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {data.album?.name || 'Shared Album'}
                </h2>
              </div>
            </div>

            {/* Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(data.album_photos || []).map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-[#151824] cursor-pointer hover:border-primary/50 transition-all shadow-md"
                >
                  <img
                    src={getDownloadUrl(photo.id)}
                    alt={photo.filename || photo.caption || 'Photo'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <span className="text-[11px] font-medium text-white truncate max-w-[70%]">
                      {photo.filename || photo.caption || 'Photo'}
                    </span>
                    <a
                      href={getDownloadUrl(photo.id)}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black transition-colors"
                      title="Download photo"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Fullscreen Photo Modal when clicking an album photo */}
            {selectedPhoto && (
              <div
                onClick={() => setSelectedPhoto(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-4"
                >
                  <img
                    src={getDownloadUrl(selectedPhoto.id)}
                    alt={selectedPhoto.filename || selectedPhoto.caption || 'Photo'}
                    className="max-h-[80vh] w-auto object-contain rounded-2xl border border-white/10 shadow-2xl"
                  />
                  <div className="flex items-center justify-between w-full px-4">
                    <span className="text-xs text-gray-300">
                      {selectedPhoto.filename || selectedPhoto.caption || 'Photo'}
                    </span>
                    <a
                      href={getDownloadUrl(selectedPhoto.id)}
                      download
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all shadow-md"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
