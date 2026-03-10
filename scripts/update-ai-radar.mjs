import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const USER = 'Gliangquan';
const README_PATH = new URL('../README.md', import.meta.url);
const DATA_PATH = new URL('../data/ai-radar.json', import.meta.url);
const DAYS = 7;
const PER_QUERY = 10;
const LIMIT = 12;
const QUERIES = [
  'agent in:name,description',
  'llm in:name,description',
  'ai in:name,description'
];

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function githubJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': `${USER}-awesome-ai-radar`,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function search(query, since) {
  const q = encodeURIComponent(`created:>${since} ${query}`);
  return githubJson(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${PER_QUERY}`);
}

async function main() {
  const since = isoDateDaysAgo(DAYS);
  const merged = new Map();

  for (const query of QUERIES) {
    const payload = await search(query, since);
    for (const item of payload.items ?? []) {
      if (!merged.has(item.full_name)) {
        merged.set(item.full_name, {
          full_name: item.full_name,
          html_url: item.html_url,
          description: item.description,
          stargazers_count: item.stargazers_count,
          language: item.language,
          created_at: item.created_at,
          updated_at: item.updated_at
        });
      }
    }
  }

  const items = [...merged.values()]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, LIMIT);

  const updatedAt = new Date().toISOString();
  const lines = [
    `Updated: ${updatedAt}`,
    '',
    '| Rank | Repository | Description | Language | Stars |',
    '|---:|---|---|---|---:|'
  ];

  for (const [index, repo] of items.entries()) {
    lines.push(`| ${index + 1} | [${repo.full_name}](${repo.html_url}) | ${(repo.description || 'No description').replace(/\|/g, '\\|')} | ${repo.language || 'Unknown'} | ${repo.stargazers_count} |`);
  }

  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify({ updatedAt, since, queries: QUERIES, items }, null, 2) + '\n');

  let readme = readFileSync(README_PATH, 'utf8');
  readme = readme.replace(/<!-- PICKS:START -->[\s\S]*<!-- PICKS:END -->/, `<!-- PICKS:START -->\n${lines.join('\n')}\n<!-- PICKS:END -->`);
  writeFileSync(README_PATH, readme);

  console.log(`Updated AI radar with ${items.length} repositories.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
