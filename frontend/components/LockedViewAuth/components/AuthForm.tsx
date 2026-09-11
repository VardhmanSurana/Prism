import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Download, 
  ShieldCheck, 
  Fingerprint, 
  Copy, 
  RotateCcw,
  FileText
} from 'lucide-react';
import { API_BASE } from '../../../constants';
import { SecurityFooter } from './SecurityFooter';

interface AuthFormProps {
  isConfigured: boolean;
  error: string;
  submitting: boolean;
  onSetup: (password: string) => Promise<boolean>;
  onVerify: (password: string) => Promise<boolean>;
  onAuthenticate: () => void;
  setError: (error: string) => void;
  setSubmitting: (submitting: boolean) => void;
}

export function AuthForm({
  isConfigured,
  error,
  submitting,
  onSetup,
  onVerify,
  onAuthenticate,
  setError,
  setSubmitting
}: AuthFormProps): React.ReactElement {
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [enableOsEscrow, setEnableOsEscrow] = useState<boolean>(true);

  // Recovery kit dialog state (Option 3)
  const [emergencyKitDoc, setEmergencyKitDoc] = useState<string | null>(null);
  const [armoredToken, setArmoredToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Recovery mode state
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [recoveryTokenInput, setRecoveryTokenInput] = useState<string>('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError("Password cannot be empty");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/vault/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          enable_os_escrow: enableOsEscrow,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to initialize encrypted vault');
      }

      const data = await res.json();
      if (data.emergency_kit_document && data.armored_recovery_token) {
        setEmergencyKitDoc(data.emergency_kit_document);
        setArmoredToken(data.armored_recovery_token);
      } else {
        await onSetup(password);
        onAuthenticate();
      }
    } catch (err: any) {
      setError(err.message || "Failed to configure Locked Folder");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadEmergencyKit = () => {
    if (!emergencyKitDoc) return;
    const blob = new Blob([emergencyKitDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prism-vault-recovery.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyArmoredToken = () => {
    if (!armoredToken) return;
    navigator.clipboard.writeText(armoredToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/vault/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        await onVerify(password);
        onAuthenticate();
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("Failed to communicate with vault");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!recoveryTokenInput.trim()) {
      setError("Please enter your emergency recovery token");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/vault/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_token: recoveryTokenInput.trim() }),
      });

      if (res.ok) {
        onAuthenticate();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Invalid emergency recovery token");
      }
    } catch (err: any) {
      setError(err.message || "Failed to recover vault");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockWithOsEscrow = async () => {
    setError('');
    setSubmitting(true);
    try {
      // In desktop Tauri or web context, simulate OS Keychain escrow check
      const escrowToken = localStorage.getItem('prism_vault_escrow_token');
      if (!escrowToken) {
        setError("No OS Keyring escrow token found on this system.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/v1/vault/unlock-escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrow_token: escrowToken }),
      });

      if (res.ok) {
        onAuthenticate();
      } else {
        setError("OS Keyring token is expired or invalid.");
      }
    } catch (err: any) {
      setError("Failed to unlock with OS Keyring");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-surface border border-white/5 rounded-3xl p-8 shadow-2xl relative z-10 animate-agent-pop">
        
        {/* Emergency Kit Modal (Option 3) */}
        {emergencyKitDoc ? (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto">
              <ShieldCheck size={32} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Vault Initialized</h2>
              <p className="text-xs text-gray-400 mt-1">
                Save your Emergency Recovery Kit now. This key is your only way to recover locked media if you forget your password.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-left space-y-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Emergency Token</span>
              <div className="font-mono text-xs text-primary bg-black/40 p-2.5 rounded-xl break-all border border-white/5 select-all">
                {armoredToken}
              </div>

              <button
                onClick={handleCopyArmoredToken}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white pt-1"
              >
                {copiedToken ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedToken ? "Copied to Clipboard" : "Copy Token"}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleDownloadEmergencyKit}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <Download size={15} />
                <span>Download Emergency Kit (.txt)</span>
              </button>

              <button
                onClick={onAuthenticate}
                className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-colors"
              >
                I Have Saved My Recovery Key → Enter Vault
              </button>
            </div>
          </div>
        ) : isRecovering ? (
          /* Recovery Mode */
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mx-auto mb-3">
                <FileText size={24} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Recover Vault Access</h2>
              <p className="text-xs text-gray-400 mt-1">
                Paste your emergency recovery token or authenticate via OS Keyring.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRecoverWithToken} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1.5">
                  Armored Recovery Token
                </label>
                <textarea
                  rows={3}
                  value={recoveryTokenInput}
                  onChange={(e) => setRecoveryTokenInput(e.target.value)}
                  placeholder="PRISM-RECOVERY-XXXX-XXXX-XXXX-..."
                  className="w-full bg-surfaceHover border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder:text-gray-600 focus:border-primary focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-colors disabled:opacity-50"
              >
                {submitting ? "Verifying Token..." : "Unlock with Emergency Key"}
              </button>

              <button
                type="button"
                onClick={handleUnlockWithOsEscrow}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-gray-300 text-xs font-medium transition-colors"
              >
                <Fingerprint size={15} className="text-primary" />
                <span>Unlock via OS Keyring / Biometrics</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRecovering(false);
                  setError('');
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-300 pt-1"
              >
                Back to Master Password
              </button>
            </form>
          </div>
        ) : (
          /* Normal Setup / Verify Form */
          <div>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-surfaceHover border border-white/5 rounded-2xl flex items-center justify-center text-primary shadow-inner mb-4 relative group">
                <Lock size={28} />
              </div>
              
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {isConfigured ? "Access Locked Vault" : "Configure Secure Vault"}
              </h2>
              <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed">
                {isConfigured 
                  ? "Enter your master passcode to decrypt and view private photos." 
                  : "Set a master passcode. Photos moved to this folder are encrypted at rest with AES-256-GCM."}
              </p>
            </div>

            {error && (
              <div className="p-3 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={isConfigured ? handleVerify : handleSetup} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1.5">
                  {isConfigured ? "Master Passcode" : "Create Master Passcode"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isConfigured ? "Enter passcode..." : "At least 6 characters..."}
                    className="w-full bg-surfaceHover border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {!isConfigured && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-300 block mb-1.5">
                      Confirm Master Passcode
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat passcode..."
                      className="w-full bg-surfaceHover border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Option 2 Escrow Checkbox */}
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="enableOsEscrow"
                      checked={enableOsEscrow}
                      onChange={(e) => setEnableOsEscrow(e.target.checked)}
                      className="mt-0.5 accent-primary cursor-pointer"
                    />
                    <label htmlFor="enableOsEscrow" className="text-xs text-gray-300 cursor-pointer">
                      <span className="font-semibold text-white block">Enable OS Keyring Escrow (Option 2)</span>
                      <span className="text-gray-400 text-[11px] block mt-0.5">
                        Permits biometric / system login recovery on this computer if password is lost.
                      </span>
                    </label>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-colors disabled:opacity-50 mt-2"
              >
                {submitting ? "Processing..." : isConfigured ? "Unlock Vault" : "Initialize Secure Vault"}
              </button>

              {isConfigured && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovering(true);
                      setError('');
                    }}
                    className="text-xs text-gray-400 hover:text-primary transition-colors"
                  >
                    Forgot Password? Use Recovery Key
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5">
          <SecurityFooter />
        </div>
      </div>
    </div>
  );
}
