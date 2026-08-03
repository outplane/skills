# Operating a running application

What it is doing, why it broke, and how much of it there is.

Flag detail: `outplane schema logs`, `outplane schema requests`, `outplane schema metrics`.

<!-- gen:index logs requests metrics app shell app instances app scale app pause app resume -->
| Command | What it does | Traits |
| --- | --- | --- |
| `app list [flags]` | list the applications in a team | read, repeatable |
| `app get [APP]` | show one application in detail | read, repeatable |
| `app create <NAME> [flags]` | create an application and deploy it | write, --dry-run |
| `app scale [APP] [flags]` | change how many instances an application runs, and how large they are | write, repeatable, --dry-run |
| `app pause [APP]` | stop an application without deleting it | write, repeatable, --dry-run |
| `app resume [APP]` | start a paused application | write, repeatable, --dry-run |
| `app instances [APP]` | list the instances an application is actually running | read, repeatable |
| `app delete <APP> [flags]` | permanently delete an application | destructive, --dry-run |
| `app rename <DISPLAY-NAME> [flags]` | change the label an application is shown under | write, repeatable, --dry-run |
| `logs [APP] [flags]` | show what an application printed | read, repeatable, long-running |
| `metrics [APP]` | show what applications are using right now | read, repeatable |
| `requests [APP] [flags]` | show the HTTP requests an application received | read, repeatable, long-running, streams ndjson |
| `app shell [APP] [flags]` | open an interactive shell on a running instance | write, --dry-run, long-running |
<!-- /gen -->

## Diagnosing, in order

Start with the cheapest question that could explain it.

1. **Is it deployed at all?** `outplane app get --json --fields status,url`.
   A paused application answers nothing. `status` describes the last deployment, not
   health: it can say ready while the application returns errors.
2. **Did the last deploy work?** `outplane deploy list --limit 1 --json`. If it failed,
   the build output is the answer and `deploy.md` has the rest.
3. **Is anything running?** `outplane app instances --json`. Fewer instances than
   configured means a rollout, a restart loop, or something that cannot be placed. An
   empty list on a paused application is expected.
4. **What is it printing?** `outplane logs --follow`.
5. **What are callers getting?** `outplane requests --status 5xx --json`.
6. **Is it out of room?** `outplane metrics --json`.

## Logs

```bash
outplane logs --follow
outplane logs --since 30m --search "timeout"
outplane deploy logs <deploymentId>          # a different thing: the build
```

Output is the log text, one line per line, so it pipes into `grep` or a file. It is not
records; `--json` does not change it, because a log line has no fields to report.

`--lines` counts back from the most recent, so raising it reaches further back rather
than adding newer lines. `--level` narrows by the words in the line, because severity is
not stored separately, so it can miss a line that phrases its severity differently.

Without `--follow` the command returns what exists now and exits `0`, even when that is
nothing. An application that has printed nothing is not an error.

## Requests

```bash
outplane requests --status 5xx --json
outplane requests --method POST,DELETE --since 1h --json
outplane requests --follow                    # NDJSON, one object per line
```

The field that answers the most questions is the pair `status` and `originStatus`:

- `502` with `originStatus` `0` means the application **never replied**. Look at
  instances and logs; the request never reached working code.
- `500` with `originStatus` `500` means the application replied with an error. The
  answer is in the application's own logs.

`--search` matches the raw record before it is parsed, so it finds a path, a host and a
header alike, and it cannot be anchored to one field. Use `--status` and `--method` for
that.

## Metrics

```bash
outplane metrics --json
```

Every figure is **per instance**, because the limit is per instance. An application
running five copies at half its memory is using five halves of one limit, not two and a
half limits. Do not add them up.

`instances` here is what is reporting, which is not the configured count. Percentages are
`null` when no limit is on record and are never capped: over 100 is a real state and the
most useful thing this reports.

An application with nothing running reports zeroes rather than being left out, so a
paused application is visible as one.

## Size and count

```bash
outplane app scale --instances 3 --json
outplane app scale --size <size> --json
```

Applied without a deployment; the change is visible within seconds and
`app instances` shows it happening. It states the desired state rather than performing an
action, so running it twice is harmless and `changed: false` with exit `0` means it
already matched.

The flag you leave out is filled in from the current setting, which is read first, so
two callers scaling the same application at the same time can overwrite each other.

A size above the plan's allowance is exit `7`, not a validation error: the list of
allowed sizes belongs to the team, and `outplane schema app scale` enumerates the codes.

## Stopping without deleting

```bash
outplane app pause     # every instance stops, everything else is kept
outplane app resume    # comes back at the same instance count and size
```

Both are immediate and need no deployment. A paused application keeps its configuration,
variables, disks, domains and address, and reports `paused` as its status while
`deploymentStatus` still says what it will return to.

## A shell inside a running instance

```bash
outplane app shell
outplane app shell --command "sh -c 'ls -la /data'"
```

Three things make this different from every other command:

- **It needs a real terminal at both ends.** Behind a pipe, a redirect or an agent
  harness it exits `2` and opens nothing. It cannot be scripted. `--dry-run` is the only
  form that runs anywhere.
- **There is no exit status.** A command that failed inside the session still ends it
  with `0`. Nothing here can be used to decide whether something worked.
- **Changes live on one instance until it restarts.** They are not configuration, they
  do not reach the other instances, and the next deployment replaces the lot.

Instance names change on every restart, so one read a minute ago may already be gone.

_Generated from `outplane schema` at CLI 0.1.1. Run `node scripts/gen-refs.mjs` after refreshing `cli-schema.json`._
