// Fixtures for bemmoly-console-log.
declare const request: { log: { info(object: object, message: string): void } };
declare const logger: { debug(message: string): void };

export function chatty(value: unknown) {
  // ruleid: bemmoly-console-log
  console.log('value', value);
  // ruleid: bemmoly-console-log
  console.debug(value);
  // ruleid: bemmoly-console-log
  console.info('done');
}

export function structured(value: unknown) {
  // ok: bemmoly-console-log
  request.log.info({ value }, 'imported');
  // ok: bemmoly-console-log
  logger.debug('cache warm');
  // ok: bemmoly-console-log
  const catalog = { log: 'ai.runs' };
  return catalog;
}
