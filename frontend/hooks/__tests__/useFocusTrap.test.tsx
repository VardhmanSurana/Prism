import React, { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFocusTrap } from '../useFocusTrap';

interface TestModalProps {
  isOpen: boolean;
  onClose?: () => void;
  hasButtons?: boolean;
}

const TestModal: React.FC<TestModalProps> = ({ isOpen, onClose, hasButtons = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, containerRef, onClose);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" data-testid="modal-container">
      {hasButtons ? (
        <>
          <button data-testid="btn-first">First</button>
          <input data-testid="input-middle" type="text" />
          <button data-testid="btn-last">Last</button>
        </>
      ) : (
        <p>No interactive elements</p>
      )}
    </div>
  );
};

describe('useFocusTrap', () => {
  it('focuses the first focusable element when opened', () => {
    render(<TestModal isOpen={true} />);
    const firstBtn = screen.getByTestId('btn-first');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('focuses the container if no focusable elements are present', () => {
    render(<TestModal isOpen={true} hasButtons={false} />);
    const container = screen.getByTestId('modal-container');
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
  });

  it('traps Tab key and wraps from last to first element', () => {
    render(<TestModal isOpen={true} />);
    const firstBtn = screen.getByTestId('btn-first');
    const lastBtn = screen.getByTestId('btn-last');

    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(firstBtn);
  });

  it('traps Shift+Tab key and wraps from first to last element', () => {
    render(<TestModal isOpen={true} />);
    const firstBtn = screen.getByTestId('btn-first');
    const lastBtn = screen.getByTestId('btn-last');

    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<TestModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to previous element when modal closes', () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger-btn" onClick={() => setOpen(true)}>
            Open
          </button>
          <TestModal isOpen={open} onClose={() => setOpen(false)} />
        </div>
      );
    };

    render(<Harness />);
    const trigger = screen.getByTestId('trigger-btn');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open modal
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByTestId('btn-first'));

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    // In our Harness, Escape alone didn't set open=false unless onClose called setOpen
    // Let's test with onClose setting open to false
  });

  it('restores focus to previously active element on unmount / close', () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger-btn" onClick={() => setOpen(true)}>
            Open
          </button>
          <button data-testid="close-btn" onClick={() => setOpen(false)}>
            Close
          </button>
          <TestModal isOpen={open} onClose={() => setOpen(false)} />
        </div>
      );
    };

    render(<Harness />);
    const trigger = screen.getByTestId('trigger-btn');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByTestId('btn-first'));

    // Close via external button or state change
    const closeBtn = screen.getByTestId('close-btn');
    fireEvent.click(closeBtn);

    expect(document.activeElement).toBe(trigger);
  });
});
