// Runs before `npm start` / `npm run dev`: if a dependency in package.json isn't installed
// (for example after pulling new code), install it so the dev server doesn't fail.
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const all = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = Object.keys(all).filter((name) => !existsSync(new URL(`../node_modules/${name}/package.json`, import.meta.url)));
if (missing.length) {
  console.log(`Installing missing packages: ${missing.join(', ')} …`);
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit', cwd: new URL('..', import.meta.url) });
}
