# Signing in, teams, and this directory

Which credential answers, which team it acts on, and which application a command means
when none is named.

<!-- gen:index login logout whoami link unlink team status repos update api -->
| Command | What it does | Traits |
| --- | --- | --- |
| `login [flags]` | sign in to a team | write, repeatable, no credential |
| `logout [flags]` | remove a stored credential | write, repeatable, no credential |
| `whoami` | show the active credential | read, repeatable |
| `link [APP]` | point this directory at a team, and optionally an application | write, repeatable |
| `unlink` | remove this directory's link | write, repeatable, no credential |
| `api <METHOD> <PATH> [flags]` | call an API endpoint the CLI has no command for | destructive, --dry-run |
| `repos [flags]` | list the repositories you can deploy from | read, repeatable |
| `status` | show which team and credential the next command will use | read, repeatable, no credential |
| `team list` | list the teams this machine is signed in to | read, repeatable, no credential |
| `team use <TEAM>` | choose the team commands act on by default | write, repeatable, no credential |
| `update [flags]` | install the newest version of this CLI | write, repeatable, no credential |
<!-- /gen -->

## Signing in

```bash
outplane login
```

This opens the console and waits. Approving there hands the token to a listener on the
loopback address of this machine, so the token is never displayed, copied or pasted, and
never lands in a terminal's history. The listener accepts one delivery, only from
loopback, and only when it carries back the one-time value that process generated.

Where there is no browser, the same command prints the address and reads a token that
the user pastes. Nothing about that is an error, and `--no-browser` asks for it directly.

**Do not run `login` on the user's behalf and then wait silently.** If the flow falls
back to pasting, relay the address to the user the moment it appears.

`--token-stdin` reads a token from standard input. `--token` takes it as an argument and
is the form to avoid: arguments are visible in process lists and in most pipeline logs.

A token belongs to one team, so signing in again **adds** a credential rather than
replacing one.

## Which team a command acts on

The first of these that is set wins, and `outplane status` reports the winner in
`teamSource`, which is the fastest way to answer "why is it doing that":

| Order | Source |
| --- | --- |
| 1 | `--token` |
| 2 | `OUTPLANE_TOKEN` |
| 3 | `--team` |
| 4 | `OUTPLANE_TEAM_ID` |
| 5 | the directory link |
| 6 | `outplane team use` |

```bash
outplane status --json                 # who, which team, and why
outplane team list --json              # teams this machine has a credential for
outplane team use <slug>               # this machine's default
outplane app list --team <slug>        # just this once
```

`team list` lists teams with a **stored credential**, not teams you belong to. A team
missing from it has not been signed in to on this machine; it does not mean the team
does not exist. An empty list is a normal result.

## Linking a directory

```bash
outplane link checkout      # remember the team and the application here
outplane status --json      # confirm it is the one winning
outplane unlink
```

The link is written in the current directory. A link already present in a parent is not
edited; the new one shadows it for this subtree. An application reference is matched
exactly, against the id, then the name, then the display name. There is no fuzzy
matching, and a display name shared by two applications is an error rather than a guess.

`unlink` removing nothing is a success, so a teardown script can run it unconditionally.

## Status and identity

`status` exits `0` even when nothing is configured: it is a report, and the findings are
in the fields. Branch on `signedIn`, `expired` and `teamSource`. Use `whoami` when you
want a command that **fails** on a missing credential.

Neither makes a network request. Expiry is decoded from the token itself, so a token
revoked in the console still reads as valid here and only fails on the next real command.

## Repositories

```bash
outplane repos --json
```

The list belongs to the person whose token this is, not to the team, so two members of
one team can see different repositories and each can only create applications from their
own. An empty list means nothing has been connected yet, which is done in the console;
the address is in the output and in the error.

## Updating

```bash
outplane update --check     # says what it would do, does nothing
outplane update
```

It replaces the binary using whichever way it was installed. An installation that neither
the install script nor npm placed exits `2`: whatever put it there should replace it.

**Exit `9` from any other command means the API has stopped serving that release**, and
this is the command that fixes it. It is the one failure with a single known remedy.

## When there is no command for it

```bash
outplane api GET /App/GetAppsByTeamId
outplane api POST /Some/Endpoint --data @body.json --yes
```

An escape hatch to the API for endpoints the CLI has no command for. It handles the
credential, the team header and the response envelope; what is left is the method and
the path.

It behaves like an escape hatch on purpose. It cannot tell what a call will change, so
anything other than a read needs `--yes`, and **under an agent harness a write is refused
whatever flags it is given**. There is no `--confirm-name` here, because the command
cannot know which resource is being changed or what it is called.

Where a named command exists, use that instead: it validates before sending, explains its
failures, reports what changed, and can be rehearsed with `--dry-run`. Check first:

```bash
outplane schema | jq -r '.commands[].name'
```

_Generated from `outplane schema` at CLI 0.1.1. Run `node scripts/gen-refs.mjs` after refreshing `cli-schema.json`._
