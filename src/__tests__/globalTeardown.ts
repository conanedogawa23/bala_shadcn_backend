import { logger } from '@/utils/logger';

/**
 * Global test teardown - runs once after all tests
 * This is called by Jest after all test suites complete
 */
export default async (): Promise<void> => {
  // Restore original console functions
  const originalConsole = (global as any).__originalConsole;
  if (originalConsole) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
  }
  
  // Clean up any global resources
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  logger.info('Global test teardown completed');
};
