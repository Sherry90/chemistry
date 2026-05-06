export type { LogLevel, Logger } from './types';
export { createConsoleLogger } from './console';

export const LOG_LEVEL = import.meta.env.DEV ? 'debug' : ('warn' as const);

import { createConsoleLogger } from './console';
export const logger = createConsoleLogger(LOG_LEVEL);
