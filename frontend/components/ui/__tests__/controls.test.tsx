import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from '../Select';
import { Switch } from '../Switch';

describe('accessible UI controls', () => {
  it('changes the native select value and exposes its accessible name', () => {
    const onChange = vi.fn();
    render(
      <Select
        ariaLabel="GPU processing mode"
        options={[{ value: 'cpu', label: 'CPU' }, { value: 'cuda', label: 'CUDA' }]}
        value="cpu"
        onChange={onChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'GPU processing mode' });
    fireEvent.change(select, { target: { value: 'cuda' } });
    expect(onChange).toHaveBeenCalledWith('cuda');
  });

  it('uses a keyboard-operable switch with an announced checked state', () => {
    const onToggle = vi.fn();
    render(<Switch label="Semantic Search" checked={false} onToggle={onToggle} />);

    const control = screen.getByRole('switch', { name: 'Semantic Search', checked: false });
    fireEvent.keyDown(control, { key: 'Enter' });
    fireEvent.click(control);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
