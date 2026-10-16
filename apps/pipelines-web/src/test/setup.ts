import { cleanup } from '@testing-library/react';
import { loadLaterIcons } from '@bemmoly/ui/icons';
import { afterEach } from 'vitest';
import '../i18n/catalog.ts';

afterEach(() => cleanup());

// Draw every icon from the first render, as the app does once it has loaded them.
await loadLaterIcons();
