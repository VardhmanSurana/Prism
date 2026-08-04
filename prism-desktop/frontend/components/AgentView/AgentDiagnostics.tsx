import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Heart, Search, Calendar, MapPin, Users, Tag } from 'lucide-react';
import { AgentDiagnosticsProps } from './types';
import { ThinkingIndicator } from './ThinkingIndicator';
import {
  ThinkingStepsHeader,
  ThinkingStepsContent,
  ThinkingStep,
  ThinkingStepBadge,
} from './ThinkingSteps';

// Map tool names to human-readable labels and icons
const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: 'blue' | 'green' | 'amber' | 'purple' | 'cyan' | 'gray' }> = {
  search_events: { label: 'Event search', icon: <Calendar size={11} />, color: 'cyan' },
  search_captions: { label: 'Caption search', icon: <Search size={11} />, color: 'blue' },
  semantic_search: { label: 'Semantic search', icon: <Search size={11} />, color: 'purple' },
  search_location: { label: 'Location search', icon: <MapPin size={11} />, color: 'green' },
  search_people: { label: 'People search', icon: <Users size={11} />, color: 'amber' },
  search_tags: { label: 'Tag search', icon: <Tag size={11} />, color: 'gray' },
};

export const AgentDiagnostics: React.FC<AgentDiagnosticsProps> = ({
  plan,
  tools,
  totalCandidates,
  isStreaming = false,
}) => {
  const [open, setOpen] = useState(true);

  if (!plan && (!tools || tools.length === 0)) return null;

  // Build a list of "steps" from tools so we can render them as ThinkingStep rows
  const toolSteps = tools ?? [];

  // Build intent/flag badges from plan
  const planBadges: React.ReactNode[] = [];
  if (plan?.intent) planBadges.push(<ThinkingStepBadge key="intent" color="blue" delay={0}>{plan.intent}</ThinkingStepBadge>);
  if (plan?.is_locked) planBadges.push(<ThinkingStepBadge key="locked" color="rose" delay={0.04}><Lock size={9} className="mr-0.5 inline" />Locked</ThinkingStepBadge>);
  if (plan?.refine_previous) planBadges.push(<ThinkingStepBadge key="refine" color="cyan" delay={0.08}>Refinement</ThinkingStepBadge>);
  if (plan?.ranking?.prefer_favorites) planBadges.push(<ThinkingStepBadge key="fav" color="rose" delay={0.12}><Heart size={9} fill="currentColor" className="mr-0.5 inline" />Favorites</ThinkingStepBadge>);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8, bounce: 0 }}
      className="mt-2 overflow-hidden w-full"
    >
      <div className="rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <ThinkingIndicator
                showIcon
                words={["Searching", "Planning", "Refining", "Scanning"]}
                className="px-0 py-0"
              />
            ) : (
              <ThinkingStepsHeader open={open} onToggle={() => setOpen(o => !o)}>
                Execution details
              </ThinkingStepsHeader>
            )}
          </div>
          {totalCandidates != null && (
            <span className="text-[10px] font-semibold text-white/40 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-full tabular-nums">
              {totalCandidates} candidates
            </span>
          )}
        </div>

        {/* Collapsible body */}
        <AnimatePresence initial={false}>
          {(isStreaming || open) && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, bounce: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 py-2 flex flex-col gap-0.5">

                {/* Plan badges row */}
                {planBadges.length > 0 && (
                  <ThinkingStep
                    label="Query parsed"
                    status="complete"
                    delay={0}
                    isLast={toolSteps.length === 0}
                    icon={<Search size={11} />}
                  >
                    <div className="flex flex-wrap gap-1 mt-1">
                      {planBadges}
                    </div>
                  </ThinkingStep>
                )}

                {/* Entity rows */}
                {plan?.entities && (() => {
                  const entityRows: React.ReactNode[] = [];
                  const { people, locations, events, objects, time_range } = plan.entities;
                  if (people?.length) entityRows.push(
                    <ThinkingStep key="people" label="People detected" status="complete" delay={0.06} icon={<Users size={11} />} isLast={false}>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {people.map((p: string, i: number) => (
                          <ThinkingStepBadge key={i} color="purple" delay={i * 0.04}>{p}</ThinkingStepBadge>
                        ))}
                      </div>
                    </ThinkingStep>
                  );
                  if (locations?.length) entityRows.push(
                    <ThinkingStep key="locs" label="Locations found" status="complete" delay={0.08} icon={<MapPin size={11} />} isLast={false}>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {locations.map((l: string, i: number) => (
                          <ThinkingStepBadge key={i} color="green" delay={i * 0.04}>{l}</ThinkingStepBadge>
                        ))}
                      </div>
                    </ThinkingStep>
                  );
                  if (events?.length) entityRows.push(
                    <ThinkingStep key="events" label="Events identified" status="complete" delay={0.1} icon={<Calendar size={11} />} isLast={false}>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {events.map((e: string, i: number) => (
                          <ThinkingStepBadge key={i} color="amber" delay={i * 0.04}>{e}</ThinkingStepBadge>
                        ))}
                      </div>
                    </ThinkingStep>
                  );
                  if (time_range) entityRows.push(
                    <ThinkingStep key="time" label="Time range" status="complete" delay={0.12} icon={<Calendar size={11} />} isLast={false}>
                      <ThinkingStepBadge color="cyan" delay={0.04}>{time_range}</ThinkingStepBadge>
                    </ThinkingStep>
                  );
                  return entityRows;
                })()}

                {/* Tool execution steps */}
                {toolSteps.map((t, idx) => {
                  const meta = TOOL_META[t.name] ?? { label: t.name, icon: <Search size={11} />, color: 'gray' as const };
                  const isLast = idx === toolSteps.length - 1;
                  const isActiveStep = isStreaming && isLast;
                  return (
                    <ThinkingStep
                      key={idx}
                      label={meta.label}
                      description={t.params ? JSON.stringify(t.params) : undefined}
                      status={isActiveStep ? 'active' : 'complete'}
                      delay={0.06 + idx * 0.05}
                      isLast={isLast}
                      icon={meta.icon}
                    >
                      {!isActiveStep && t.count != null && (
                        <ThinkingStepBadge color={meta.color} delay={0}>
                          {t.count} match{t.count !== 1 ? 'es' : ''}
                        </ThinkingStepBadge>
                      )}
                    </ThinkingStep>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};