module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'standard-with-typescript'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  env: {
    es6: true,
    node: true,
  },
  ignorePatterns: ["dist", ".eslintrc.js"],
  rules: {
    // Prevented us creating objects with default values from Answers
    "@typescript-eslint/strict-boolean-expressions": 0,
    // Unnecessary rule adds redundant typing to function signatures that are usually clear from implicit returns
    "@typescript-eslint/explicit-function-return-type": 0,
    // Prevented us dynamically creating objects based on types (such as creating new ConfigSheets)
    "@typescript-eslint/consistent-type-assertions": 0,
    // Prevented us console logging answers (useful for debug)
    "@typescript-eslint/restrict-template-expressions": 0,
    // Team agreed style choice to have no spaces before function params fn(env: string) vs fn (env:string)
    "@typescript-eslint/space-before-function-paren": 0
  }
}