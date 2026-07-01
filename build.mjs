import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, copyFileSync, existsSync } from 'fs';

const watch = process.argv.includes('--watch');

// Prepare output directories
mkdirSync('dist/tiles', { recursive: true });

// Copy manifest
copyFileSync('manifest.json', 'dist/manifest.json');

// Copy tile images (required for the panel thumbnails)
if (existsSync('public/tiles')) {
  cpSync('public/tiles', 'dist/tiles', { recursive: true });
} else {
  console.warn('⚠  public/tiles not found. Run: npm run copy-tiles');
}

// Copy icons if present
if (existsSync('public/icons')) {
  mkdirSync('dist/icons', { recursive: true });
  cpSync('public/icons', 'dist/icons', { recursive: true });
}

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  loader: { '.css': 'text' },
  target: 'chrome100',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
};

if (watch) {
  const [ctx1, ctx2] = await Promise.all([
    esbuild.context({
      ...shared,
      entryPoints: ['src/content/content.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),
    esbuild.context({
      ...shared,
      entryPoints: ['src/content/injected.ts'],
      outfile: 'dist/injected.js',
      format: 'iife',
    }),
  ]);
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log('Watching for changes…');
} else {
  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: ['src/content/content.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),
    esbuild.build({
      ...shared,
      entryPoints: ['src/content/injected.ts'],
      outfile: 'dist/injected.js',
      format: 'iife',
    }),
  ]);
  console.log('✓ Build complete → dist/');
}
