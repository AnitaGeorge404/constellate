// Draws the sky as a self-contained, animated SVG.
import { mix, esc, num, dayLong } from './util.js';
import { W, H, MOON } from './sky.js';

export const THEMES = {
  dark: {
    bg: '#0d1117', skyTop: '#0d1117', skyBottom: '#121a2a', border: '#21262d', fg: '#e6edf3', muted: '#7d8590',
    core: '#ffffff', coreAmt: 0.55, glowOp: 0.55, line: '#c9d1d9', lineOp: 0.28, dust: '#ffffff', dustOp: 1,
    moonLit: '#e6edf3', moonDark: '#1c2330', spike: '#ffffff', nebulaOp: 0.09, label: '#c9d1d9',
  },
  light: {
    bg: '#ffffff', skyTop: '#ffffff', skyBottom: '#f6f8fa', border: '#d0d7de', fg: '#1f2328', muted: '#656d76',
    core: '#000000', coreAmt: 0.3, glowOp: 0.22, line: '#57606a', lineOp: 0.35, dust: '#1f2328', dustOp: 0.45,
    moonLit: '#8c959f', moonDark: '#eaeef2', spike: '#1f2328', nebulaOp: 0.05, label: '#57606a',
  },
};

const f = (v) => +v.toFixed(1);

export function render(sky, themeName = 'dark') {
  const t = THEMES[themeName];
  const R = mulberry(sky); // fresh, deterministic stream per theme
  const colors = [...new Set(sky.repos.map((r) => r.color))];
  const gid = (c) => `g${colors.indexOf(c)}`;

  // --- defs ---
  const glows = colors
    .map((c) => `<radialGradient id="${gid(c)}"><stop offset="0" stop-color="${c}" stop-opacity="${t.glowOp}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`)
    .join('');
  const top = sky.groups[0];
  const nebula = top
    ? `<radialGradient id="neb"><stop offset="0" stop-color="${top.color}" stop-opacity="${t.nebulaOp}"/><stop offset="1" stop-color="${top.color}" stop-opacity="0"/></radialGradient>`
    : '';

  // --- dust ---
  const dust = sky.dust.map((d) => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" fill="${t.dust}" fill-opacity="${f(d.o * t.dustOp)}"/>`).join('');

  // --- constellation lines (they draw themselves in) ---
  const starR = (r) => 1.3 + r.b * 2.4;
  const lines = sky.groups
    .map((g, gi) => {
      const segs = g.edges
        .map(([a, b], ei) => {
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const pa = (starR(a) + 4) / len, pb = (starR(b) + 4) / len;
          if (pa + pb >= 1) return '';
          const x1 = a.x + (b.x - a.x) * pa, y1 = a.y + (b.y - a.y) * pa;
          const x2 = b.x - (b.x - a.x) * pb, y2 = b.y - (b.y - a.y) * pb;
          return `<line class="draw" style="animation-delay:${f(1.3 + gi * 0.25 + ei * 0.12)}s" pathLength="1" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
        })
        .join('');
      const label = `<g class="in" style="animation-delay:${f(1.9 + gi * 0.25)}s"><text x="${f(g.labelX)}" y="${f(g.labelY)}" class="cname" text-anchor="middle">${esc(g.name.toUpperCase())}</text><text x="${f(g.labelX)}" y="${f(g.labelY + 13)}" class="sub" text-anchor="middle">${esc(g.lang)} · ${g.repos.length}</text></g>`;
      return segs + label;
    })
    .join('');

  // --- stars ---
  const order = [...sky.repos].sort((a, b) => b.b - a.b);
  const stars = order
    .map((r, i) => {
      const rad = starR(r);
      const core = mix(r.color, t.core, t.coreAmt);
      const glow = `<circle cx="${f(r.x)}" cy="${f(r.y)}" r="${f(rad * 4.5)}" fill="url(#${gid(r.color)})"/>`;
      const spikes = r.stars > 0
        ? `<path d="M${f(r.x - rad * 4)},${f(r.y)}H${f(r.x + rad * 4)}M${f(r.x)},${f(r.y - rad * 4)}V${f(r.y + rad * 4)}" stroke="${t.spike}" stroke-opacity=".45" stroke-width=".6" stroke-linecap="round"/>`
        : '';
      const pulse = r.fresh
        ? `<circle class="pulse" cx="${f(r.x)}" cy="${f(r.y)}" r="${f(rad + 1)}" fill="none" stroke="${core}" stroke-width=".9"/>`
        : '';
      const name = sky.named.has(r) ? `<text x="${f(r.x + rad + 7)}" y="${f(r.y - rad - 4)}" class="rname">${esc(r.name)}</text>` : '';
      const tw = `animation-duration:${f(2.2 + R() * 3)}s;animation-delay:-${f(R() * 4)}s`;
      const title = `<title>${esc(r.name)} · ${num(r.commits)} commits this year${r.stars ? ` · ${r.stars}★` : ''}${r.lang ? ` · ${esc(r.lang)}` : ''}</title>`;
      return `<g class="in" style="animation-delay:${f(0.35 + Math.min(i, 40) * 0.025)}s">${title}${glow}<g class="tw" style="${tw}">${spikes}<circle cx="${f(r.x)}" cy="${f(r.y)}" r="${f(rad)}" fill="${core}"/></g>${pulse}${name}</g>`;
    })
    .join('');

  // --- moon: phase follows your streak (new at 0 days, full at 14+) ---
  const k = Math.min(sky.streak, 14) / 14;
  const { x: mx, y: my, r: mr } = MOON;
  let lit = '';
  if (k >= 0.999) lit = `<circle cx="${mx}" cy="${my}" r="${mr}" fill="${t.moonLit}"/>`;
  else if (k > 0.001) {
    const rx = f(mr * Math.abs(1 - 2 * k));
    lit = `<path d="M${mx},${my - mr}A${mr},${mr} 0 0 1 ${mx},${my + mr}A${rx},${mr} 0 0 ${k < 0.5 ? 0 : 1} ${mx},${my - mr}Z" fill="${t.moonLit}"/>`;
  }
  const phaseName = k === 0 ? 'new moon' : k < 0.45 ? 'waxing crescent' : k < 0.55 ? 'first quarter' : k < 1 ? 'waxing gibbous' : 'full moon';
  const moon = `<g class="in" style="animation-delay:.5s">
    <circle cx="${mx}" cy="${my}" r="${mr * 2.6}" fill="url(#moonglow)"/>
    <circle cx="${mx}" cy="${my}" r="${mr}" fill="${t.moonDark}"/>${lit}
    <text x="${mx - mr - 14}" y="${my - 3}" class="cap" text-anchor="end">TONIGHT</text>
    <text x="${mx - mr - 14}" y="${my + 13}" class="era" text-anchor="end">${sky.streak > 0 ? `${sky.streak}-day streak` : 'Resting'}</text>
    <text x="${mx - mr - 14}" y="${my + 27}" class="sub" text-anchor="end">${phaseName}</text>
  </g>`;

  // --- shooting star for a brand-new repo ---
  const shoot = sky.shooting
    ? `<g class="shoot"><title>New: ${esc(sky.shooting.name)}</title><line x1="${f(sky.shooting.x)}" y1="${f(sky.shooting.y)}" x2="${f(sky.shooting.x - 70)}" y2="${f(sky.shooting.y - 26)}" stroke="url(#trail)" stroke-width="1.4" stroke-linecap="round"/><circle cx="${f(sky.shooting.x)}" cy="${f(sky.shooting.y)}" r="1.4" fill="${t.fg}"/></g>`
    : '';

  // --- header & footer ---
  const header = `
    <text x="32" y="50" class="title">@${esc(sky.login)}</text>
    <text x="32" y="70" class="sub">${sky.repos.length} repositories, mapped as stars</text>
    <text x="${W - 32}" y="50" class="stat" text-anchor="end">${num(sky.total)}</text>
    <text x="${W - 32}" y="70" class="sub" text-anchor="end">contributions this year</text>
    <text x="${W - 192}" y="50" class="stat" text-anchor="end">${sky.groups.length}</text>
    <text x="${W - 192}" y="70" class="sub" text-anchor="end">${sky.groups.length === 1 ? 'constellation' : 'constellations'}</text>`;
  const footer = `
    <text x="32" y="${H - 26}" class="tick">brightness = commits this year   ✦ starred   ◌ pushed this week</text>
    <text x="${W - 32}" y="${H - 26}" class="tick" text-anchor="end">constellate · ${dayLong(sky.generatedAt)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="c-title">
<title id="c-title">Constellate for @${esc(sky.login)}: ${sky.repos.length} repositories in ${sky.groups.length} constellations</title>
<style>
  text{font-family:ui-sans-serif,-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif;fill:${t.fg}}
  .title{font-size:19px;font-weight:600;letter-spacing:-.2px}
  .stat{font-size:20px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .sub{font-size:11px;fill:${t.muted}}
  .era{font-size:13px;font-weight:600}
  .cap{font-size:9.5px;letter-spacing:1.6px;fill:${t.muted};font-weight:600}
  .cname{font-size:10px;letter-spacing:2.4px;font-weight:600;fill:${t.label}}
  .rname{font-size:10px;fill:${t.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .tick{font-size:10.5px;fill:${t.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
  line.draw{stroke:${t.line};stroke-opacity:${t.lineOp};stroke-width:.8;stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.2s cubic-bezier(.65,0,.35,1) forwards}
  .in{opacity:0;animation:fade 1s ease forwards}
  .tw{animation-name:tw;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}
  .pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.6s ease-out 2.5s infinite;opacity:0}
  .shoot{opacity:0;animation:shoot 9s linear 3.5s infinite}
  @keyframes fade{to{opacity:1}}
  @keyframes draw{to{stroke-dashoffset:0}}
  @keyframes tw{from{opacity:1}to{opacity:.45}}
  @keyframes pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(3.6);opacity:0}}
  @keyframes shoot{0%{opacity:0;transform:translate(0,0)}1%{opacity:1}9%{opacity:0;transform:translate(240px,90px)}100%{opacity:0;transform:translate(240px,90px)}}
  @media (prefers-reduced-motion:reduce){.in,line.draw,.tw{animation:none;opacity:1;stroke-dashoffset:0}.pulse,.shoot{display:none}}
</style>
<defs>
  <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.skyTop}"/><stop offset="1" stop-color="${t.skyBottom}"/></linearGradient>
  <radialGradient id="moonglow"><stop offset="0" stop-color="${t.moonLit}" stop-opacity=".16"/><stop offset="1" stop-color="${t.moonLit}" stop-opacity="0"/></radialGradient>
  <linearGradient id="trail" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${t.fg}" stop-opacity=".9"/><stop offset="1" stop-color="${t.fg}" stop-opacity="0"/></linearGradient>
  ${nebula}${glows}
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#skyg)" stroke="${t.border}"/>
${top ? `<ellipse cx="${f(top.cx)}" cy="${f(top.cy)}" rx="${f(top.radius * 2.6)}" ry="${f(top.radius * 1.6)}" fill="url(#neb)"/>` : ''}
<g class="in">${dust}</g>
${header}
${moon}
${shoot}
${lines}
${stars}
${footer}
</svg>
`;
}

// Separate seeded stream for twinkle timings so both themes match.
function mulberry(sky) {
  let a = 0;
  for (const c of sky.login) a = (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
