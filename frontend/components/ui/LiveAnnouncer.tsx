import React from 'react';
import { useAnnounceStore } from '@/hooks/useAnnounce';

/**
 * LiveAnnouncer - Global accessible screen reader announcer container.
 * Renders hidden aria-live regions for polite and assertive announcements.
 */
export const LiveAnnouncer: React.FC = () => {
  const politeMessage = useAnnounceStore((s) => s.politeMessage);
  const assertiveMessage = useAnnounceStore((s) => s.assertiveMessage);

  return (
    <div
      className="sr-only"
      aria-hidden="false"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="live-announcer-polite">
        {politeMessage}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-announcer-assertive">
        {assertiveMessage}
      </div>
    </div>
  );
};
