import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !destination.replaceAll('\\', '/').endsWith('/public/pioneer-outcomes/ussi')) throw new Error('Pass the exact ZEN checkout public/pioneer-outcomes/ussi directory.');
const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (status) throw new Error('Commit the canonical USSI source before exporting a release.');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
// Rebuild from the clean canonical source; generated files remain ignored.
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-b'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--base=/pioneer-outcomes/ussi/', '--outDir=dist-zenai'], { cwd: root, stdio: 'inherit' });
const source = path.join(root, 'dist-zenai');
const files = {};
async function inventory(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await inventory(path.join(directory, entry.name), `${name}/`);
    else files[name] = createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex');
  }
}
await inventory(source);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
const manifest = { sourceRepository: 'https://github.com/Bluenot3/united-states-super-intelligence-app', sourceCommit, base: '/pioneer-outcomes/ussi/', entry: 'index.html?embed=data&theme=quicksilver#impact', dataStatus: 'modeled-synthetic', modeledRecords: 34300, files };
await writeFile(path.join(destination, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ destination, sourceCommit, fileCount: Object.keys(files).length }));
