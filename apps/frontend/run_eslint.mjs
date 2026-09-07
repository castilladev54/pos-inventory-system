import { ESLint } from 'eslint';
import * as fs from 'fs';

(async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(['src/**/*.ts', 'src/**/*.tsx']);
  const formatter = await eslint.loadFormatter('stylish');
  const resultText = await formatter.format(results);
  fs.writeFileSync('eslint_results.txt', resultText);
  console.log('ESLint run complete. Wrote results to eslint_results.txt');
})().catch((error) => {
  console.error('Error running ESLint:', error);
  process.exit(1);
});
