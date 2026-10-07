import {
  AiInsightBar,
  Avatar,
  avatarHue,
  Button,
  Card,
  PriorityGlyph,
  STATUS_LABELS,
  StatusBadge,
  Tag,
  TypeGlyph,
} from '@bemmoly/ui';
import { SAMPLE_COLUMNS, type SampleIssue } from './preview-data.ts';
import { PreviewTopBar } from './preview-top-bar.tsx';

function IssueCard({ issue }: { issue: SampleIssue }) {
  return (
    <Card radius="panel" className="flex flex-col gap-2 p-2.5 shadow-card">
      <span className="text-13 leading-card text-tx">{issue.title}</span>
      {issue.labels.length ? (
        <span className="flex gap-1">
          {issue.labels.map((label) => (
            <Tag key={label} size="sm">
              {label}
            </Tag>
          ))}
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <TypeGlyph type={issue.type} />
        <span className="font-mono text-11 text-tx4">{issue.key}</span>
        <PriorityGlyph priority={issue.priority} />
        <Avatar
          className="ml-auto"
          name={issue.assignee}
          hue={avatarHue(issue.assignee)}
          size={22}
        />
      </span>
    </Card>
  );
}

/** A representative board: the real top bar, the AI risk bar and four status columns. */
export function PreviewBoard() {
  return (
    <div className="flex h-full flex-col">
      <PreviewTopBar active="Projects" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-12h text-tx4">Projects / Platform Core</span>
          <div className="flex items-center gap-3">
            <span className="text-22 font-semibold tracking-title text-tx">Sprint 24</span>
            <StatusBadge category="progress" label="Active" />
            <span className="ml-auto flex gap-2">
              <Button variant="secondary">Complete sprint</Button>
              <Button variant="primary">Create issue</Button>
            </span>
          </div>
        </div>
        <AiInsightBar
          title="Sprint risk"
          actions={
            <>
              <Button size="xs">Show plan</Button>
              <Button size="xs" variant="ghost">
                Not now
              </Button>
            </>
          }
        >
          PLT-204 blocks two stories; at the current pace the sprint ends with 8 points open.
        </AiInsightBar>
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
          {SAMPLE_COLUMNS.map((column) => (
            <div key={column.status} className="flex flex-col gap-2 rounded-card bg-bg2 p-2">
              <span className="flex items-center gap-2 px-1 py-1 text-11 font-semibold tracking-caps text-tx4 uppercase">
                {STATUS_LABELS[column.status]}
                <span className="font-mono font-medium text-tx5">{column.issues.length}</span>
              </span>
              {column.issues.map((issue) => (
                <IssueCard key={issue.key} issue={issue} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
