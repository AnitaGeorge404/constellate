// Fake but plausible repositories, for previews without a token.
import { rng } from './util.js';

const LANGS = [
  ['Python', '#3572A5', 9],
  ['TypeScript', '#3178c6', 7],
  ['Rust', '#dea584', 5],
  ['Go', '#00ADD8', 3],
  ['Shell', '#89e051', 2],
  ['HTML', '#e34c26', 1],
];

export function demoSky(now = new Date()) {
  const R = rng(7);
  const repos = [];
  for (const [lang, color, n] of LANGS)
    for (let i = 0; i < n; i++)
      repos.push({
        name: `${lang.toLowerCase()}-${['lab', 'kit', 'core', 'cli', 'notes', 'api', 'ui', 'bot', 'sim'][i]}`,
        stars: R() < 0.3 ? Math.round(R() * 40) : 0,
        pushedAt: new Date(now - R() * 200 * 86400000),
        createdAt: new Date(now - (60 + R() * 600) * 86400000),
        lang,
        color,
        commits: R() < 0.25 ? 0 : Math.round(R() ** 2 * 300),
      });
  repos[0].pushedAt = now;
  repos[1].createdAt = new Date(now - 10 * 86400000);
  return { login: 'octo-astronomer', generatedAt: now, total: 1432, streak: 9, repos };
}
