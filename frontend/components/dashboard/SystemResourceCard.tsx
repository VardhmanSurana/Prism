import React from 'react';
import type { HardwareTelemetry } from '@/store/jobsStore';
import type { InferenceSlotStatus } from './useDashboardStats';
import { Cpu, HardDrive, Zap, ShieldCheck } from 'lucide-react';

interface SystemResourceCardProps {
  hardware: HardwareTelemetry | null;
  gpuAvailable?: boolean;
  gpuDevice?: string | null;
  inferenceSlot?: InferenceSlotStatus | null;
}

export const SystemResourceCard: React.FC<SystemResourceCardProps> = ({
  hardware,
  gpuAvailable,
  gpuDevice,
  inferenceSlot,
}) => {
  const cpuPercent = hardware ? Math.min(100, Math.max(0, Math.round(hardware.cpu_usage))) : 0;
  const diskFreeGb = hardware ? hardware.disk_free_gb : 0;
  const diskTotalGb =
    hardware?.disk_total_gb && hardware.disk_total_gb > 0
      ? hardware.disk_total_gb
      : diskFreeGb > 0
        ? diskFreeGb + 100
        : 0;
  const onBattery = hardware ? hardware.on_battery : false;
  const batteryPct = hardware ? hardware.battery_percent : 100;

  const getCpuStatus = (load: number) => {
    if (load >= 85) return { label: 'High Load', color: 'text-rose-400 font-semibold' };
    if (load >= 65) return { label: 'Moderate', color: 'text-amber-400 font-medium' };
    return { label: 'Nominal', color: 'text-emerald-400' };
  };

  const cpuStatus = getCpuStatus(cpuPercent);
  const cpuStroke =
    cpuPercent >= 85
      ? '#f43f5e'
      : cpuPercent >= 65
        ? '#f59e0b'
        : '#38bdf8';

  const diskUsedPct =
    diskTotalGb > 0
      ? Math.min(100, Math.max(0, Math.round(((diskTotalGb - diskFreeGb) / diskTotalGb) * 100)))
      : 0;

  return (
    <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 rounded-2xl p-6 transition-all shadow-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">Host Platform</span>
              <span className="text-[#4d4541] text-[10px]">•</span>
              <h2 className="font-serif text-lg text-[#f5f0ed] tracking-tight">Hardware Telemetry</h2>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">Physical device compute &amp; capacity utilization</p>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
              onBattery
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {onBattery ? `BATTERY ${batteryPct}%` : 'AC POWER'}
          </span>
        </div>

        {/* Dual Gauges Grid */}
        <div className="grid grid-cols-2 gap-3.5 my-3">
          {/* CPU Gauge */}
          <div className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 flex flex-col items-center text-center">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#100e0d"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={cpuStroke}
                  strokeWidth="3.5"
                  strokeDasharray={`${cpuPercent}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-serif text-lg text-[#f5f0ed]">
                {cpuPercent}%
              </div>
            </div>
            <span className="text-xs font-medium text-[#f5f0ed]">CPU Compute</span>
            <span className={`text-[10px] font-mono mt-0.5 ${cpuStatus.color}`}>
              {cpuStatus.label}
            </span>
          </div>

          {/* Disk Headroom Gauge */}
          <div className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 flex flex-col items-center text-center">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#100e0d"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeDasharray={`${diskUsedPct}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-serif text-sm text-[#f5f0ed]">
                {diskFreeGb}G
              </div>
            </div>
            <span className="text-xs font-medium text-[#f5f0ed]">Disk Headroom</span>
            <span className="text-[10px] font-mono text-emerald-400 mt-0.5">
              {diskFreeGb} GB Available
            </span>
          </div>
        </div>

        {/* Inference Acceleration Telemetry Strip */}
        <div className="p-3.5 rounded-xl bg-[#1d1b1a] border border-white/5 space-y-2 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a8a29e] flex items-center gap-1.5 font-mono text-[11px]">
              <Zap size={13} className="text-amber-400" />
              <span>Inference Acceleration</span>
            </span>
            <span className="font-mono text-[10px] text-[#f5f0ed] bg-[#100e0d] px-2 py-0.5 rounded-full border border-white/5">
              {gpuAvailable && gpuDevice ? gpuDevice : 'CPU Direct (Rayon)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-[#78716c] pt-1 border-t border-white/[0.04]">
            <span>Inference Slot: {inferenceSlot?.busy ? 'Running' : 'Ready'}</span>
            <span className="text-[#a8a29e]">{inferenceSlot?.held_seconds ? `${inferenceSlot.held_seconds}s active` : '0ms latency'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
