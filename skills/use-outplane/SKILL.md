---
name: use-outplane
description: >
  Operate Out Plane: deploy applications, read logs, requests and metrics, manage
  environment variables, ports, custom domains, volumes, managed PostgreSQL, IP access
  and registry credentials. Use whenever the user mentions Out Plane, the `outplane`
  CLI, deploying or redeploying an app, a build that failed, an app that is down or
  unreachable, environment variables, a custom domain, a connection string, or a
  persistent disk, even if they do not say "Out Plane" explicitly. Do NOT use for
  deployments to other hosting platforms.
allowed-tools: Bash(outplane:*), Bash(command:*), Bash(which:*)
metadata:
  author: Out Plane
  version: "0.2.1"
  category: deployment
---

# Use Out Plane

Out Plane runs applications and managed PostgreSQL databases. Everything is done with
one binary, `outplane`, built to be driven by a program: structured output, a stable
exit-code contract, and a machine-readable description of itself.

## Retrieve rather than recall

Flags, limits, allowed values and plan allowances change between releases. **Do not
answer them from memory, and do not trust this file for them.** Every one of them has a
source that costs almost nothing to read:

| Source | How to read it | Authoritative for |
| --- | --- | --- |
| The CLI's own schema | `outplane schema` | Commands, arguments, flags, types, allowed values, output fields, error codes, exit codes, examples |
| Command help | `outplane <command> --help` | The same, for one command, as text |
| Product documentation | `https://docs.outplane.com/docs/cli/<page>.md` | Behaviour, limits, what a change requires |
| Documentation index | `https://docs.outplane.com/llms.txt` | Which page covers what |

`outplane schema` is not a copy of the truth about the command surface, it **is** the
truth: it is generated from the same declarations the binary runs on, needs no
credential, makes no network request, and is deterministic. Every page of documentation
is served as plain Markdown by appending `.md` to its address.

Three rules follow, and they matter more than anything else in this file:

1. **If this file and one of those sources disagree, the source wins.** This file is
   routing and sequence, nothing else.
2. **If this file does not cover it, look it up rather than guessing.** A command, flag
   or behaviour that is not described here is not a command that does not exist. Read
   `outplane schema`, or fetch the documentation page. Never invent a flag, and never
   tell the user something is impossible without having checked.
3. **If something does not behave the way this file says, believe the CLI.** It is newer
   than this text. Say what actually happened.

## Resource model

- **Team** owns everything and is the billing scope. A credential belongs to one team.
- **Application** is one deployable thing: a repository to build, or an image to run.
  Its name is permanent and appears in its address; the display name is only a label.
- **Deployment** is one attempt to build and ship an application.
- **Port** is what an application serves on. Private unless it says otherwise.
- **Custom domain** is a host, and optionally a path, pointing at one port.
- **Volume** is a disk that survives deployments.
- **Managed database** is a PostgreSQL instance holding roles and databases.
- **IP access profile** is a list of networks allowed to reach an application.

## Route by intent, before any ceremony

Preflight is for diagnostic work. When the user wants to ship something, ship it.

```
Getting something running?
├─ From a repository, first time     → outplane app create --repo owner/name --branch main
├─ From a prebuilt image, first time → outplane app create --image <image>
├─ It already exists, ship again     → outplane deploy create --wait
└─ Not signed in yet                 → outplane login   (opens the console, approve there)
```

```
Changing configuration? What matters is whether it reaches the running
application on its own.

├─ Environment variable → env set --deploy        needs a deployment
├─ Port                 → port set --deploy       needs a deployment
├─ Build setting        → build set --deploy      needs a BUILD, which is longer
├─ Volume mount         → volume attach --deploy  reaches it at the next deployment
├─ Custom domain        → domain add / point      immediate, no deployment
├─ IP access            → ip-profile assign       immediate, no deployment
└─ Instances or size    → app scale               immediate, no deployment
```

```
Something is wrong?
├─ The deploy failed            → outplane deploy logs <id>   (the build output)
├─ It deployed but errors       → outplane logs --follow       (what it prints)
├─ Requests are failing         → outplane requests --status 5xx
├─ Nothing answers at all       → outplane port list   (an empty list reaches nothing)
├─ It is using too much         → outplane metrics     (per instance, not per app)
└─ You need to look inside      → outplane app shell   (needs a real terminal)
```

## Preflight

One call answers who, which team, and where that came from:

```bash
outplane status --json
```

It exits `0` even when nothing is configured: the findings are in the fields, not the
exit code. Branch on `signedIn`, `expired` and `teamSource`. Use `outplane whoami` when
you want a command that fails on a missing credential.

Skip it when the intent is to deploy or to sign in. `outplane login` opens the console
and waits for approval; `deploy create` reports a missing credential itself.

If the CLI is not installed, **say so and hand the user the command. Do not install it
yourself**: putting software on their machine is their decision, like a destructive
command is.

```bash
curl -fsSL https://outplane.com/install.sh | sh   # macOS, Linux
npm i -g outplane                                  # Windows, or wherever Node is present
```

The installer verifies the download against the release's checksums and never asks for a
password. Once it is installed, `outplane update` replaces it with the newest release.
Source and releases: `https://github.com/outplane/cli`.

## Destructive commands stop on their own

Destructive commands **never prompt**. Without confirmation they exit `4` and return the
exact invocation that would proceed, in the error's `confirm_command`:

```json
{
  "error": {
    "kind": "confirmation_required",
    "code": "confirmation.required",
    "confirm_command": ["outplane", "app", "delete", "checkout", "--yes", "--confirm-name", "checkout"]
  }
}
```

Three rules follow:

1. **Exit `4` is not a failure.** It means the decision belongs to somebody else. Do not
   retry it and do not report it as an error.
2. **Relay `confirm_command` to the user and stop.** Do not run it on their behalf.
3. **Under an agent harness the command refuses whatever flags it is given**, including
   `--yes` and `--confirm-name`. Do not try to work around that. It is the design: the
   approval belongs to whoever is accountable for the data.

`outplane schema` marks each command `read`, `write` or `destructive`. Build the
decision from that field rather than from a list of names, so a command added in a later
release is classified without anyone editing this file.

## Execution rules

1. Pass `--json`. Output is text on a terminal and JSON in a pipe, but say what you want.
2. Branch on `kind`, on `code`, or on the exit status. **Never on `message`**, which is
   prose and changes between releases.
3. **A queued build is not a shipped deploy.** `deploy create` returns as soon as the
   build is queued. Use `--wait` (blocks quietly) or `--follow` (streams the build).
   Without either, verify with `outplane deploy get <id> --json` before reporting
   success. A timeout is exit `124`: this side gave up, the deployment did not stop.
4. **Saving is not deploying.** `env set`, `port set` and `build set` write the record
   and leave the running application alone. Pass `--deploy`, or say plainly that the
   change takes effect on the next deployment.
5. **Rehearse before changing.** Many commands accept `--dry-run`, which prints the
   request without sending it; the schema says which. Use it when the user should see
   the plan first.
6. **Read back after mutating.** `changed: false` with exit `0` means it already matched,
   which is a success, not a failure.
7. Resolve the target before acting. Most commands fall back to the linked application;
   `outplane link` writes that link and `outplane status` says whether it is winning.
8. **Do not invent flags or values.** If it is not in `outplane schema`, it does not
   exist. Instance sizes, regions, database versions and every other allowed value are
   enumerated there.

## Where to look next

Load one reference. Two at most.

| The user wants to | Reference | Covers |
| --- | --- | --- |
| Ship code, watch a build, change how it builds | `references/deploy.md` | `deploy`, `build` |
| Set variables or open a port | `references/configure.md` | `env`, `env group`, `port` |
| Give it an address, or restrict who reaches it | `references/network.md` | `domain`, `ip-profile` |
| Use a database or a persistent disk | `references/data.md` | `db`, `volume` |
| Find out what it is doing, or why it broke | `references/operate.md` | `logs`, `requests`, `metrics`, `app shell`, `app instances`, `app scale`, `app pause`, `app resume` |
| Create, inspect, rename or delete an application | `references/manage.md` | `app`, `registry` |
| Sign in, switch team, link a directory | `references/session.md` | `login`, `link`, `team`, `status`, `whoami`, `repos`, `update`, `api` |
| Understand a failure | `references/errors.md` | exit codes, the error object, every error code |
| Run this in a pipeline | `references/ci.md` | no terminal, no keychain, `OUTPLANE_TOKEN` |

Anything not listed: ask the schema.

```bash
outplane schema | jq -r '.commands[] | select(.risk == "read") | .name'
```

## Things that surprise people

- `app list` reports the **configured** instance count. `app instances` reports what is
  actually running. A difference between them is a rollout, a restart, or a failure to
  place.
- An application's `status` describes its last deployment, not its health. It can be
  `ready` and still be serving errors.
- A port is **private** unless it says otherwise. A private port is reachable inside the
  platform and by a custom domain, and has no public address.
- `db url`, `env get` and `port get` print a bare value in every format, so
  `URL=$(outplane db url orders)` works. Everything else returns JSON in a pipe.
- `logs` and `deploy logs` are text, not records, and `--json` does not change them.
  `deploy logs` is the **build**; `logs` is the running application.
- `env push` is not a synchronisation: a variable missing from the file is left alone.
  Removing one is `env unset`.
- `app shell` needs a real terminal at both ends. Behind a pipe or an agent harness it
  exits `2` and opens nothing.

## Answering

Report three things, briefly:

1. What was done, and to which application and team.
2. The result: the state, the address, the identifier.
3. What is next, or that there is nothing left to do.

Include command output only where it helps the user understand what happened.
