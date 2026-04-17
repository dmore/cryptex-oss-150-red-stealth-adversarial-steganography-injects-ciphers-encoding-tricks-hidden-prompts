#!/usr/bin/env node
/**
 * Promote the SvelteKit build output (app/build/) to the repo-root dist/
 * so the existing GitHub Pages workflow path ("dist/") continues to work.
 *
 * Run by the root `build:app` script: see root package.json.
 * This is Phase-0 glue — will be retired in Phase 4 when the legacy
 * `dist/` output convention is dropped and the workflow uploads
 * `app/build/` directly.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'app', 'build');
const dest = path.join(projectRoot, 'dist');

function assertSourceExists() {
  if (!fs.existsSync(src)) {
    console.error(`[promote-dist] ERROR: ${src} does not exist. Run \`cd app && npm run build\` first.`);
    process.exit(1);
  }
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) {
    console.error(`[promote-dist] ERROR: ${src} is not a directory`);
    process.exit(1);
  }
}

function cleanDest() {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });
}

function copyRecursive(from, to) {
  // Node 16.7+ has fs.cpSync which is perfect for this.
  fs.cpSync(from, to, { recursive: true, force: true, errorOnExist: false });
}

function main() {
  assertSourceExists();
  cleanDest();
  copyRecursive(src, dest);

  const indexPath = path.join(dest, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`[promote-dist] ERROR: ${indexPath} missing after copy`);
    process.exit(1);
  }

  console.log(`[promote-dist] ${src} → ${dest}`);
  const files = fs.readdirSync(dest);
  console.log(`[promote-dist] ${files.length} top-level entries promoted`);
}

main();
