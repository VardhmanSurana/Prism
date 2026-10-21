import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../constants';
import { ShieldCheck, Server, Radio, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';

interface FeatureAudit {
  id: string;
  label: string;
  enabled: boolean;
  model: string;
  network_calls: string[];
  what_runs_locally: string[];
  what_is_sent: string;
}

interface PrivacyStatus {
  summary: {
    all_local: boolean;
    total_network_endpoints: number;
    verdict: string;
  };
  features: FeatureAudit[];
}

export const PrivacyDashboard: React.FC = () => {
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/utilities/privacy/audit`)
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-[#211f1e] border border-white/5 rounded-2xl flex items-center justify-center py-16">
        <span className="font-mono text-xs text-[#a8a29e] animate-pulse flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          Auditing local privacy sandbox & hardware boundaries...
        </span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-[#211f1e] border border-rose-900/30 rounded-2xl text-center py-12 font-mono text-xs text-rose-400">
        Failed to load privacy audit status from local engine.
      </div>
    );
  }

  const { summary, features } = status;

  return (
    <div className="space-y-6">
      {/* Data Flow Summary Bento Card */}
      <div className="bg-[#211f1e] border border-white/5 p-6 rounded-2xl flex flex-col gap-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#f5f0ed]">Data Flow &amp; Privacy Boundary Audit</h2>
              <p className="text-xs text-[#a8a29e] mt-0.5">{summary.verdict}</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs self-start sm:self-auto font-medium">
            {summary.all_local ? '100% Local Air-Gapped' : 'Remote APIs Enabled'}
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 flex flex-col justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Network Endpoints</span>
            <div className="font-serif text-2xl text-[#f5f0ed]">{summary.total_network_endpoints}</div>
            <span className="text-[11px] text-[#78716c]">External TCP sockets</span>
          </div>

          <div className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 flex flex-col justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">External Cloud APIs</span>
            <div className="font-serif text-2xl text-emerald-400">{summary.all_local ? 'Zero (Air-Gapped)' : 'Active'}</div>
            <span className="text-[11px] text-[#78716c]">Third-party telemetry calls</span>
          </div>

          <div className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 flex flex-col justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">Inference Telemetry</span>
            <div className="font-serif text-2xl text-[#f5f0ed]">Local NVMe Only</div>
            <span className="text-[11px] text-[#78716c]">Encrypted SQLite WAL logs</span>
          </div>
        </div>
      </div>

      {/* Feature Breakdown Cards */}
      <div className="space-y-3">
        <div className="font-mono text-[11px] uppercase text-[#78716c] tracking-[0.14em] px-1">
          Local AI Feature Pipeline Audit
        </div>

        <div className="space-y-2">
          {features.map((feature) => {
            const isExpanded = expandedFeature === feature.id;
            const isLocal = feature.network_calls.length === 0;

            return (
              <div
                key={feature.id}
                className="bg-[#211f1e] border border-white/5 rounded-2xl overflow-hidden transition-colors hover:border-white/10"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFeature(isExpanded ? null : feature.id)}
                  className="w-full p-4 flex items-center justify-between text-left cursor-pointer transition-colors hover:bg-white/[0.01]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        feature.enabled
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                          : 'bg-[#78716c]'
                      }`}
                    />
                    <span className="text-sm font-medium text-[#f5f0ed]">{feature.label}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] ${
                        isLocal
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isLocal ? 'LOCAL ONLY' : `${feature.network_calls.length} ENDPOINTS`}
                    </span>
                    <ChevronRight
                      size={15}
                      className={`text-[#78716c] transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 pt-3 border-t border-white/5 bg-[#1d1b1a] space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-[#78716c] uppercase tracking-wider block mb-1">
                        Runs Locally
                      </span>
                      <ul className="space-y-1">
                        {feature.what_runs_locally.map((item, i) => (
                          <li key={i} className="text-[#a8a29e] flex items-center gap-2">
                            <span className="text-emerald-400">&gt;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#78716c] uppercase tracking-wider block mb-1">
                        Data Handling
                      </span>
                      <p className="text-[#a8a29e]">{feature.what_is_sent}</p>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] text-[#78716c] uppercase tracking-wider">
                        Active Neural Model
                      </span>
                      <span className="text-[#f5f0ed] font-medium">{feature.model}</span>
                    </div>

                    {feature.network_calls.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[10px] text-amber-400 uppercase tracking-wider block mb-1">
                          Network Endpoints
                        </span>
                        <ul className="space-y-1">
                          {feature.network_calls.map((call, i) => (
                            <li
                              key={i}
                              className="text-amber-300 bg-[#100e0d] p-2 rounded-lg border border-amber-500/20"
                            >
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
          })}
        </div>
      </div>
    </div>
  );
};
