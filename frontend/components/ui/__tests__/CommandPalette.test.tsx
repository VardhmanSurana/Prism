import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandPalette, buildDefaultCommands, CommandItem } from '../CommandPalette';
import { useKeyboardShortcuts, ShortcutBinding } from '../../../hooks/useKeyboardShortcuts';

// ─── CommandPalette Component Tests ──────────────────────────────────────────

function makeCommands(): CommandItem[] {
  return [
    {
      id: 'test:gallery',
      label: 'Go to Gallery',
      description: 'View all photos',
      icon: <span data-testid="icon-gallery">📷</span>,
      shortcut: '1',
      category: 'Navigation',
      action: vi.fn(),
      keywords: ['photos', 'home'],
    },
    {
      id: 'test:albums',
      label: 'Go to Albums',
      icon: <span data-testid="icon-albums">📁</span>,
      category: 'Navigation',
      action: vi.fn(),
    },
    {
      id: 'test:upload',
      label: 'Upload Photos',
      icon: <span data-testid="icon-upload">⬆️</span>,
      shortcut: 'U',
      category: 'Actions',
      action: vi.fn(),
      keywords: ['import'],
    },
  ];
}

describe('CommandPalette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    commands: makeCommands(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all commands when no query', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Go to Gallery')).toBeTruthy();
    expect(screen.getByText('Go to Albums')).toBeTruthy();
    expect(screen.getByText('Upload Photos')).toBeTruthy();
  });

  it('shows category headers', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('filters commands by label', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'gallery' } });

    expect(screen.getByText('Go to Gallery')).toBeTruthy();
    expect(screen.queryByText('Go to Albums')).toBeNull();
    expect(screen.queryByText('Upload Photos')).toBeNull();
  });

  it('filters commands by keywords', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'import' } });

    expect(screen.getByText('Upload Photos')).toBeTruthy();
    expect(screen.queryByText('Go to Gallery')).toBeNull();
  });

  it('calls action when command is clicked', () => {
    const commands = makeCommands();
    render(<CommandPalette {...defaultProps} commands={commands} />);

    fireEvent.click(screen.getByText('Go to Gallery'));
    expect(commands[0].action).toHaveBeenCalledTimes(1);
  });

  it('calls onClose after action', () => {
    render(<CommandPalette {...defaultProps} />);
    fireEvent.click(screen.getByText('Go to Gallery'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('navigates with ArrowDown and ArrowUp', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type a command or search...');

    // First item should be selected by default
    const firstItem = screen.getAllByRole('option')[0];
    expect(firstItem.getAttribute('aria-selected')).toBe('true');

    // Arrow down selects second item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const secondItem = screen.getAllByRole('option')[1];
    expect(secondItem.getAttribute('aria-selected')).toBe('true');
  });

  it('executes selected command on Enter', () => {
    const commands = makeCommands();
    render(<CommandPalette {...defaultProps} commands={commands} />);
    const input = screen.getByPlaceholderText('Type a command or search...');

    // Navigate to second command
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(commands[1].action).toHaveBeenCalledTimes(1);
  });

  it('shows "No commands found" for empty results', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No commands found')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<CommandPalette {...defaultProps} isOpen={false} />);
    expect(screen.queryByPlaceholderText('Type a command or search...')).toBeNull();
  });

  it('shows command count in footer', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('3 commands')).toBeTruthy();
  });

  it('shows shortcuts as kbd elements', () => {
    render(<CommandPalette {...defaultProps} />);
    // The shortcut for "Go to Gallery" is "1"
    const kbds = screen.getAllByText('1');
    expect(kbds.length).toBeGreaterThan(0);
  });
});

// ─── buildDefaultCommands Tests ──────────────────────────────────────────────

describe('buildDefaultCommands', () => {
  it('returns commands for all navigation views', () => {
    const actions = {
      onNavigate: vi.fn(),
      onUpload: vi.fn(),
      onSearch: vi.fn(),
      onToggleLock: vi.fn(),
    };
    const commands = buildDefaultCommands(actions);

    const navCommands = commands.filter((c) => c.category === 'Navigation');
    expect(navCommands.length).toBeGreaterThanOrEqual(5);
  });

  it('includes upload action', () => {
    const actions = {
      onNavigate: vi.fn(),
      onUpload: vi.fn(),
      onSearch: vi.fn(),
      onToggleLock: vi.fn(),
    };
    const commands = buildDefaultCommands(actions);
    const upload = commands.find((c) => c.id === 'action:upload');
    expect(upload).toBeDefined();
  });
});

// ─── useKeyboardShortcuts Hook Tests ─────────────────────────────────────────

function TestComponent({
  bindings,
  enabled = true,
}: {
  bindings: ShortcutBinding[];
  enabled?: boolean;
}) {
  useKeyboardShortcuts({ shortcuts: bindings, enabled });
  return <div data-testid="test-component">Test</div>;
}

describe('useKeyboardShortcuts', () => {
  it('calls action on matching key', () => {
    const action = vi.fn();
    render(
      <TestComponent
        bindings={[{ key: 'a', description: 'Test', action }]}
      />
    );

    fireEvent.keyDown(window, { key: 'a' });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not call action when disabled', () => {
    const action = vi.fn();
    render(
      <TestComponent
        bindings={[{ key: 'a', description: 'Test', action }]}
        enabled={false}
      />
    );

    fireEvent.keyDown(window, { key: 'a' });
    expect(action).not.toHaveBeenCalled();
  });

  it('skips input field shortcuts unless always: true', () => {
    // This is tested in the next test case
  });

  it('skips shortcuts in input fields unless always: true', () => {
    const normalAction = vi.fn();
    const alwaysAction = vi.fn();

    render(
      <div>
        <TestComponent
          bindings={[
            { key: 'a', description: 'Normal', action: normalAction },
            { key: 'b', description: 'Always', action: alwaysAction, always: true },
          ]}
        />
        <input data-testid="test-input" />
      </div>
    );

    const input = screen.getByTestId('test-input');
    input.focus();

    fireEvent.keyDown(input, { key: 'a' });
    expect(normalAction).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'b' });
    expect(alwaysAction).toHaveBeenCalledTimes(1);
  });

  it('matches ctrl key combination', () => {
    const action = vi.fn();
    render(
      <TestComponent
        bindings={[{ key: 'k', ctrl: true, description: 'Test', action }]}
      />
    );

    // Without ctrl
    fireEvent.keyDown(window, { key: 'k' });
    expect(action).not.toHaveBeenCalled();

    // With ctrl
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
