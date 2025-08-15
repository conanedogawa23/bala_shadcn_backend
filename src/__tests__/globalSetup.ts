import { logger } from '@/utils/logger';

/**
 * Global test setup - runs once before all tests
 * This is called by Jest before any test suites run
 */
export default async (): Promise<void> => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce logging noise during tests
  
  // Suppress console output during tests (except errors)
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  
  console.log = () => {}; // Suppress log output
  console.info = () => {}; // Suppress info output  
  console.warn = () => {}; // Suppress warning output
  
  // Keep error output for debugging
  console.error = console.error;
  
  // Store original functions for cleanup
  (global as any).__originalConsole = {
    log: originalConsoleLog,
    info: originalConsoleInfo,
    warn: originalConsoleWarn
  };
  
  logger.info('Global test setup completed');
};
