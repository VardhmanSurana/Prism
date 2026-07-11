import React, { useState } from 'react';
import { HardDrive, X } from 'lucide-react';
import { API_BASE } from '../../constants';
import { CloudProviderInfo, ExternalLocation, ExternalProviderId } from './types';

interface AddExternalLocationFormProps {
  providers: CloudProviderInfo[];
  onCreated: (loc: ExternalLocation) => void;
  onCancel: () => void;
}

export const AddExternalLocationForm: React.FC<AddExternalLocationFormProps> = ({
  providers,
  onCreated,
  onCancel,
}) => {
  const readyProviders = providers.filter((p) => p.ready);
  const [provider, setProvider] = useState<ExternalProviderId>(
    (readyProviders[0]?.id as ExternalProviderId) || 'local_path'
  );
  const [name, setName] = useState('');
  const [mountPath, setMountPath] = useState('');
  const [smbHost, setSmbHost] = useState('');
  const [smbShare, setSmbShare] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = providers.find((p) => p.id === provider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const body: Record<string, unknown> = {
      provider,
      name: name.trim(),
      enabled: true,
    };

    if (provider === 'local_path' || provider === 'smb') {
      if (!mountPath.trim()) {
        setError('Mount path is required (existing filesystem path)');
        return;
      }
      body.mount_path = mountPath.trim();
      if (provider === 'smb') {
        if (smbHost.trim()) body.smb_host = smbHost.trim();
        if (smbShare.trim()) body.smb_share = smbShare.trim();
      }
    }

    if (provider === 's3') {
      if (!bucket.trim()) {
        setError('Bucket is required');
        return;
      }
      body.bucket = bucket.trim();
      if (region.trim()) body.region = region.trim();
      if (endpoint.trim()) body.endpoint = endpoint.trim();
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/external-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.detail === 'string' ? data.detail : 'Failed to save location');
        return;
      }
      onCreated(data as ExternalLocation);
    } catch {
      setError('Connection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-[#101010] p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50 inline-flex items-center gap-1.5">
          <HardDrive size={11} className="text-primary" />
          Add network / cloud location
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Provider</span>
        <div className="flex flex-wrap gap-1.5">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id as ExternalProviderId)}
              title={p.description}
              className={`px-2.5 py-1 text-[10px] rounded-lg border uppercase tracking-wider font-semibold transition-all cursor-pointer
                ${
                  provider === p.id
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }
                ${!p.ready ? 'opacity-70' : ''}`}
            >
              {p.label}
              {!p.ready ? ' · soon' : ''}
            </button>
          ))}
        </div>
        {selected && (
          <p className="text-[10px] text-white/35 leading-relaxed">{selected.description}</p>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Display name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
          placeholder="e.g. Home NAS"
          autoFocus
        />
      </label>

      {(provider === 'local_path' || provider === 'smb') && (
        <>
          <label className="block space-y-1">
            <span className="text-[10px] font-mono uppercase text-white/40">
              Mount path (existing on this machine)
            </span>
            <input
              value={mountPath}
              onChange={(e) => setMountPath(e.target.value)}
              className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
              placeholder="/mnt/nas or /run/media/user/Drive"
            />
          </label>
          {provider === 'smb' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-white/40">SMB host</span>
                <input
                  value={smbHost}
                  onChange={(e) => setSmbHost(e.target.value)}
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
                  placeholder="192.168.1.10"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-white/40">Share</span>
                <input
                  value={smbShare}
                  onChange={(e) => setSmbShare(e.target.value)}
                  className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
                  placeholder="photos"
                />
              </label>
            </div>
          )}
        </>
      )}

      {provider === 's3' && (
        <div className="space-y-2">
          <p className="text-[10px] text-amber-400/80">
            S3 is scaffolded — config is saved for a future browser connection.
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] font-mono uppercase text-white/40">Bucket</span>
            <input
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
              placeholder="my-photos-bucket"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-white/40">Region</span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
                placeholder="us-east-1"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-white/40">Endpoint</span>
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
                placeholder="optional"
              />
            </label>
          </div>
        </div>
      )}

      {provider === 'gdrive' && (
        <p className="text-[10px] text-amber-400/80 leading-relaxed">
          Google Drive is scaffolded. OAuth linking is not active yet — you can still save a
          placeholder name for future setup.
        </p>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-white/10 text-white/60 hover:text-white rounded-lg cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold bg-primary text-black rounded-lg disabled:opacity-40 cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </form>
  );
};
