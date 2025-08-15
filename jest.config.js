module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // TypeScript support
  preset: 'ts-jest',
  
  // Root directory
  rootDir: '.',
  
  // Source and test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,js}',
    '<rootDir>/src/**/*.test.{ts,js}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,js}',
    '!src/migrations/**', // Exclude migration scripts from coverage
    '!src/app.ts', // Exclude main app file
    '!src/server.ts' // Exclude server startup file
  ],
  
  // Coverage thresholds for quality assurance
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific requirements for critical modules
    './src/controllers/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Module path aliases (matching tsconfig.json)
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // File extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Performance optimizations
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Timeout settings
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Bail on first test failure in CI
  bail: process.env.CI ? 1 : 0,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Detect open handles for better cleanup
  detectOpenHandles: true,
  forceExit: true,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache'
};
