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
    "@typescript-eslint/space-before-function-paren": 0,
    // There are some false positives being produced between TS and ESLint here
    "@typescript-eslint/prefer-reduce-type-parameter": 0,
    // This rule complicates expressions in code (ie preferring "!isNaN(answers.key as number)" over "answers.key !== NaN")
    "use-isnan": 0,
    // Preference, using double quotes is easier where single quotes may need to be escaped
    "@typescript-eslint/quotes": 0,
    // Results in false positives
    "@typescript-eslint/no-base-to-string": 0,
    // Perference, This rule can be useful for logic flow, but in cases of Promise.allSettled it results in superfluous code
    "@typescript-eslint/promise-function-async": 1,
    // Personal preference "?" looks better on the same line as the statement
    "operator-linebreak": 0,
    // Same as above
    "multiline-ternary": 0
  }
}