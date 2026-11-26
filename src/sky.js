// Places repositories in the sky: each language becomes a constellation.
import { rng, hashString } from './util.js';

export const W = 840, H = 460;
export const SKY = { x0: 48, x1: 792, y0: 104, y1: 400 };
export const MOON = { x: 760, y: 128, r: 18 };
const MOON_ZONE = { x: 700, y: 128, r: 92 }; // moon + its caption

const NAMES = {
  Python: 'Serpens',
  Rust: 'Cancer',
  JavaScript: 'Scriptor',
  TypeScript: 'Typhon',
  Go: 'Gopherus',
  Java: 'Coffea',
  C: 'Crux',
  'C++': 'Centaurus',
  'C#': 'Musica',
  Ruby: 'Rubra',
  Kotlin: 'Kotlinus',
  Swift: 'Hirundo',
  HTML: 'Tabula',
  CSS: 'Pictor',
  SCSS: 'Pictor',
  'Jupyter Notebook': 'Codex',
  Shell: 'Concha',
  PHP: 'Elephas',
  Dart: 'Sagitta',
  Haskell: 'Lambda',
  Lua: 'Luna',
  Vue: 'Visio',
  Svelte: 'Gracilis',
  Zig: 'Fulmen',
  Dockerfile: 'Cetus',
};

export const constellationName = (lang) => NAMES[lang] ?? `${lang.replace(/[^A-Za-z]/g, '') || 'Ignot'}us`;

const DAY = 86400000;

export function layoutSky(data) {
  const R = rng(hashString(`${data.login}:sky`));
  const repos = data.repos.slice(0, 60).map((r) => ({ ...r }));
  const maxC = Math.max(1, ...repos.map((r) => r.commits));
  const now = data.generatedAt.getTime();
  for (const r of repos) {
    r.b = Math.log1p(r.commits) / Math.log1p(maxC); // 0..1 brightness
    r.fresh = now - r.pushedAt.getTime() < 7 * DAY;
  }

  // Languages with 2+ repos become constellations; everything else is a field star.
  const byLang = new Map();
  for (const r of repos) if (r.lang) (byLang.get(r.lang) ?? byLang.set(r.lang, []).get(r.lang)).push(r);
  const groups = [...byLang.entries()]
    .map(([lang, rs]) => ({ lang, name: constellationName(lang), color: rs[0].color, repos: rs, weight: rs.reduce((s, r) => s + 1 + r.b * 2, 0) }))
    .filter((g) => g.repos.length >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
  const grouped = new Set(groups.flatMap((g) => g.repos));
  const field = repos.filter((r) => !grouped.has(r));

  const clampX = (x) => Math.min(SKY.x1, Math.max(SKY.x0, x));
  const clampY = (y) => Math.min(SKY.y1, Math.max(SKY.y0, y));

  // 1. Centres: best-candidate sampling keeps constellations apart.
  const placed = [];
  for (const g of groups) {
    g.radius = Math.min(95, 20 + 12 * Math.sqrt(g.repos.length));
    const rx = g.radius * 1.3, ry = g.radius * 0.75;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 400; i++) {
      const x = SKY.x0 + rx + R() * (SKY.x1 - SKY.x0 - 2 * rx);
      const y = SKY.y0 + ry + R() * (SKY.y1 - SKY.y0 - 2 * ry - 16);
      let score = Math.hypot(x - MOON_ZONE.x, y - MOON_ZONE.y) - g.radius - MOON_ZONE.r;
      for (const p of placed) score = Math.min(score, Math.hypot(x - p.cx, (y - p.cy) * 1.4) - g.radius - p.radius - 24);
      if (score > bestScore) (bestScore = score), (best = { x, y });
    }
    g.cx = best.x;
    g.cy = best.y;
    placed.push(g);

    // 2. Stars inside: brightest near the middle, the rest spread out evenly.
    const pts = [];
    for (const r of [...g.repos].sort((a, b) => b.b - a.b)) {
      let bp = null, bs = -Infinity;
      for (let i = 0; i < 50; i++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R());
        const x = clampX(g.cx + Math.cos(a) * d * rx), y = clampY(g.cy + Math.sin(a) * d * ry);
        let s = pts.length ? Infinity : -d;
        for (const p of pts) s = Math.min(s, Math.hypot(x - p.x, y - p.y));
        if (s > bs) (bs = s), (bp = { x, y });
      }
      Object.assign(r, bp);
      pts.push(r);
    }

    // 3. Lines: a minimum spanning tree reads like a hand-drawn constellation.
    g.edges = [];
    const tree = [pts[0]], rest = pts.slice(1);
    while (rest.length) {
      let bi = 0, bj = 0, bd = Infinity;
      tree.forEach((p, i) => rest.forEach((q, j) => {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bd) (bd = d), (bi = i), (bj = j);
      }));
      g.edges.push([tree[bi], rest[bj]]);
      tree.push(rest.splice(bj, 1)[0]);
    }

    const maxY = Math.max(...pts.map((p) => p.y)), minY = Math.min(...pts.map((p) => p.y));
    g.labelX = Math.min(SKY.x1 - 40, Math.max(SKY.x0 + 40, g.cx));
    g.labelY = maxY + 24 <= SKY.y1 + 14 ? maxY + 24 : minY - 22;
  }

  // 4. Field stars fill the gaps.
  const all = groups.flatMap((g) => g.repos);
  for (const r of field) {
    let bp = null, bs = -Infinity;
    for (let i = 0; i < 60; i++) {
      const x = SKY.x0 + R() * (SKY.x1 - SKY.x0), y = SKY.y0 + R() * (SKY.y1 - SKY.y0);
      let s = Math.hypot(x - MOON_ZONE.x, y - MOON_ZONE.y) - MOON_ZONE.r;
      for (const g of groups) s = Math.min(s, Math.hypot(x - g.cx, (y - g.cy) * 1.4) - g.radius - 10);
      for (const p of all) s = Math.min(s, Math.hypot(x - p.x, y - p.y) - 12);
      if (s > bs) (bs = s), (bp = { x, y });
    }
    Object.assign(r, bp);
    all.push(r);
  }

  // Background dust.
  const dust = Array.from({ length: 170 }, () => ({ x: 10 + R() * (W - 20), y: 90 + R() * (H - 150), r: 0.3 + R() * 0.55, o: 0.12 + R() * 0.4 }));

  // A repo born in the last 45 days earns a shooting star.
  const newest = [...repos].sort((a, b) => b.createdAt - a.createdAt)[0];
  const shooting = newest && now - newest.createdAt.getTime() < 45 * DAY ? { name: newest.name, x: 120 + R() * 300, y: 96 + R() * 40 } : null;

  const named = [...repos].sort((a, b) => b.b - a.b).filter((r) => r.b > 0).slice(0, 3);

  return {
    login: data.login,
    generatedAt: data.generatedAt,
    total: data.total,
    streak: data.streak,
    repos,
    groups,
    dust,
    shooting,
    named: new Set(named),
    rand: R,
  };
}
