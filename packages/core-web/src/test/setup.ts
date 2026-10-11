import { loadLaterIcons } from '@bemmoly/ui/icons';

// Draw every icon from the first render: the app loads the later ones once it is idle.
await loadLaterIcons();
