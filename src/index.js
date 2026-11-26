#!/usr/bin/env node
// constellate: turn your GitHub repositories into a night sky.
//
//   node src/index.js --user <login> [--out constellate]
//   node src/index.js --demo
//
// Needs GITHUB_TOKEN (or GH_TOKEN) in the environment, except with --demo.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchSky } from './github.js';
import { demoSky } from './demo.js';
import { layoutSky } from './sky.js';
import { render } from './render.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    out[a.slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const outDir = args.out ?? env.CONSTELLATE_OUT ?? 'constellate';

  let data;
  if (args.demo) data = demoSky();
  else {
    const login = args.user ?? env.CONSTELLATE_USER;
    if (!login) throw new Error('Whose sky? Pass --user <github-login> (or CONSTELLATE_USER).');
    data = await fetchSky({ login, token: env.GITHUB_TOKEN ?? env.GH_TOKEN });
  }

  const sky = layoutSky(data);
  await mkdir(outDir, { recursive: true });
  for (const theme of ['dark', 'light']) {
    const file = path.join(outDir, `constellate-${theme}.svg`);
    await writeFile(file, render(sky, theme));
    console.log(`wrote ${file}`);
  }
  console.log(`@${sky.login}: ${sky.repos.length} stars, constellations: ${sky.groups.map((g) => `${g.name} (${g.lang}, ${g.repos.length})`).join(', ')}; ${sky.streak}-day streak${sky.shooting ? `; shooting star: ${sky.shooting.name}` : ''}`);
}

main().catch((err) => {
  console.error(`constellate: ${err.message}`);
  process.exit(1);
});
