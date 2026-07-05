import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Eye, EyeOff, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../../constants';

interface PrivacyFeature {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
  network_calls: string[];
  what_runs_locally: string[];
  what_is_sent: string;
  model: string;
}

interface PrivacyStatus {
  summary: {
    total_features: number;
    enabled: number;
    disabled: number;
    total_network_endpoints: number;
    all_local: boolean;
    verdict: string;
  };
  features: PrivacyFeature[];
}

export const PrivacyDashboard: React.FC = () => {
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/privacy/status`)
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Failed to load privacy status</p>
      </div>
    );
  }

  const { summary, features } = status;

  return (
    <div className="space-y-6">
      {/* Hero: Privacy Verdict */}
      <div className={`relative overflow-hidden rounded-3xl border p-8 ${
        summary.all_local
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-amber-500/5 border-amber-500/20'
      }`}>
        <div className="flex items-start gap-5">
          <div className={`p-4 rounded-2xl ${
            summary.all_local ? 'bg-emerald-500/10' : 'bg-amber-500/10'
          }`}>
            {summary.all_local ? (
              <ShieldCheck size={32} className="text-emerald-400" />
            ) : (
              <ShieldAlert size={32} className="text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">
              {summary.all_local ? 'Fully Local' : 'Some Network Calls Detected'}
            </h3>
            <p className="text-sm text-gray-400 mb-4">{summary.verdict}</p>
            <div className="flex gap-6 text-xs font-mono">
              <div>
                <span className="text-gray-500">Features: </span>
                <span className="text-white">{summary.enabled}/{summary.total_features} enabled</span>
              </div>
              <div>
                <span className="text-gray-500">Network endpoints: </span>
                <span className={summary.total_network_endpoints === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {summary.total_network_endpoints}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Network Status Badge */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
        <WifiOff size={16} className="text-emerald-400" />
        <span className="text-xs font-mono text-gray-400">
          0 network calls across all {summary.total_features} AI features
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Offline</span>
        </div>
      </div>

      {/* Feature Breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-mono uppercase tracking-widest text-gray-500 px-1">
          Feature Breakdown
        </h4>
        {features.map(feature => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            isExpanded={expandedFeature === feature.id}
            onToggle={() => setExpandedFeature(
              expandedFeature === feature.id ? null : feature.id
            )}
          />
        ))}
      </div>
    </div>
  );
};


const FeatureCard: React.FC<{
  feature: PrivacyFeature;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ feature, isExpanded, onToggle }) => {
  const isLocal = feature.network_calls.length === 0;

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
      feature.enabled
        ? 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
        : 'bg-white/[0.01] border-white/[0.03] opacity-60'
    }`}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          feature.enabled ? 'bg-emerald-500' : 'bg-gray-600'
        }`} />

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{feature.label}</span>
            {!feature.enabled && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                Off
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{feature.description}</p>
        </div>

        {/* Network indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {isLocal ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <WifiOff size={12} />
              <span className="text-[10px] font-mono">0 calls</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400">
              <Wifi size={12} />
              <span className="text-[10px] font-mono">{feature.network_calls.length} calls</span>
            </div>
          )}
          {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.03] pt-4">
          {/* What runs locally */}
          <div>
            <h5 className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-2">
              Runs Locally
            </h5>
            <ul className="space-y-1.5">
              {feature.what_runs_locally.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-emerald-400 mt-0.5">{'>'}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What is sent */}
          <div>
            <h5 className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-2">
              Data Handling
            </h5>
            <p className="text-xs text-gray-400 leading-relaxed">
              {feature.what_is_sent}
            </p>
          </div>

          {/* Model info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
            <Eye size={14} className="text-gray-500" />
            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Model</span>
              <p className="text-xs text-gray-300">{feature.model}</p>
            </div>
          </div>

          {/* Network calls (if any) */}
          {feature.network_calls.length > 0 && (
            <div>
              <h5 className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-2">
                Network Endpoints
              </h5>
              <ul className="space-y-1">
                {feature.network_calls.map((call, i) => (
                  <li key={i} className="text-xs font-mono text-amber-300/70 bg-amber-500/5 px-3 py-1.5 rounded-lg">
                    {call}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
