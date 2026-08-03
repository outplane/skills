// Fills the generated blocks in the reference files from the CLI's own schema.
//
//   node scripts/gen-refs.mjs          write
//   node scripts/gen-refs.mjs --check  fail if writing would change anything
//
// Refresh the snapshot when the CLI changes, from a version-stamped build:
//   (cd ../cli && go run -ldflags "-X main.version=$(git describe --tags --abbrev=0 | sed 's/^v//')" ./cmd/outplane schema) > cli-schema.json
//
// What is generated and what is not, on purpose:
//
//   Generated  the list of commands in a group, and the error codes they raise.
//              Both are facts with one source, and a copy of a fact is a copy that
//              goes wrong on the next release.
//
//   Written    the recipes. Which commands compose into a task, in what order, and
//              what to check between the steps. None of that is in the schema, and it
//              is the only reason a reference exists: `outplane schema <command>`
//              already answers "what are the flags" better than prose ever will.
//
// A block looks like this and everything between the markers is replaced:
//
//   <!-- gen:index deploy build -->
//   ...
//   <!-- /gen -->

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const REFS = join(ROOT, 'skills', 'use-outplane', 'references');
const CHECK = process.argv.includes('--check');

const schema = JSON.parse(readFileSync(join(ROOT, 'cli-schema.json'), 'utf8'));
const name = (c) => c.path.join(' ');

/** Commands whose name is, or starts with, one of the given prefixes. */
function select(prefixes) {
  return schema.commands.filter((c) =>
    prefixes.some((p) => name(c) === p || name(c).startsWith(p + ' ')),
  );
}

const code = (s) => '`' + s + '`';

/** The signature a caller types, positionals included. */
function usage(c) {
  const parts = [...c.path];
  for (const a of c.args ?? []) {
    if (!a.positional) continue;
    const n = a.name.toUpperCase() + (a.variadic ? '...' : '');
    parts.push(a.required ? `<${n}>` : `[${n}]`);
  }
  if ((c.args ?? []).some((a) => !a.positional)) parts.push('[flags]');
  return parts.join(' ');
}

/** The three facts a caller needs before running anything. */
function traits(c) {
  const t = [c.risk];
  if (c.idempotent) t.push('repeatable');
  if (c.supports_dry_run) t.push('--dry-run');
  if (c.long_running) t.push('long-running');
  if (c.streams) t.push(`streams ${c.streams}`);
  if (!c.requires_auth) t.push('no credential');
  return t.join(', ');
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

const BLOCKS = {
  /** Every command in the group, so the agent knows what exists without a schema call. */
  index(prefixes) {
    const rows = select(prefixes).map((c) => [
      code(usage(c)),
      cell(c.description),
      cell(traits(c)),
    ]);
    return [
      '| Command | What it does | Traits |',
      '| --- | --- | --- |',
      ...rows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');
  },

  /** Every error code these commands can raise, grouped by command. */
  errors(prefixes) {
    const rows = select(prefixes)
      .filter((c) => c.error_codes?.length)
      .map((c) => `| ${code(name(c))} | ${c.error_codes.map(code).join(', ')} |`);
    return ['| Command | Codes |', '| --- | --- |', ...rows].join('\n');
  },

  /** The exit status contract. Written once, in errors.md. */
  'exit-codes'() {
    const rows = schema.errors
      .slice()
      .sort((a, b) => a.exit_code - b.exit_code)
      .map(
        (e) =>
          `| ${code(String(e.exit_code))} | ${code(e.kind)} | ${
            e.retryable ? 'yes' : 'no'
          } | ${cell(e.description)} |`,
      );
    return [
      '| Exit | Kind | Worth retrying | Meaning |',
      '| --- | --- | --- | --- |',
      `| ${code('0')} | | no | The command did what it said. |`,
      ...rows,
    ].join('\n');
  },

  /** The global flags, so no reference has to restate them. */
  'global-flags'() {
    const rows = schema.global_args.map((a) => {
      const n = a.short ? `${code(a.short)}, ${code(a.name)}` : code(a.name);
      const bits = [cell(a.description)];
      if (a.enum?.length) bits.push(`One of ${a.enum.map(code).join(', ')}.`);
      if (a.default && a.default !== 'false') bits.push(`Default ${code(a.default)}.`);
      return `| ${n} | ${code(a.type)} | ${bits.join(' ')} |`;
    });
    return ['| Flag | Type | Notes |', '| --- | --- | --- |', ...rows].join('\n');
  },
};

// The line every generated file carries, so a reader knows what it was built from.
const STAMP = `_Generated from \`outplane schema\` at CLI ${schema.version}. Run \`node scripts/gen-refs.mjs\` after refreshing \`cli-schema.json\`._`;

const OPEN = /<!-- gen:([a-z-]+)([^>]*)-->/g;

function render(text, file) {
  let changed = false;
  const out = text.replace(
    /<!-- gen:([a-z-]+)([^>]*)-->[\s\S]*?<!-- \/gen -->/g,
    (_match, kind, argsRaw) => {
      const fn = BLOCKS[kind];
      if (!fn) throw new Error(`${file}: unknown block "gen:${kind}"`);
      const args = argsRaw.trim().split(/\s+/).filter(Boolean);
      changed = true;
      return `<!-- gen:${kind}${argsRaw}-->\n${fn(args)}\n<!-- /gen -->`;
    },
  );
  if (!changed) throw new Error(`${file}: no generated block found`);
  return out.replace(/^_Generated from .*$/m, STAMP);
}

let differs = 0;
for (const file of readdirSync(REFS).filter((f) => f.endsWith('.md')).sort()) {
  const path = join(REFS, file);
  const before = readFileSync(path, 'utf8');
  if (!OPEN.test(before)) {
    OPEN.lastIndex = 0;
    continue; // a reference with nothing to generate is fine
  }
  OPEN.lastIndex = 0;
  const after = render(before, file);
  if (after === before) continue;
  differs++;
  if (CHECK) console.error(`would rewrite references/${file}`);
  else writeFileSync(path, after);
}

if (CHECK && differs) {
  console.error(`\n${differs} file(s) differ. Run: node scripts/gen-refs.mjs`);
  process.exit(1);
}
console.log(
  CHECK
    ? `references match cli-schema.json (CLI ${schema.version})`
    : `${differs} file(s) written from CLI ${schema.version}`,
);
