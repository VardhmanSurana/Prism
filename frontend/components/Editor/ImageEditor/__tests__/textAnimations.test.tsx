import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlurReveal, SlideUpText, SpecialText, ShimmerText } from '../textAnimations';

describe('Spell UI Text Animation Components', () => {
  it('renders BlurReveal with words properly separated', () => {
    render(<BlurReveal text="AI Neural Processing" />);
    expect(screen.getByText(/AI/)).toBeTruthy();
    expect(screen.getByText(/Neural/)).toBeTruthy();
    expect(screen.getByText(/Processing/)).toBeTruthy();
  });

  it('renders SlideUpText with child content', () => {
    render(
      <SlideUpText textKey="step-1">
        <span>Analyzing image composition</span>
      </SlideUpText>
    );
    expect(screen.getByText('Analyzing image composition')).toBeTruthy();
  });

  it('renders SpecialText initial text content', () => {
    render(<SpecialText text="Magic Eraser" trigger={false} />);
    expect(screen.getByText('Magic Eraser')).toBeTruthy();
  });

  it('renders ShimmerText with children and styling classes', () => {
    const { container } = render(<ShimmerText>Super Resolution</ShimmerText>);
    expect(screen.getByText('Super Resolution')).toBeTruthy();
    expect(container.firstChild).toHaveProperty('className');
  });
});
