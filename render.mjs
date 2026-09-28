// profile（＋任意の自動集計値）→ 1枚の HTML 文字列。build.mjs と portfolio-maker の両方から使う
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dads.css'), 'utf8');

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (n) => n.toLocaleString('ja-JP');

function statsRow(s) {
  if (!s) return '';
  const items = [
    ...s.metrics.map((m) => [m.label, m.value]),
    ['コード', `${num(s.lines)}行`],
    s.tests ? ['テスト', `${num(s.tests)}件`] : null,
    s.commits ? ['コミット', `${num(s.commits)}`] : null,
    ['最終更新', ymd(s.lastMod)],
  ].filter(Boolean);
  return `<dl class="stats">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

// status → チップラベルの色。色だけで意味を伝えないよう必ず文字を併記する
const STATUS_COLOR = { '運用中': 'green', 'デプロイ済み': 'blue', '公開中': 'blue', '完成': 'blue', '試作': 'gray', '開発中': 'gray' };

function projectCard(p, s) {
  return `<article class="card">
  <div class="card__head">
    <h3 class="card__title">${esc(p.title)}</h3>
    ${p.status ? `<span class="chip" data-style="filled-1" data-color="${STATUS_COLOR[p.status] ?? 'gray'}">${esc(p.status)}</span>` : ''}
  </div>
  <p>${esc(p.summary)}</p>
  ${p.points?.length ? `<ul class="list">${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${statsRow(s)}
  ${p.stack?.length ? `<ul class="tags" role="list" aria-label="使用技術">${p.stack.map((t) => `<li class="chip" data-style="outlined" data-color="gray">${esc(t)}</li>`).join('')}</ul>` : ''}
</article>`;
}

const timeline = (items) => `<dl class="timeline">${items.map((a) => `<div><dt>${esc(a.date)}</dt><dd><h3>${esc(a.title)}</h3>${a.detail ? `<p>${esc(a.detail)}</p>` : ''}</dd></div>`).join('')}</dl>`;

const section = (id, title, items, body) => (items?.length ? `<section aria-labelledby="${id}"><h2 id="${id}" class="section-title">${title}</h2>${body(items)}</section>` : '');

/**
 * @param {object} profile  profile.json と同じ形
 * @param {{ stats?: Record<string, object>, built?: Date, credit?: string }} opts
 *   stats: project.id → build.mjs の collect() 結果。無ければ数値欄は出さない
 */
export function renderPage(profile, { stats = {}, built = new Date(), credit = '' } = {}) {
  // 空欄・危険なスキーム（javascript: など）のリンクは出さない
  const links = (profile.links ?? []).filter((l) => /^(https?:|mailto:)/i.test(l.url ?? ''));
  const hasStats = Object.keys(stats).length > 0;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(profile.name)} | ポートフォリオ</title>
<meta name="description" content="${esc(profile.name)}${profile.nameEn ? `（${esc(profile.nameEn)}）` : ''}のポートフォリオ。${esc(profile.tagline)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
<style>
${CSS}</style>
</head>
<body>
<main>
<header class="hero">
  <hgroup>
    ${profile.nameEn ? `<p class="en" lang="en">${esc(profile.nameEn)}</p>` : ''}
    <h1>${esc(profile.name)}</h1>
    ${profile.tagline ? `<p class="tagline">${esc(profile.tagline)}</p>` : ''}
  </hgroup>
  <div class="about">${(profile.about ?? []).map((a) => `<p>${esc(a)}</p>`).join('')}</div>
  ${links.length ? `<ul class="links" role="list">${links.map((l) => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
</header>

${section('projects', 'プロジェクト', profile.projects, (ps) => `<div class="cards">\n${ps.map((p) => projectCard(p, stats[p.id])).join('\n')}\n</div>`)}
${section('awards', '受賞・実績', profile.awards, timeline)}
${section('experience', '経験', profile.experience, timeline)}
${section('upcoming', '準備中', profile.upcoming, (us) => `<div class="upcoming">${us.map((u) => `<h3>${esc(u.title)}</h3><p>${esc(u.detail)}</p>`).join('')}</div>`)}
${section('skills', 'スキル', profile.skills, (ss) => `<dl class="skills">${ss.map((s) => `<div><dt>${esc(s.group)}</dt><dd>${(s.items ?? []).map(esc).join(' / ')}</dd></div>`).join('')}</dl>`)}

<footer>
  <p>${hasStats ? 'プロジェクトの数値は各ソースコードから自動集計しています。' : ''}最終更新 <time datetime="${ymd(built)}">${ymd(built)}</time></p>
  <p>デザインは<a href="https://design.digital.go.jp/dads/">デジタル庁デザインシステム</a>に準拠しています。${credit}</p>
</footer>
</main>
</body>
</html>
`;
}
