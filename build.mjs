// profile.json（手書き）＋ 各プロジェクトの実物から集計した数値 → dist/index.html
// 使い方: node build.mjs
// 外部依存なし（Node 標準ライブラリのみ）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderPage, ymd } from './render.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile.json'), 'utf8'));

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.c']);
const ALWAYS_SKIP = new Set(['node_modules', '.git', '.claude']);

// ---------- 集計 ----------
function walk(target, exclude) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (ALWAYS_SKIP.has(e.name) || exclude.has(e.name)) continue;
    const p = path.join(target, e.name);
    if (e.isDirectory()) out.push(...walk(p, exclude));
    else out.push(p);
  }
  return out;
}

function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function pick(obj, expr) {
  if (expr === 'length') return Array.isArray(obj) ? obj.length : Object.keys(obj).length;
  return expr.split('.').reduce((o, k) => o?.[k], obj);
}

function collect(p) {
  if (!p.path) return null;
  const target = path.resolve(ROOT, p.path);
  if (!fs.existsSync(target)) { console.warn(`[skip] ${p.id}: ${target} が見つからない`); return null; }

  const files = walk(target, new Set(p.exclude ?? []));
  let lines = 0, codeFiles = 0, tests = 0, lastMod = 0;
  for (const f of files) {
    lastMod = Math.max(lastMod, fs.statSync(f).mtimeMs);
    if (!CODE_EXT.has(path.extname(f))) continue;
    const src = fs.readFileSync(f, 'utf8');
    codeFiles++;
    lines += src.split('\n').filter((l) => l.trim()).length;
    if (/[\\/]tests?[\\/]|\.test\.|\.spec\./.test(f)) tests += (src.match(/^\s*(?:test|it)\(/gm) ?? []).length;
  }

  const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
  const isOwnRepo = git(dir, ['rev-parse', '--show-toplevel']) &&
    path.resolve(git(dir, ['rev-parse', '--show-toplevel'])) === path.resolve(dir);
  const commits = isOwnRepo ? Number(git(dir, ['rev-list', '--count', 'HEAD'])) || null : null;

  const metrics = (p.metrics ?? []).flatMap((m) => {
    try {
      const v = pick(JSON.parse(fs.readFileSync(path.join(dir, m.file), 'utf8')), m.get);
      return v == null ? [] : [{ label: m.label, value: `${Number(v).toLocaleString('ja-JP')}${m.unit ?? ''}` }];
    } catch { return []; }
  });

  return { lines, codeFiles, tests, commits, lastMod: new Date(lastMod), metrics };
}

// ---------- 出力 ----------
const stats = Object.fromEntries(profile.projects.flatMap((p) => { const s = collect(p); return s ? [[p.id, s]] : []; }));
const built = new Date();
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), renderPage(profile, { stats, built }));
console.log(`built dist/index.html (${ymd(built)})`);
