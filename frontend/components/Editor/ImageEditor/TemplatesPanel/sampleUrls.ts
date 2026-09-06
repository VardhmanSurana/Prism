/**
 * sampleUrls.ts
 * Sample image URLs and categories for template previews.
 */

import { Film, User, Mountain, History } from 'lucide-react';
import { resolveUrl } from '@/constants';

export const CATEGORY_SECTIONS = [
  { id: 'Film', label: 'Film & Analog', icon: Film },
  { id: 'Portrait', label: 'Portrait & Skin', icon: User },
  { id: 'Landscape', label: 'Landscape & Nature', icon: Mountain },
  { id: 'Vintage', label: 'Vintage & Retro', icon: History },
] as const;

export const getSampleUrlForTemplate = (category?: string, templateId?: string): string => {
  let filename = 'nature.png';
  if (category === 'Portrait') {
    filename = 'woman.png';
  } else if (
    category === 'Vintage' ||
    (templateId &&
      (templateId.includes('film') ||
        templateId.includes('kodachrome') ||
        templateId.includes('polaroid')))
  ) {
    filename = 'pet.png';
  } else if (category === 'Landscape') {
    filename = 'nature.png';
  } else if (category === 'Film') {
    filename = 'pet.png';
  }
  return resolveUrl(`/api/v1/sample-images/${filename}`);
};

