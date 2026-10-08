import {
  ArchiveRestore,
  ArrowRight,
  Blocks,
  ChartColumn,
  ChartGantt,
  Circle,
  Download,
  FileText,
  Inbox,
  KeyRound,
  ListTodo,
  Package,
  Pencil,
  Server,
  Settings,
  SquareCheck,
  SquareKanban,
  SunMoon,
  Table2,
  Timer,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icons the mocks draw with CSS boxes, now Lucide icons chosen for the same meaning. Each
 * is imported by name so the bundle keeps only the ones listed here.
 */
export const SHAPES = {
  /** Sidebar "Roadmap": the mock's filled timeline bar. */
  roadmap: ChartGantt,
  /** Sidebar "Backlog": a ruled list. */
  backlog: ListTodo,
  /** Sidebar "Board": columns of cards. */
  board: SquareKanban,
  /** Sidebar "Sprints": a time box. */
  sprint: Timer,
  /** Sidebar "Reports": bottom-aligned bars. */
  reports: ChartColumn,
  /** A doc page. */
  doc: FileText,
  /** "Linked pages" and "Members": an outlined circle. */
  circle: Circle,
  /** "Releases": a shipped package. */
  releases: Package,
  /** Top bar and settings links. */
  settings: Settings,
  /** Top bar inbox: the mock's tray. */
  inbox: Inbox,
  /** Top bar theme menu: light and dark. */
  theme: SunMoon,
  /** Setup option tiles: single sign-on with any identity provider. */
  key: KeyRound,
  /** Setup option tiles: a model server on the local network. */
  server: Server,
  /** Setup option tiles: spreadsheet (CSV) exports. */
  table: Table2,
  /** Settings: switch a section from its read view to editing. */
  edit: Pencil,
  /** Backups: put a backup back in place of the live workspace. */
  restore: ArchiveRestore,
  download: Download,
  /** Settings › Modules, and the Create menu's empty state. */
  modules: Blocks,
  /** Board cards: the mock's ☑ before the subtask count. */
  subtasks: SquareCheck,
  /** Workflow: the mock's → before a transition's target. */
  arrow: ArrowRight,
} satisfies Record<string, LucideIcon>;

export type ShapeName = keyof typeof SHAPES;
