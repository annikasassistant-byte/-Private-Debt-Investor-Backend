import { build } from 'esbuild';
import { mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';









const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [
    'src/server.ts',
    'src/scripts/seed.ts',
    'src/scripts/migrate.ts',
    'src/scripts/createAdmin.ts',
  ],
  outdir: 'dist',
  outbase: 'src',
  platform: 'node',
  target: 'node20',
  format: 'esm',
  bundle: true,
  splitting: false,
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
});

// Copy non-TS runtime assets
await cp(path.join(root, 'src/public'), path.join(dist, 'public'), { recursive: true });
await cp(path.join(root, 'src/templates'), path.join(dist, 'templates'), {
  recursive: true,
}).catch(() => undefined);

console.log('Build complete → dist/');
