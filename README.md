# Out Plane Agent Skills

Teaches a coding agent to deploy and operate applications on
[Out Plane](https://outplane.com): applications and deployments, environment variables,
ports, custom domains, volumes, managed PostgreSQL, IP access, logs and metrics.

One skill, `use-outplane`. It loads on its own when the conversation is about Out Plane,
so there is nothing to remember and nothing to type.

## Install

**With the Out Plane CLI** (needs CLI v0.2.1 or later):

```bash
outplane skills install
```

Detects every coding tool on the machine and installs into each. `--agent` picks one,
`--project` writes into the current repository instead of your home directory so the
team shares one copy.

**As a Claude Code plugin:**

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

**Nothing here restates the CLI.** Command lists, flags, allowed values and per-command
error codes are not copied into these files, because a copy is wrong the first time the
CLI changes and stays wrong until somebody notices. The skill sends the agent to
`outplane schema`, which is local, needs no credential and is generated from what the
binary actually runs. Only the exit-code contract is written out, because it is
append-only by design and an agent branching on it should not need a tool call.

```bash
node scripts/validate.mjs          # check the rules a skill has to follow
```

## Contributing

Read the skill before changing it. A reference exists for the recipes: which commands
compose into a task, in what order, and what to check between the steps. Flag lists,
allowed values and limits belong in `outplane schema` and in the documentation, not here.

Two rules that are not negotiable:

1. **Bump `version` in `.claude-plugin/plugin.json` in any change to skill content.**
   Claude Code compares that version to decide whether an installed copy is stale.
   Without a bump, nobody receives the change. Keep `metadata.version` in `SKILL.md` in
   step with it; `scripts/validate.mjs` checks that they agree.
2. **`node scripts/validate.mjs` must pass.** It runs in CI.

## License

[Apache-2.0](LICENSE). Copyright 2026 Out Plane LLC.
