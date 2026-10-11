import { configure } from '@testing-library/react';
import { loadLaterIcons } from '@bemmoly/ui/icons';

// The first render in a file loads the screen's chunks; on a loaded CI runner that can pass
// Testing Library's 1 s default, so the first findBy in a file failed on some runs only.
configure({ asyncUtilTimeout: 5_000 });

// Draw every icon from the first render: the app loads the later ones once it is idle.
await loadLaterIcons();
