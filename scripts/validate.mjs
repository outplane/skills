// Checks this repository against the rules a skill has to follow.
//
//   node scripts/validate.mjs
//
// The rules come from the Agent Skills specification and from what Claude Code does
// with a skill once it is installed. Most of them fail quietly rather than loudly:
// a skill with a bad name is not rejected, it simply never loads, and a skill whose
// body has grown is not refused, it just costs every turn of every session that
// touches it. So they are checked here rather than discovered later.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKILLS = join(ROOT, 'skills');

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

// Claude Code keeps a loaded skill in context for the rest of the session and
// re-attaches only the first 5,000 tokens after a compaction. Anthropic's own
// guidance is 500 lines; we hold a tighter line because the body is meant to be
// routing, and the depth lives in references/.
const BODY_MAX_LINES = 300;

// The skill listing truncates description + when_to_use at 1,536 characters, and the
// specification caps description at 1,024.
const DESCRIPTION_MAX = 1024;

function parseFrontmatter(text, where) {
  if (!text.startsWith('---\n')) {
    fail(where, 'does not start with YAML frontmatter');
    return null;
  }
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    fail(where, 'frontmatter is never closed');
    return null;
  }
  const raw = text.slice(4, end);
  const fields = {};
  let key = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-z_-]+):\s*(.*)$/);
    if (m) {
      key = m[1];
      const value = m[2].replace(/^["']|["']$/g, '');
      // `>` and `|` open a block scalar: the indicator is syntax, not content, and
      // reading it as content is how a checker for angle brackets fails on every
      // folded description ever written.
      fields[key] = /^[>|][-+]?$/.test(value.trim()) ? '' : value;
    } else if (key && line.trim()) {
      fields[key] = (fields[key] ? fields[key] + ' ' : '') + line.trim();
    }
  }
  return { fields, body: text.slice(end + 4) };
}

for (const dir of readdirSync(SKILLS)) {
  const skillDir = join(SKILLS, dir);
  if (!statSync(skillDir).isDirectory()) continue;
  const where = `skills/${dir}`;

  // The file name is case-sensitive and has no accepted variations.
  if (!existsSync(join(skillDir, 'SKILL.md'))) {
    fail(where, 'has no SKILL.md (the name is case-sensitive)');
    continue;
  }

  // Documentation for humans belongs in the repository root. A README inside a skill
  // folder is explicitly forbidden by the specification.
  if (existsSync(join(skillDir, 'README.md'))) {
    fail(where, 'contains README.md, which the specification forbids inside a skill');
  }

  if (!/^[a-z][a-z0-9-]*$/.test(dir)) {
    fail(where, 'directory name must be kebab-case with no spaces, underscores or capitals');
  }

  const text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const parsed = parseFrontmatter(text, where);
  if (!parsed) continue;
  const { fields, body } = parsed;

  if (fields.name !== dir) {
    fail(where, `frontmatter name "${fields.name}" does not match the directory name`);
  }
  if (/claude|anthropic/i.test(fields.name ?? '')) {
    fail(where, 'name may not contain "claude" or "anthropic"');
  }

  const description = fields.description ?? '';
  if (!description) {
    fail(where, 'has no description, so nothing tells the model when to load it');
  }
  if (description.length > DESCRIPTION_MAX) {
    fail(where, `description is ${description.length} characters, over the ${DESCRIPTION_MAX} cap`);
  }
  // Frontmatter is placed in the model's system prompt, so angle brackets are refused
  // rather than escaped.
  if (/[<>]/.test(description)) {
    fail(where, 'description contains an angle bracket, which is forbidden in frontmatter');
  }
  // A description that never says when not to fire is the usual cause of a skill
  // loading on unrelated work.
  if (!/\bnot\b/i.test(description)) {
    fail(where, 'description has no negative trigger, so it will load on unrelated requests');
  }

  const lines = body.split('\n').length;
  if (lines > BODY_MAX_LINES) {
    fail(where, `body is ${lines} lines, over the ${BODY_MAX_LINES} line budget. Move depth into references/`);
  }

  // Every reference the body names has to exist, and every reference that exists has
  // to be reachable. An unreachable file is one nobody will ever load.
  const refsDir = join(skillDir, 'references');
  if (existsSync(refsDir)) {
    const onDisk = readdirSync(refsDir).filter((f) => f.endsWith('.md'));
    const named = new Set([...body.matchAll(/references\/([a-z-]+\.md)/g)].map((m) => m[1]));
    for (const ref of named) {
      if (!onDisk.includes(ref)) fail(where, `names references/${ref}, which does not exist`);
    }
    for (const ref of onDisk) {
      if (!named.has(ref)) fail(where, `references/${ref} exists but SKILL.md never points at it`);
    }
  }
}

// The plugin version is what Claude Code compares to decide whether an installed copy
// is stale. A skill edited without a version bump reaches nobody.
const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json');
if (existsSync(pluginPath)) {
  const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? '')) {
    fail('.claude-plugin/plugin.json', 'version must be major.minor.patch');
  }
  for (const dir of readdirSync(SKILLS)) {
    const skillFile = join(SKILLS, dir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const m = readFileSync(skillFile, 'utf8').match(/version:\s*"?(\d+\.\d+\.\d+)"?/);
    if (m && m[1] !== plugin.version) {
      fail(`skills/${dir}`, `metadata.version ${m[1]} disagrees with plugin.json ${plugin.version}`);
    }
  }
}

if (problems.length) {
  console.error('Skill validation failed:\n');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('Skill validation passed.');
