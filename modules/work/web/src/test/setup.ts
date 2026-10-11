import { configure } from '@testing-library/react';

// The first render in a file loads the screen's chunks; on a loaded CI runner that can pass
// Testing Library's 1 s default, so the first findBy in a file failed on some runs only.
configure({ asyncUtilTimeout: 5_000 });
