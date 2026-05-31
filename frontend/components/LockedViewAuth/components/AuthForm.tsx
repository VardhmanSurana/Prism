import React, { useState } from 'react';
import { Lock, KeyRound, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
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

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError("Password cannot be empty");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    const success = await onSetup(password);
    if (success) {
      onAuthenticate();
    } else {
      setError("Failed to configure Locked Folder");
    }
    setSubmitting(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setSubmitting(true);
    const success = await onVerify(password);
    if (success) {
      onAuthenticate();
    } else {
      setError("Incorrect password. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center h-full w-full px-4 relative overflow-hidden">
      {/* Background glowing atmospheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-surface/90 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative z-10 animate-agent-pop">
        
        {/* Top Header Card */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-surfaceHover border border-white/5 rounded-2xl flex items-center justify-center text-primary shadow-inner mb-4 relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Lock size={28} className="transition-transform duration-300 group-hover:scale-110" />
          </div>
          
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isConfigured ? "Access Locked Folder" : "Configure Locked Folder"}
          </h2>
          <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed">
            {isConfigured 
              ? "All files inside the Locked Folder are fully encrypted using military-grade AES encryption. Please authenticate to view them." 
              : "Set up a lock password. Moving items here encrypts them on disk and removes them from the general timeline."
            }
          </p>
        </div>

        {/* Action Form */}
        <form onSubmit={isConfigured ? handleVerify : handleSetup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-white/5 border border-white/10 focus:border-primary/50 outline-none rounded-xl py-3 pl-11 pr-10 text-sm text-white placeholder-gray-600 transition-all focus:bg-white/[0.08]"
              />
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!isConfigured && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  className="w-full bg-white/5 border border-white/10 focus:border-primary/50 outline-none rounded-xl py-3 pl-11 pr-10 text-sm text-white placeholder-gray-600 transition-all focus:bg-white/[0.08]"
                />
                <Check size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/10 px-4 py-3 rounded-xl animate-in shake duration-300">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-primary text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-primary/10 mt-6"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-t-black border-black/10 rounded-full animate-spin" />
            ) : isConfigured ? (
              "Unlock Folder"
            ) : (
              "Configure & Enter"
            )}
          </button>
        </form>

        <SecurityFooter />
      </div>
    </div>
  );
}
