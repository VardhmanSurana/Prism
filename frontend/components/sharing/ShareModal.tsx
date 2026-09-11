import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Radio,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Laptop,
  Monitor,
  Smartphone,
  Lock,
  Clock,
  Shield,
  Trash2,
  Send,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import QRCode from 'qrcode';
import { API_BASE, getApiBase } from '@/constants';
import { Photo, Album } from '@/types';

export interface DiscoveredPeer {
  peer_id: string;
  hostname: string;
  device_type: string;
  ip: string;
  port: number;
  last_seen: string;
}

export interface ShareTarget {
  type: 'photo' | 'album' | 'selection';
  photo?: Photo;
  album?: Album;
  photoIds?: string[];
  count?: number;
}

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ShareTarget;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, target }) => {
  const [activeTab, setActiveTab] = useState<'easyshare' | 'link'>('easyshare');

  // EasyShare state
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Link & QR state
  const [localIp, setLocalIp] = useState<string>('127.0.0.1');
  const [serverPort, setServerPort] = useState<number>(8269);
  const [expiresIn, setExpiresIn] = useState<number | null>(86400); // default 24h
  const [password, setPassword] = useState('');
  const [hideGps, setHideGps] = useState(true);
  const [hideExif, setHideExif] = useState(false);
  const [downloadOriginal, setDownloadOriginal] = useState(true);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Resolve target photo IDs
  const getPhotoIds = (): string[] => {
    if (target.photoIds && target.photoIds.length > 0) return target.photoIds;
    if (target.photo?.id) return [String(target.photo.id)];
    return [];
  };

  // Fetch nearby peers and network info
  const scanPeers = async () => {
    setIsScanning(true);
    setSendError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/lan/nearby`);
      if (res.ok) {
        const data = await res.json();
        setPeers(data.peers || []);
        if (data.local_ip) setLocalIp(data.local_ip);
        if (data.port) setServerPort(data.port);
      }
    } catch (err) {
      console.error('Failed to scan nearby peers:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanPeers();
      setSendSuccess(null);
      setSendError(null);
      setCopied(false);
    }
  }, [isOpen]);

  // Generate QR Code on canvas when shareUrl updates
  useEffect(() => {
    if (shareUrl && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        shareUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) {
            console.error('QR code render error:', error);
            setQrError('Failed to generate QR code');
          } else {
            setQrError(null);
          }
        }
      );
    }
  }, [shareUrl, activeTab]);

  if (!isOpen) return null;

  // Handle Direct Push (EasyShare)
  const handleSendToPeer = async (peer: DiscoveredPeer) => {
    const photoIds = getPhotoIds().map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
    if (photoIds.length === 0) {
      setSendError('No photos selected to send');
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);
    setSelectedPeer(peer);

    try {
      const res = await fetch(`${API_BASE}/api/v1/lan/push-to-peer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer_ip: peer.ip,
          peer_port: peer.port,
          photo_ids: photoIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendSuccess(`Successfully transferred ${data.transferred_count} photo${data.transferred_count > 1 ? 's' : ''} to ${peer.hostname}!`);
      } else {
        setSendError(data.errors?.[0] || 'Transfer failed. Check connection with target device.');
      }
    } catch (err) {
      setSendError(`Failed to push to peer: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Link Creation
  const handleCreateShareLink = async () => {
    setIsCreatingLink(true);
    setSendError(null);
    try {
      const resourceType = target.type === 'album' ? 'album' : 'photo';
      const resourceId = target.type === 'album'
        ? String(target.album?.id || '')
        : (target.photo?.id ? String(target.photo.id) : getPhotoIds()[0] || '');

      if (!resourceId) {
        setSendError('Target resource not found');
        return;
      }

      const payload = {
        resource_type: resourceType,
        resource_id: resourceId,
        expires_in_secs: expiresIn,
        password: password.trim() ? password.trim() : null,
        hide_gps: hideGps,
        hide_exif: hideExif,
        download_original: downloadOriginal,
      };

      const res = await fetch(`${API_BASE}/api/v1/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setShareToken(data.share_token);

        // Build accessible LAN URL
        const baseOrigin = localIp !== '127.0.0.1'
          ? `http://${localIp}:${serverPort}`
          : (typeof window !== 'undefined' ? window.location.origin : `http://127.0.0.1:${serverPort}`);
        const fullShareUrl = `${baseOrigin}/share/${data.share_token}`;
        setShareUrl(fullShareUrl);
      } else {
        const errText = await res.text();
        setSendError(`Failed to create share link: ${errText}`);
      }
    } catch (err) {
      setSendError(`Error creating share link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleRevokeShare = async () => {
    if (!shareToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/shares/${shareToken}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setShareToken(null);
        setShareUrl(null);
        setSendSuccess('Share link revoked successfully.');
      }
    } catch (err) {
      console.error('Failed to revoke share:', err);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'laptop':
        return <Laptop size={22} className="text-blue-400" />;
      case 'mobile':
      case 'smartphone':
        return <Smartphone size={22} className="text-emerald-400" />;
      default:
        return <Monitor size={22} className="text-indigo-400" />;
    }
  };

  const targetLabel = target.type === 'album'
    ? `Album "${target.album?.name || 'Selected'}"`
    : target.type === 'selection'
    ? `${target.count || getPhotoIds().length} selected photos`
    : 'Photo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#14161f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 text-primary">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Share Media</h2>
              <p className="text-xs text-gray-400">{targetLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-white/[0.01] p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('easyshare')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'easyshare'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={15} />
            <span>EasyShare (AirDrop Mode)</span>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'link'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode size={15} />
            <span>Web Link & QR Code</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Status Banners */}
          {sendSuccess && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in">
              <Check size={16} className="shrink-0 text-emerald-400" />
              <span>{sendSuccess}</span>
            </div>
          )}

          {sendError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{sendError}</span>
            </div>
          )}

          {/* TAB 1: EasyShare Mode */}
          {activeTab === 'easyshare' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Nearby Prism Devices</h3>
                  <p className="text-xs text-gray-400">Direct zero-configuration push over your Wi-Fi</p>
                </div>
                <button
                  onClick={scanPeers}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs transition-colors border border-white/5"
                >
                  <RefreshCw size={13} className={isScanning ? 'animate-spin text-primary' : ''} />
                  <span>{isScanning ? 'Scanning...' : 'Refresh'}</span>
                </button>
              </div>

              {peers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <div className="relative mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Radio size={24} />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-primary/40 animate-ping" />
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">Scanning Local Subnet...</h4>
                  <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                    Make sure Prism is running on your other computer or laptop connected to the same Wi-Fi network.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {peers.map((peer) => (
                    <div
                      key={peer.peer_id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                          {getDeviceIcon(peer.device_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{peer.hostname}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Online
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400">
                            {peer.ip}:{peer.port}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendToPeer(peer)}
                        disabled={isSending}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-black hover:bg-primary/90 text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSending && selectedPeer?.peer_id === peer.peer_id ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Send Photos</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Web Link & QR Code Mode */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              {!shareUrl ? (
                <>
                  {/* Privacy & Expiry Settings */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
                        <Clock size={14} className="text-primary" />
                        <span>Link Expiration</span>
                      </label>
                      <select
                        value={expiresIn === null ? 0 : expiresIn}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setExpiresIn(val === 0 ? null : val);
                        }}
                        className="bg-[#1a1d26] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary"
                      >
                        <option value={3600}>1 Hour</option>
                        <option value={86400}>24 Hours (Recommended)</option>
                        <option value={604800}>7 Days</option>
                        <option value={0}>Never Expire</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
                        <Lock size={14} className="text-primary" />
                        <span>Password Protection</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Optional passcode"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-44 bg-[#1a1d26] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer select-none">
                        <span className="flex items-center gap-2">
                          <Shield size={14} className="text-emerald-400" />
                          <span>Strip GPS location coordinates</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={hideGps}
                          onChange={(e) => setHideGps(e.target.checked)}
                          className="rounded border-white/20 text-primary focus:ring-0 focus:ring-offset-0 bg-white/5"
                        />
                      </label>

                      <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer select-none">
                        <span className="flex items-center gap-2">
                          <Shield size={14} className="text-blue-400" />
                          <span>Strip camera EXIF hardware metadata</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={hideExif}
                          onChange={(e) => setHideExif(e.target.checked)}
                          className="rounded border-white/20 text-primary focus:ring-0 focus:ring-offset-0 bg-white/5"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateShareLink}
                    disabled={isCreatingLink}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-black font-semibold text-xs shadow-lg hover:bg-primary/90 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isCreatingLink ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Generating Secure Token...</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        <span>Generate Share Link & QR Code</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Generated Share Link View */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                    <div className="p-3 bg-white rounded-xl shadow-lg mb-3">
                      <canvas ref={canvasRef} className="w-[200px] h-[200px]" />
                    </div>
                    <p className="text-[11px] text-gray-400 text-center max-w-xs">
                      Scan with any smartphone camera on the same Wi-Fi network to view or download.
                    </p>
                  </div>

                  {/* Copy Link Input */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#1a1d26] border border-white/10">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-transparent px-2 text-xs text-gray-200 font-mono focus:outline-none select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-primary text-black hover:bg-primary/90'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check size={13} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Share Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={13} />
                      <span>Open Recipient Portal</span>
                    </a>

                    <button
                      onClick={handleRevokeShare}
                      className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Revoke Link</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
