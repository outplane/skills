# Out Plane Agent Skills

Teaches a coding agent to deploy and operate applications on
[Out Plane](https://outplane.com): applications and deployments, environment variables,
ports, custom domains, volumes, managed PostgreSQL, IP access, logs and metrics.

One skill, `use-outplane`. It loads on its own when the conversation is about Out Plane,
so there is nothing to remember and nothing to type.

## Install

**As a Claude Code plugin** (recommended):

```text
/plugin marketplace add outplane/skills
/plugin install outplane@outplane
```

**With the skills CLI:**

```bash
npx skills add outplane/skills
```

**By hand.** Copy `skills/use-outplane/` into your agent's skills directory:

| Agent | Directory |
| --- | --- |
| Claude Code | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |
| OpenAI Codex | `~/.codex/skills/` |
| OpenCode | `~/.config/opencode/skills/` |

Restart the agent afterwards so it picks the skill up.

A first-class `outplane skills install` is planned for the CLI, so that the skill and the
CLI on a machine are always the same age. It does not exist yet; use one of the channels
above.

## What it needs

The `outplane` CLI, signed in:

```bash
curl -fsSL https://outplane.com/install.sh | sh   # macOS, Linux
npm i -g outplane                                  # Windows, or wherever Node is present

outplane login
```

In a pipeline, set `OUTPLANE_TOKEN` instead of signing in.

CLI source and releases: [github.com/outplane/cli](https://github.com/outplane/cli).
Documentation: [docs.outplane.com/cli](https://docs.outplane.com/cli).

## Try it

Once it is installed, ask your agent things like:

- "Deploy this directory to Out Plane."
- "Why did my last deploy fail?"
- "Set `DATABASE_URL` on checkout and roll it out."
- "Give this app a custom domain."
- "Is my app healthy? What are the 5xx responses?"
- "Create a Postgres database and wire it into the app."
- "Only let the office network reach this service."

## How it is built

```text
skills/use-outplane/
├── SKILL.md              routing, execution rules, the destructive protocol
└── references/           depth, loaded only when a task needs it
    ├── deploy.md         deploy, build
    ├── configure.md      env, env group, port
    ├── network.md        domain, ip-profile
    ├── data.md           db, volume
    ├── operate.md        logs, requests, metrics, shell, instances, scale, pause
    ├── manage.md         app lifecycle, registry credentials
    ├── session.md        login, link, team, status, update, api
    ├── errors.md         exit codes, the error object, every error code
    └── ci.md             running where there is no terminal
```

`SKILL.md` stays small on purpose. Once a skill loads, its content stays in the
conversation for the rest of the session, so the body is routing and the depth waits in
`references/` until a task actually needs it.

**The tables are generated.** Command lists, error codes, exit codes and global flags all
come from `outplane schema`, which the CLI produces from the same declarations it runs
on. Documentation that restates a flag by hand is documentation that goes wrong the first
time the flag changes and stays wrong until somebody notices.

```bash
node scripts/gen-refs.mjs          # fill the generated blocks
node scripts/gen-refs.mjs --check  # fail if they have drifted
node scripts/validate.mjs          # check the rules a skill has to follow
```

To refresh the snapshot after a CLI release:

```bash
(cd ../cli && go run -ldflags "-X main.version=$(git describe --tags --abbrev=0 | sed 's/^v//')" ./cmd/outplane schema) > cli-schema.json
node scripts/gen-refs.mjs
```

## Contributing

Read the skill before changing it: the parts outside the `<!-- gen:… -->` blocks are the
recipes, which is the only thing a reference is for. Flag lists belong in the schema.

Two rules that are not negotiable:

1. **Bump `version` in `.claude-plugin/plugin.json` in any change to skill content.**
   Claude Code compares that version to decide whether an installed copy is stale.
   Without a bump, nobody receives the change. Keep `metadata.version` in `SKILL.md` in
   step with it; `scripts/validate.mjs` checks that they agree.
2. **`node scripts/validate.mjs` and `node scripts/gen-refs.mjs --check` must pass.**
   Both run in CI.

## License

[Apache-2.0](LICENSE). Copyright 2026 Out Plane LLC.
