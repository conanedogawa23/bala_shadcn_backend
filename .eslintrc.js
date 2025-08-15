module.exports = {
  env: {
    es2022: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    // TypeScript specific rules (commented out until plugin is working)
    // '@typescript-eslint/no-unused-vars': ['error', { 
    //   argsIgnorePattern: '^_',
    //   varsIgnorePattern: '^_' 
    // }],
    // '@typescript-eslint/no-explicit-any': 'warn',
    // '@typescript-eslint/prefer-const': 'error',
    // '@typescript-eslint/no-inferrable-types': 'error',
    
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off', // Use TypeScript version instead
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    
    // Import/export rules
    'no-duplicate-imports': 'error',
    
    // Code style rules
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // Prevent forEach usage as per notepad rules
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='forEach']",
        message: 'Avoid using forEach. Use map, reduce, filter, or for...of instead for better performance and readability.'
      }
    ]
  },
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'coverage/**',
    '*.config.{js,mjs,cjs}',
    '.env*'
  ],
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-console': 'off' // Allow console statements in test files
      }
    }
  ]
};
