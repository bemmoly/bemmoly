/*
 * Invalidation kinds the Work services publish and the Work hooks subscribe
 * to. Every message carries the project id as its scope; `ids` are the rows
 * that changed (issue ids, sprint ids), so a hook can invalidate one query
 * instead of a whole screen.
 */
export const WORK_REALTIME_KINDS = {
  /** An issue, or something hanging off it (comment, link, watcher, work log), changed. */
  issue: 'work.issue',
  /** The order or membership of a sprint's or the backlog's list changed. */
  sprint: 'work.sprint',
  /** The board of a project needs a refetch (status, rank or sprint of any issue). */
  board: 'work.board',
} as const;

export type WorkRealtimeKind = (typeof WORK_REALTIME_KINDS)[keyof typeof WORK_REALTIME_KINDS];
