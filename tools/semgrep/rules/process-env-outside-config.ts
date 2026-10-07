// Fixtures for bemmoly-process-env-outside-config.
declare const env: { PORT: number; LOG_LEVEL: string };

export function readsEnvironmentDirectly() {
  // ruleid: bemmoly-process-env-outside-config
  const port = process.env.PORT;
  // ruleid: bemmoly-process-env-outside-config
  const level = process.env['LOG_LEVEL'];
  // ruleid: bemmoly-process-env-outside-config
  const { DATABASE_URL } = process.env;
  return [port, level, DATABASE_URL];
}

export function readsParsedEnv() {
  // ok: bemmoly-process-env-outside-config
  const port = env.PORT;
  // ok: bemmoly-process-env-outside-config
  const level = env.LOG_LEVEL;
  // ok: bemmoly-process-env-outside-config
  const cwd = process.cwd();
  return [port, level, cwd];
}
