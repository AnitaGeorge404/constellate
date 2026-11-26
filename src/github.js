// Reads public repositories and this year's activity through the GraphQL API.

const API = 'https://api.github.com/graphql';

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'constellate' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

export async function fetchSky({ login, token, now = new Date() }) {
  if (!token) throw new Error('A GitHub token is required (set GITHUB_TOKEN).');
  const data = await gql(
    token,
    `query($login: String!) { user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
        nodes { name stargazerCount pushedAt createdAt isArchived primaryLanguage { name color } }
      }
      contributionsCollection {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
        commitContributionsByRepository(maxRepositories: 100) {
          contributions { totalCount }
          repository { nameWithOwner }
        }
      }
    } }`,
    { login },
  );
  if (!data.user) throw new Error(`GitHub user "${login}" not found.`);

  const cc = data.user.contributionsCollection;
  const commits = new Map(cc.commitContributionsByRepository.map((c) => [c.repository.nameWithOwner.toLowerCase(), c.contributions.totalCount]));
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

  return {
    login,
    generatedAt: now,
    total: cc.contributionCalendar.totalContributions,
    streak: currentStreak(days),
    repos: data.user.repositories.nodes
      .filter((r) => !r.isArchived)
      .map((r) => ({
        name: r.name,
        stars: r.stargazerCount,
        pushedAt: new Date(r.pushedAt),
        createdAt: new Date(r.createdAt),
        lang: r.primaryLanguage?.name ?? null,
        color: r.primaryLanguage?.color ?? '#8b949e',
        commits: commits.get(`${login}/${r.name}`.toLowerCase()) ?? 0,
      })),
  };
}

function currentStreak(days) {
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let streak = 0;
  while (i >= 0 && days[i].contributionCount > 0) {
    streak++;
    i--;
  }
  return streak;
}
