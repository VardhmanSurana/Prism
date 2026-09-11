import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Server,
  Radio,
  Wifi,
  CheckCircle2,
  ExternalLink,
  X,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { getApiBase, setApiBase } from '@/constants';

interface DiscoveredPeer {
  peer_id: string;
  hostname: string;
  device_type: string;
  ip: string;
  port: number;
  version: string;
  last_seen_secs_ago: number;
}

export interface ServerConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerConnectionModal: React.FC<ServerConnectionModalProps> = ({ isOpen, onClose }) => {
  const currentUrl = getApiBase();
  const isDefaultLocal =
    currentUrl.includes('127.0.0.1') || currentUrl.includes('localhost') || currentUrl === '';

  const [selectedMode, setSelectedMode] = useState<'local' | 'remote'>(
    isDefaultLocal ? 'local' : 'remote'
  );
  const [remoteUrl, setRemoteUrl] = useState(isDefaultLocal ? '' : currentUrl);
  const [nearbyPeers, setNearbyPeers] = useState<DiscoveredPeer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Scan for nearby LAN peers
  const scanPeers = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`${currentUrl}/api/v1/lan/nearby`);
      if (res.ok) {
        const data = await res.json();
        setNearbyPeers(data.peers || []);
      }
    } catch (e) {
      console.warn('Could not scan for LAN peers:', e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanPeers();
    }
  }, [isOpen]);

  const handleApplyLocal = () => {
    setApiBase('http://127.0.0.1:8269');
    setStatusMessage('Switched to local device instance. Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleApplyRemote = (targetUrl: string) => {
    const clean = targetUrl.trim().replace(/\/+$/, '');
    if (!clean) return;
    setApiBase(clean);
    setStatusMessage(`Connecting to ${clean}... Reloading...`);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#14171D] border border-white/10 shadow-2xl p-7 text-white z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Wifi size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Prism Connection & Library</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Seamlessly connect to this device or a remote LAN server
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setSelectedMode('local')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedMode === 'local'
                  ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/40'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Laptop size={20} className={selectedMode === 'local' ? 'text-primary' : 'text-gray-400'} />
                {isDefaultLocal && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                    Active
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white">Use This Device</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Zero-config bundled backend on this machine
              </div>
            </button>

            <button
              onClick={() => setSelectedMode('remote')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedMode === 'remote'
                  ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/40'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Server size={20} className={selectedMode === 'remote' ? 'text-primary' : 'text-gray-400'} />
                {!isDefaultLocal && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                    Active
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white">Connect to my Prism</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Pair with a NAS or remote server over LAN
              </div>
            </button>
          </div>

          {/* Content Area */}
          {selectedMode === 'local' ? (
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <HardDrive size={15} className="text-primary" />
                  <span>Local Storage & Compute</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Prism runs entirely in-process on this machine. Photos are saved in your local
                  directory, and AI features utilize your device CPU/GPU.
                </p>
              </div>

              {!isDefaultLocal && (
                <button
                  onClick={handleApplyLocal}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  Switch to This Device
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {/* Discovered LAN Peers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-300">Discovered LAN Servers</span>
                  <button
                    onClick={scanPeers}
                    disabled={isScanning}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />
                    <span>Scan</span>
                  </button>
                </div>

                {nearbyPeers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-500">
                    {isScanning ? 'Searching for Prism instances on your Wi-Fi...' : 'No other Prism servers found on the subnet.'}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {nearbyPeers.map((peer) => {
                      const peerUrl = `http://${peer.ip}:${peer.port}`;
                      const isCurrent = currentUrl === peerUrl;
                      return (
                        <div
                          key={peer.peer_id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10"
                        >
                          <div className="flex items-center gap-2.5">
                            <Radio size={15} className="text-emerald-400" />
                            <div>
                              <div className="text-xs font-medium text-white">{peer.hostname}</div>
                              <div className="text-[10px] text-gray-400">{peerUrl}</div>
                            </div>
                          </div>

                          {isCurrent ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                              <CheckCircle2 size={13} />
                              <span>Connected</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApplyRemote(peerUrl)}
                              className="px-3 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-medium transition-colors"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Manual URL Input */}
              <div className="pt-2 border-t border-white/5">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Custom Server Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8269"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => handleApplyRemote(remoteUrl)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Data sovereignty hint */}
              <div className="text-[11px] text-gray-400 leading-relaxed">
                When connected to a remote Prism, your local browser directly accesses the NAS/server
                database. Uploads stream over your high-speed LAN without hitting the cloud.
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs text-center font-medium mb-4">
              {statusMessage}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/**
 * ServerConnectionPill - Compact indicator button in the header.
 */
export const ServerConnectionPill: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const currentUrl = getApiBase();
  const isDefaultLocal =
    currentUrl.includes('127.0.0.1') || currentUrl.includes('localhost') || currentUrl === '';

  const label = isDefaultLocal
    ? 'Local'
    : currentUrl.replace(/^https?:\/\//, '').replace(/:8269$/, '');

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-xs text-gray-300 hover:text-white transition-all cursor-pointer"
        title="Server & Library Connection"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
        <span className="text-[11px] font-medium truncate max-w-[110px]">{label}</span>
      </button>

      <ServerConnectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
