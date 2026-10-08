import { create } from 'zustand';

/**
 * Client-only Work state: which project the screens show. The path wins when
 * it names one (/work/board/PLT); otherwise the last chosen project, then the
 * first the person can see. Server data never lives here.
 */
interface ProjectState {
  projectKey: string | null;
  setProjectKey(key: string | null): void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projectKey: null,
  setProjectKey: (projectKey) => set({ projectKey }),
}));
