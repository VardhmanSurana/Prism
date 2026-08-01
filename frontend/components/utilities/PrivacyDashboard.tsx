import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, ChevronRight, ChevronDown } from 'lucide-react';
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
      <div className="cr-card flex items-center justify-center py-12">
        <span className="font-mono text-xs text-[var(--cr-text-muted)] animate-pulse">
          AUDITING_PRIVACY_SANDBOX...
        </span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="cr-card text-center py-12 font-mono text-xs text-[var(--cr-status-error)]">
        FAILED_TO_LOAD_PRIVACY_AUDIT
      </div>
    );
  }

  const { summary, features } = status;

  return (
    <div className="space-y-4">
      {/* Data Flow Summary Bento Card */}
      <div className="cr-card">
        <div className="flex items-center justify-between border-b border-[var(--cr-border)] pb-3 mb-3">
          <div className="cr-card-title mb-0">Data Flow & Privacy Audit</div>
          <span className="cr-privacy-card-badge local font-mono">
            {summary.all_local ? 'ALL LOCAL' : 'LIMITED REMOTE'}
          </span>
        </div>

        <p className="text-xs text-[var(--cr-text-muted)] mb-4">{summary.verdict}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="cr-key-value">
            <span className="k">Network Calls</span>
            <span className="v val-accent">{summary.total_network_endpoints}</span>
          </div>
          <div className="cr-key-value">
            <span className="k">External APIs</span>
            <span className="v val-accent">{summary.all_local ? 'None' : 'Active'}</span>
          </div>
          <div className="cr-key-value">
            <span className="k">Telemetry</span>
            <span className="v val-accent">Disabled</span>
          </div>
        </div>
      </div>

      {/* Feature Breakdown Cards */}
      <div>
        <div className="font-mono text-[10px] uppercase text-[var(--cr-text-muted)] tracking-wider mb-2">
          Local AI Feature Pipeline Audit
        </div>

        <div className="space-y-2">
          {features.map(feature => {
            const isExpanded = expandedFeature === feature.id;
            const isLocal = feature.network_calls.length === 0;

            return (
              <div
                key={feature.id}
                className={`cr-privacy-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div
                  className="cr-privacy-card-header"
                  onClick={() => setExpandedFeature(isExpanded ? null : feature.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${feature.enabled ? 'bg-[var(--cr-accent)] shadow-[0_0_6px_var(--cr-accent)]' : 'bg-[var(--cr-text-muted)]'}`} />
                    <span className="cr-privacy-card-title">{feature.label}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`cr-privacy-card-badge ${isLocal ? 'local' : 'network'}`}>
                      {isLocal ? 'LOCAL ONLY' : `${feature.network_calls.length} ENDPOINTS`}
                    </span>
                    <span className="cr-privacy-card-chevron text-[var(--cr-text-muted)] font-mono text-[10px]">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-2 border-t border-[var(--cr-border)] bg-[var(--cr-surface-sunken)] space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--cr-text-muted)] uppercase block mb-1">Runs Locally</span>
                      <ul className="space-y-1">
                        {feature.what_runs_locally.map((item, i) => (
                          <li key={i} className="text-[var(--cr-text-secondary)] flex items-center gap-2">
                            <span className="text-[var(--cr-accent)]">&gt;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--cr-text-muted)] uppercase block mb-1">Data Handling</span>
                      <p className="text-[var(--cr-text-secondary)]">{feature.what_is_sent}</p>
                    </div>

                    <div className="cr-key-value pt-2 border-t border-[var(--cr-border)]">
                      <span className="k">Active Neural Model</span>
                      <span className="v val-accent">{feature.model}</span>
                    </div>

                    {feature.network_calls.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] text-[var(--cr-status-warn)] uppercase block mb-1">Network Endpoints</span>
                        <ul className="space-y-1">
                          {feature.network_calls.map((call, i) => (
                            <li key={i} className="text-[var(--cr-status-warn)] bg-[var(--cr-surface-card)] p-1.5 rounded border border-[var(--cr-border)]">
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


