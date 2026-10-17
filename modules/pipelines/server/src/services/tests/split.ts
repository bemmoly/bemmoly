/*
 * Splitting test files across shards by past timings, so shards finish together
 * (architecture §6): longest first, each to the shard with the least time so far. Files
 * Pipelines has not timed yet count as the median known file. Every shard of a job sends
 * the same list and computes the same split, so no coordination is needed.
 */

export interface ShardPlan {
  files: string[][];
  seconds: number[];
}

export function splitByTiming(
  files: readonly string[],
  timingsMs: ReadonlyMap<string, number>,
  shards: number,
): ShardPlan {
  const total = Math.max(1, shards);
  const known = [...new Set(files)]
    .map((file) => timingsMs.get(file))
    .filter((ms): ms is number => ms !== undefined);
  known.sort((a, b) => a - b);
  const median = known.length > 0 ? (known[Math.floor(known.length / 2)] ?? 1000) : 1000;
  const weighted = [...new Set(files)]
    .map((file) => ({ file, ms: timingsMs.get(file) ?? median }))
    .sort((a, b) => b.ms - a.ms || (a.file < b.file ? -1 : 1));
  const plan: ShardPlan = {
    files: Array.from({ length: total }, () => []),
    seconds: Array.from({ length: total }, () => 0),
  };
  const ms = Array.from({ length: total }, () => 0);
  for (const { file, ms: duration } of weighted) {
    let target = 0;
    for (let i = 1; i < total; i += 1) if ((ms[i] ?? 0) < (ms[target] ?? 0)) target = i;
    plan.files[target]?.push(file);
    ms[target] = (ms[target] ?? 0) + duration;
  }
  plan.seconds = ms.map((value) => Math.round(value / 1000));
  for (const list of plan.files) list.sort();
  return plan;
}
