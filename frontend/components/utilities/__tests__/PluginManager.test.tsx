import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PluginManager } from '../PluginManager';

describe('PluginManager UI Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/v1/plugins/catalog')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                catalog: [
                  {
                    id: 'background-removal',
                    name: 'AI Background Removal Studio',
                    version: '1.2.0',
                    author: 'Prism Core',
                    description: 'Deep learning matting pack',
                    category: 'AI & Machine Learning',
                    icon: 'Scissors',
                    is_installed: false,
                    is_active: false,
                    size_display: '~170 MB',
                    tags: ['matting', 'segmentation'],
                    manifest: {
                      id: 'background-removal',
                      name: 'AI Background Removal Studio',
                      version: '1.2.0',
                      author: 'Prism Core',
                      description: 'Deep learning matting pack',
                      category: 'AI & Machine Learning',
                      capabilities: ['matting'],
                    },
                  },
                ],
                total: 1,
              }),
          });
        }
        if (url.includes('/api/v1/plugins')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                plugins: [],
                plugins_dir: 'plugins',
                total: 0,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      })
    );
  });

  it('renders plugin management header and tabs', async () => {
    render(<PluginManager />);

    expect(screen.getByText('Plugin Management')).toBeDefined();
    expect(screen.getByText('My Plugins')).toBeDefined();
    expect(screen.getByText('Plugin Catalog')).toBeDefined();

    // Verify empty state initially on My Plugins
    await waitFor(() => {
      expect(screen.getByText('No Plugins Installed Yet')).toBeDefined();
    });
  });
});

