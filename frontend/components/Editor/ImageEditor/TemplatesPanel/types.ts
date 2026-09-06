/**
 * TemplatesPanel types
 */

import { Adjustments } from '../filterEngine';

export interface TemplatesPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
  imageSrc?: string;
}

