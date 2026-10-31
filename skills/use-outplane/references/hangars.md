# Hangars

A machine in the cloud for the team's coding agents, and how to get into it.

**Do not answer a flag, a limit or an allowed value from memory.** Read it:

- `outplane schema hangar` lists every command in this group with its flags, types,
  allowed values, output fields and error codes. Local, no credential, generated from
  what the binary runs.
- `https://docs.outplane.com/docs/cli/hangar.md` has the product behaviour and the limits.
  Every documentation page is served as plain Markdown by appending `.md`, and
  `https://docs.outplane.com/llms.txt` says which page covers what.

When this file disagrees with either of them, they win.

If `outplane schema hangar` exits `2` because it does not know the command, the
installed CLI is older than Hangars. `outplane update` is the fix. The same goes for
`outplane schema hangar port`, `outplane schema hangar metrics` and
`outplane schema hangar restart`, which arrived later than the rest.

## A Hangar or an application

A Hangar is somewhere for agents to **work**. An application is something that
**serves**.

| The user wants | Use |
| --- | --- |
| Coding agents that keep running after their own machine is closed | A Hangar |
| One machine the team's agents and people work on together | A Hangar |
| Something that answers requests at an address | An application, `manage.md` |
| A repository built and shipped on every push | An application, `deploy.md` |

What a Hangar is:

- The coding agents chosen when it was created, already installed, each in a window of
  its own.
- A disk that keeps what is written to its home directory across restarts. Not across
  a deletion.
- One terminal session that keeps running between connections. Everyone who joins it
  sees the same screen and types into the same programs.
- It belongs to the team, not to whoever created it.
- Up to three ports for the dev servers its agents run, opened and closed at any time
  with `hangar port`.

What it is not is an application. It has no deployments, no build and no custom domain,
and no `app`, `deploy`, `env`, `port`, `domain`, `logs`, `requests` or `metrics` command
reaches one: given a Hangar's name they answer not found. Its ports are `hangar port`,
never `port`, and its usage is `hangar metrics`, never `metrics`. `app list` leaves
Hangars out and `hangar list` leaves applications out, **yet the two share one set of
names**: a name either one holds is taken for both.

A `hangar` command that acts on one Hangar takes it by name or id, and never falls back
to the linked application.

## Creating

```bash
outplane hangar create myhangar --dry-run --json    # checks everything, sends nothing
outplane hangar create myhangar --json
```

Decide these before running it, because no command changes them afterwards:

| Question | Flag | Why it matters now |
| --- | --- | --- |
| What is it called? | the positional name | **Permanent**, and drawn from the same names as the team's applications |
| Which agents? | `--agent`, repeatable, or `--terminal-only` for none | Installed at creation. Without either, the default set the schema names |
| What do they need? | `--env`, `--env-group` | The variables are fixed at creation. Agents' API keys go here, or the agents sign in from the terminal |
| How long may it sit idle? | `--idle-timeout` | Recorded at creation. Do not promise the user that the Hangar pauses on its own |

The size and the disk are the platform's choice, not a flag. The result reports them as
`size` and `diskGb`.

Everyone who joins the session can read every variable in it. A personal key set here
is shared with the whole team; say so before setting one.

The name is stored in lower case and the name as typed becomes the display name. Use
`name` from the result in every later command. Variable values are never echoed back;
`envCount` says how many were set. A variable from `--env` wins over a group's, and
between groups the one given later wins. A group used only at build reaches nothing,
because a Hangar never builds, and the command says so on standard error.

### Agents that are ready to work

An agent in a Hangar either signs in from its own window, which takes a person, or uses
an API key from the Hangar's variables, which skips the sign in (an agent may still ask
once in its window whether to use the key it found; Claude Code does). To create
Hangars whose agents need no sign in, put the key in a variable group and assign the
group:

```bash
outplane env group get ai-keys --json                   # the group the user keeps the key in
outplane hangar create worker1 --agent claude-code --env-group ai-keys --json
outplane hangar create worker2 --agent codex --env-group ai-keys --json
```

- **Let the user put the key in the group**, in the console or with
  `outplane env group create`. Do not ask for the key itself: a value you type ends up
  in the command line and the transcript. Referring to the group by name keeps it out
  of both.
- **Which variable each agent reads:** `ANTHROPIC_API_KEY` for `claude-code`,
  `OPENAI_API_KEY` for `codex`, `CURSOR_API_KEY` for `cursor`, any model provider's key
  for `pi`, `omp` and `opencode`. `devin` signs in from its window only.
- **The key is the team's.** Everyone who joins the Hangar can read it, so it should be
  a team key, not someone's personal one. Say so before using one.
- **One group serves every Hangar.** Changing the key later means changing the group.
  A Hangar's variables are fixed when it is created, so a Hangar created before the
  change keeps the old value until it is created again.

Several Hangars are separate machines that work in parallel, up to the team's limit.
Giving one of them a task still happens in its terminal: hand the user
`outplane hangar connect <name>` for each.

### Creating starts it

The command returns as soon as the Hangar exists, while it is still starting. Poll until
it runs:

```bash
outplane hangar get myhangar --json --fields status    # until ready
```

`status` is the field to branch on:

- `deploying` while it starts. Keep polling, for a few minutes at most.
- `ready` once it runs.
- `failed` when it could not start. Stop polling and say so; see below.
- `crashed` when it stopped unexpectedly. It restarts on its own. Report it, and if it
  stays down after a few minutes, stop polling; deleting it and creating it again is the
  user's call.
- `paused` outranks the rest.
- `unknown:N` is a state this release does not recognise; treat it as unknown, not as a
  failure.

**A Hangar that could not start still exits `0`**, with status `failed`. Its record
exists and holds the name, so creating it again is refused as taken. The way back is to
delete it, which is the user's confirmation to give, and create it again.

### Refusals only the server makes

Everything else is checked before anything is sent, so an error names the field.

- **Exit `6`, a conflict.** A Hangar **or an application** holds the name.
  `hangar list` does not show an application's name; `app list` does.
- **Exit `7`, a quota.** A team can have a fixed number of Hangars, the
  same on every plan, and this one has them all. Retrying never helps and a plan change
  does not either, so do not send the user to billing. Deleting one makes room.
- **Exit `2`, a variable name the platform reserves.** The platform keeps the prefix
  `HANGAR_` for a Hangar's own variables, for applications and groups too. Recent CLIs
  refuse it before sending. Rename the variable.

The exact error codes are in `outplane schema hangar create`.

## Looking at them

```bash
outplane hangar list --json
outplane hangar get myhangar --json --fields status,agents
```

The list is the whole team's in one response. Variables are never included, in any
format, and no flag adds them.

## Is it busy, is it full

```bash
outplane hangar metrics --json                 # every Hangar in the team
outplane hangar metrics myhangar --json --fields hangar,status,memoryPercent,diskPercent
```

CPU and memory now, against `cpuLimitMillicores` and `memoryLimitMb`, which are what its
size allows, and how full its home disk is. A snapshot, not a history: the console's
Overview draws the last hour. Naming one Hangar costs what naming none does, so ask once
rather than in a loop.

- **`null` is not idle.** While nothing runs, starting or paused, CPU and memory are
  `null` and `status` says why. Do not report it as 0%.
- **Memory is the one to watch.** A Hangar that reaches its memory limit freezes rather
  than restarting, with the session and every agent in it, and `status` can go on
  reading `ready`. At `memoryPercent` 90 or more, act before it gets there: stop an
  agent or a dev server it does not need, or move the work to another Hangar. The text
  output warns under the table; `--json` carries only the number.
- **The disk is the home disk, as last measured**, so a paused Hangar still reports it.
- **Temporary storage is not reported.** Everything outside the home directory, `/tmp`
  included, is measured nowhere, so a low `diskPercent` says nothing about it.

## Getting into its terminal

```bash
outplane hangar connect myhangar    # for the user, in a terminal of their own
```

**Do not run this yourself.** It needs a real terminal at both ends, and under an agent
harness it exits `2` whatever else it is given; `--dry-run` is the one form that runs
there. Do not
wrap it in anything that pretends to be a terminal. That is the design, not an obstacle:
a session has no transcript and no exit status, and other people may be typing in it.

What to do instead:

1. Check that it runs: `outplane hangar get myhangar --json --fields status`. Until it
   is `ready`, connecting is refused with exit `6`, a conflict, which is worth retrying
   only while it is still starting.
2. If the name is in doubt, `outplane hangar connect myhangar --dry-run --json` runs
   anywhere and reports which Hangar it reaches. It joins nothing.
3. Give the user the command to run in their own terminal, as
   `outplane hangar connect <name> --team <teamSlug>` with `teamSlug` from
   `outplane status --json`, as the console does, so it reaches this team whatever
   their terminal's default is. The console opens the same session in the browser, one
   tab per window.

Tell them three things with it:

- It is the Hangar's own session, not a new shell. Anyone else connected sees the same
  screen and types into it.
- Each agent has a window. `Ctrl-b w` lists the windows and `Ctrl-b d` leaves. The
  command prints both on the way in.
- Leaving stops nothing. What runs there keeps running, and connecting again picks it up
  where it is.

## Ports for its dev servers

```bash
outplane hangar port list myhangar --json
outplane hangar port set myhangar 3000                # a new port is private HTTP: the team's apps reach it
outplane hangar port set myhangar 3000:http:public    # also open to everyone on the internet
outplane hangar port unset myhangar 3000 --dry-run    # what would be left
```

The Hangar is always the first argument, never `--app`. The spec is the one `port set`
takes, `PORT[:SCHEME[:public|private]]`, and a part left out keeps what the port already
had; a new port is private HTTP.

- **Private or public.** Every open port is reachable from the team's applications at
  `internal`, which is `name:port`. A public one also has `url`: an https address for
  `http` and `h2c`, a host and a port number for `tcp`. **Public is open to everyone on
  the internet**, because a Hangar takes no IP access profile and no custom domain. Keep
  a port private unless the user wants an outside address, and say so when making one
  public.
- **No `--deploy`, no restart.** A save is live within seconds, and the terminal session
  and the agents in it keep running. Do not tell the user it needs a deployment.
- **The dev server must listen on `0.0.0.0`.** One that listens on `localhost` is reached
  by nothing outside the Hangar: the public address answers `502`, and applications and
  tcp clients have the connection refused. Check the bind before blaming the port.
- **Checked before sending:** at most 3 ports, 1 to 65535, none twice, never `7070`,
  which is the Hangar's own. The codes are in `outplane schema hangar port set`.

Two refusals only the server makes:

- **Exit `5`, not found, on a Hangar that exists.** It never started, so there is
  nothing to route to. The ports are saved all the same and show in `hangar port list`,
  but nothing reaches them. Deleting it and creating it again is the user's call.
- **Exit `8`.** Saved, but not on the Hangar yet. After `set` the same command again
  applies it. After `unset` it does not, because those ports are already closed in the
  saved set: if a port is still open, run the `hangar port set` step the error hands
  back; if none is left, open a port and close it again. Until then the closed ports may
  still answer, a public one included, and `hangar port list` shows the saved set rather
  than what the Hangar serves. Tell the user.

The exact error codes are in `outplane schema hangar port set`.

## Restarting it

```bash
outplane hangar restart myhangar --json
outplane hangar get myhangar --json --fields status    # until ready
```

The Hangar starts again on a new machine with the same disk, and the Hangar image is
pulled again. It is the way out of a Hangar frozen at its memory limit, and how an
existing Hangar picks up a newer image. It is back in under a minute.

- **What stops:** everything running in its terminal session, every agent included, and
  everyone connected is disconnected.
- **What stays:** the files under its home directory, `/home/hangar`. Its name,
  variables and ports do not change.
- **It is the user's call.** It ends other people's sessions and the agents they left
  running, and a Hangar is the team's, so somebody else may be working in it right now.
  Ask the user before restarting one, and say what it stops. For the Hangar you are
  running in, see below.
- **Poll until it is back, and stop.** `status` reads `deploying`, then `ready`; a
  `ready` in the first few seconds can still be the state from before the restart. Check
  every few seconds for a few minutes at most; if it is not `ready` by then, report what
  `status` says rather than restarting again.
- **Exit `6`, a conflict:** nothing is running to restart, as when it never started.
  Retrying does not help.

The exact error codes are in `outplane schema hangar restart`.

## When you are running inside a Hangar

The agents in a Hangar read this skill too. Every shell in a Hangar has `HANGAR_NAME`
set to the Hangar's name; when it is set, you are inside that Hangar. Then:

- **Never connect to the Hangar you are in, and never hand the user that command to run
  from inside it.** A session joined from inside itself shows itself inside itself,
  without end. The user reaches it from their own terminal or from the console.
- **Deleting it deletes the machine this work is on.** The deletion is the user's to
  confirm in any case. Before relaying the command, say that the disk goes with it and
  that anything not committed and pushed is lost.
- **Never restart the Hangar you are in without the user's explicit go-ahead.** It ends
  this process along with everything else in the session, so nothing you run after it
  happens, the check that it came back included. Say so, and leave that check to the
  user.
- **Work that has to outlive the Hangar belongs in a repository.** The disk survives a
  restart, not a deletion.
- **Keep clones, builds and caches under the home directory.** Everything outside it,
  `/tmp` included, is temporary and capped, and going over the cap restarts the machine,
  which ends every program in the session, this one and other people's included.
  `https://docs.outplane.com/docs/console/hangars.md` has the sizes.
- **To let the user open a dev server you started**, it needs a public port on this
  Hangar, `outplane hangar port set "$HANGAR_NAME" <port>:http:public`, which anyone on
  the internet can open. Say so, bind the server to `0.0.0.0`, then give them that port's
  `url` from `ports` in the result. A private port is for the team's applications only.
- **If the CLI there is not signed in**, ask the user to run `outplane login` in one of
  the Hangar's windows. There is no browser on a Hangar, so the command asks for a token
  to be pasted, which is a step for the person and not for you.

## Deleting

```bash
outplane hangar delete myhangar --dry-run --json    # which Hangar the name reaches
outplane hangar delete myhangar                     # stops with exit 4
```

Destructive: it stops with exit `4` and hands back the exact command, as the skill
describes. Under an agent harness it stops whatever else it is given; `--dry-run` still
runs. Relay
`confirm_command` and stop. Before confirming, tell the user:

- **There is no undelete and no retention window.** The disk goes with the Hangar, and
  with it everything its agents wrote and nobody pushed elsewhere.
- **It is the team's.** Somebody else may be working in it right now, and anyone
  connected is disconnected.
- **Nothing stops a deletion.** A running Hangar, one with people in its session and
  one that failed to start are all deleted the same way.

`--confirm-name` is matched against the permanent lower-case name, not the display name.
Afterwards the name is free again, for a Hangar or an application, and the team has room
for another Hangar.

## What does not exist

None of these is a command. Do not offer them, and do not reach for an `app` command as
a substitute, because none of those sees a Hangar.

- **Pausing or resuming a Hangar.** `app pause` does not reach one.
- **Changing it after creation**: its variables, its agents, its name. Deleting it and
  creating it again is the only way, and the disk does not carry over.
- **Choosing its size or its disk.**
- **Cloning a repository at creation.** Clone it from the terminal, as on any machine.
- **A custom domain or an IP access profile on a Hangar's port.** A public port is open
  to everyone. To serve something behind either, deploy it as an application.
- **Logs or requests for a Hangar.** What it is using is `hangar metrics`; `logs`,
  `requests` and `metrics` do not reach one.
- **Unassigning a variable group from a Hangar with the CLI.** `env group get --apps`
  lists a Hangar among the group's users, but `env group unassign` reaches applications
  only. The user removes a Hangar's assignment on the variable group's page in the
  console (Unlink).

If `outplane schema hangar` lists a command for one of these, it arrived after this was
written. Use it.
