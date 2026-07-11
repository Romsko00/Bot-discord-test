#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const strip = require('strip-comments');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCLUDES = new Set([
'node_modules',
'archives',
'.git',
'logs',
'temp']
);

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
  d.getFullYear(),
  pad(d.getMonth() + 1),
  pad(d.getDate()),
  '-',
  pad(d.getHours()),
  pad(d.getMinutes()),
  pad(d.getSeconds())].
  join('');
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isExcluded(fullPath) {
  const rel = path.relative(PROJECT_ROOT, fullPath);
  if (rel.startsWith('..')) return true;
  const parts = rel.split(path.sep);
  return parts.some((p) => EXCLUDES.has(p));
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (isExcluded(full)) continue;
    if (ent.isDirectory()) {
      walk(full, files);
    } else if (ent.isFile() && full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function backupAndStrip(files) {
  const backupRoot = path.join(PROJECT_ROOT, 'archives', `comments-backup-${nowStamp()}`);
  ensureDirSync(backupRoot);
  let changed = 0;

  for (const file of files) {
    const rel = path.relative(PROJECT_ROOT, file);
    const backupPath = path.join(backupRoot, rel);
    ensureDirSync(path.dirname(backupPath));


    const original = fs.readFileSync(file, 'utf8');


    fs.writeFileSync(backupPath, original, 'utf8');


    const stripped = strip(original, {
      preserve: false,

      safe: true
    });

    if (stripped !== original) {
      fs.writeFileSync(file, stripped, 'utf8');
      changed++;
      process.stdout.write(`Stripped: ${rel}\n`);
    }
  }

  console.log(`\nDone. Processed ${files.length} .js files. Modified ${changed} files.`);
  console.log(`Backups saved under: ${backupRoot}`);
}

function main() {
  const startDir = PROJECT_ROOT;
  const files = walk(startDir);
  if (files.length === 0) {
    console.log('No .js files found to process.');
    return;
  }
  backupAndStrip(files);
}

if (require.main === module) {
  main();
}
