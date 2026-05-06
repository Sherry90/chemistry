import type { LogLevel, Logger } from './types';

const LEVEL_RANK: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export function createConsoleLogger(level: LogLevel): Logger {
  const rank = LEVEL_RANK[level];

  const log =
    (method: 'error' | 'warn' | 'info' | 'debug', methodRank: number) =>
    (msg: string, meta?: Record<string, unknown>) => {
      if (rank >= methodRank) {
        if (meta !== undefined) {
          console[method](`[${method.toUpperCase()}] ${msg}`, meta);
        } else {
          console[method](`[${method.toUpperCase()}] ${msg}`);
        }
      }
    };

  return {
    error: log('error', LEVEL_RANK.error),
    warn: log('warn', LEVEL_RANK.warn),
    info: log('info', LEVEL_RANK.info),
    debug: log('debug', LEVEL_RANK.debug),
  };
}
