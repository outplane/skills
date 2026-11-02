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
`port`, `metrics`, `restart`, `pause`, `resume` and `update` under
`outplane schema hangar`, which arrived later than the rest, for an `env` command that
does not know `--hangar`, and for a `hangar create` that does not know `--repo`.

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
- A disk that keeps what is written to its home directory across restarts and pauses.
  Not across a deletion.
- One terminal session that keeps running between connections. Everyone who joins it
  sees the same screen and types into the same programs.
- It belongs to the team, not to whoever created it.
- Up to three ports for the dev servers its agents run, opened and closed at any time
  with `hangar port`.

What it is not is an application. It has no deployments, no build and no custom domain,
and no `app`, `deploy`, `port`, `domain`, `logs`, `requests` or `metrics` command
reaches one: given a Hangar's name they answer not found. Its ports are `hangar port`,
never `port`, its variables are `env --hangar`, never `env --app`, its usage is
`hangar metrics`, never `metrics`, and pausing it is `hangar pause`, never `app pause`. `app list` leaves
Hangars out and `hangar list` leaves applications out, **yet the two share one set of
names**: a name either one holds is taken for both.

A `hangar` command that acts on one Hangar takes it by name or id, and never falls back
to the linked application.

## Creating

```bash
outplane hangar create myhangar --dry-run --json    # checks everything, sends nothing
outplane hangar create myhangar --json
```

Decide these before running it, because no command changes the first three afterwards:

| Question | Flag | Why it matters now |
| --- | --- | --- |
| What is it called? | the positional name | **Permanent**, and drawn from the same names as the team's applications |
| Which agents? | `--agent`, repeatable, or `--terminal-only` for none | Installed at creation. Without either, the default set the schema names |
| Which repository, if any? | `--repo owner/name --branch <branch>`, plus `--public-repo` for a public one | Cloned once, on its first start; see A repository on it. Without `--repo`, none |
| What do they need? | `--env`, `--env-group` | Agents' API keys go here, or the agents sign in from the terminal. `env set --hangar` and `env group assign --hangar` change them later, from its next start |
| How long may it sit idle? | `--idle-timeout`, 30 minutes unless given | It pauses on its own after that long without activity; see Pausing it. `hangar update` changes it later |

The size and the disk are the platform's choice, not a flag. The result reports them as
`size` and `diskGb`.

Everyone who joins the session can read every variable in it. A personal key set here
is shared with the whole team; say so before setting one.

The name is stored in lower case and the name as typed becomes the display name. Use
`name` from the result in every later command. Variable values are never echoed back;
`envCount` says how many were set. A variable from `--env` wins over a group's, and
between groups the one given later wins. A group used only at build reaches nothing,
because a Hangar never builds, and the command says so on standard error.

### A repository on it

```bash
outplane repos --json --fields fullName,defaultBranch                        # what the user can pick
outplane hangar create myhangar --repo acme/web --branch main --dry-run --json
```

- **Cloned once,** on the first start, into the home directory under the repository's
  name: `acme/web` lands in `~/web`, and one named `go` or `bin` in `~/go-repo` or
  `~/bin-repo`. From then on the clone is the user's. Nothing clones or pulls it again,
  not a restart and not a resume.
- **A private repository** is read through the GitHub installation of the user whose
  credential this is, as for `app create`. `hangar.repository_unavailable` means the
  platform cannot see it or its branch: send the user to `outplane repos`, which names
  the page that grants access. Use `--public-repo` only for a repository that is public.
- **A failed clone is not tried again.** The Hangar is created and starts all the same,
  and its terminal says why the clone failed, with the `git clone` command to run by
  hand. `hangar get` reports which repository was chosen, not whether the clone worked,
  so do not report it as cloned from that.
- **Pushing is the user's to set up.** The platform only clones, and leaves no GitHub
  credential on the Hangar. To push, someone signs in to GitHub in the Hangar's terminal
  with `gh auth login`, or pastes into it a fine-grained token limited to that one
  repository, with Contents read and write. That sign in is kept on the Hangar's disk,
  so everyone who can open the Hangar, every agent included, pushes as that identity.
  Say so.

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
  Each Hangar picks up the change the next time it starts, at `hangar restart`, or at
  `hangar resume` when it is paused.

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
- `paused` outranks the rest: someone paused it, or its idle timeout did. See Pausing
  it.
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
format, and no flag adds them: `env list --hangar` is where they are.

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
   only while it is still starting. A `paused` one is refused the same way until
   `hangar resume` brings it back.
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

## Its variables and groups

```bash
outplane env list --hangar myhangar --json                      # values masked unless --reveal
outplane env set LOG_LEVEL=debug --hangar myhangar --dry-run --json
outplane env set LOG_LEVEL=debug --hangar myhangar --json
outplane env unset LOG_LEVEL --hangar myhangar --json
outplane env group assign ai-keys --hangar myhangar --json
outplane env group unassign ai-keys --hangar myhangar --json
```

These are the application's `env` commands with `--hangar` in place of `--app`, so the
rules are the ones `env set` follows: only the keys named change, and the keys the
platform reserves are refused before anything is sent. The result's `app` field holds the
Hangar's name. `unset` removes the Hangar's own variables only; a group's go with
`env group unassign --hangar`.

- **Saving changes nothing that is running.** A Hangar starts from its saved variables,
  groups and ports, so a change applies at its next `hangar restart`, or at
  `hangar resume` when it is paused. A change to a linked group, made with
  `env group set` or in the console, reaches it the same way. Say so when reporting the
  change.
- **`--restart` applies it now, and it is a restart.** It ends everything running in the
  terminal session, other people's agents included, so it is the user's call, as in
  Restarting it. On a paused Hangar it restarts nothing, and the change applies at
  resume.
- **`restarted: false` with exit `0` after `--restart`** means the change is saved and
  the restart was refused. The reason is on standard error, and `hangar restart` is the
  retry.
- **Everyone who joins the Hangar can read its variables.** For an agent's API key,
  prefer a group the user fills in, and do not ask for the key itself.

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
- **What applies:** it starts with the variables, groups and ports saved by then, so a
  change saved with `env ... --hangar` since it last started takes effect.
- **It is the user's call.** It ends other people's sessions and the agents they left
  running, and a Hangar is the team's, so somebody else may be working in it right now.
  Ask the user before restarting one, and say what it stops. For the Hangar you are
  running in, see below.
- **Poll until it is back, and stop.** `status` reads `deploying`, then `ready`; a
  `ready` in the first few seconds can still be the state from before the restart. Check
  every few seconds for a few minutes at most; if it is not `ready` by then, report what
  `status` says rather than restarting again.
- **Exit `6`, a conflict:** nothing is running to restart, as when it never started,
  or it is paused, when `hangar resume` is the way back. Retrying does not help.

The exact error codes are in `outplane schema hangar restart`.

## Pausing it

```bash
outplane hangar pause myhangar --json
outplane hangar resume myhangar --json
outplane hangar get myhangar --json --fields status    # after a resume, until ready
```

- **What stops:** the machine, with everything running in its terminal session, every
  agent included, and everyone connected is disconnected. Nothing answers on its ports.
- **What stays:** the files under `/home/hangar`, its ports and its variables.
- **Resuming** starts it on a new machine with the same disk, in under a minute, with
  the variables, groups and ports saved by then. What was running before the pause does
  not carry on. Poll `status` as after a restart.
- **While paused** it refuses `hangar connect` and `hangar restart` with exit `6`, and
  `hangar metrics` reports `null` CPU and memory. Resuming it is the way back.
- **Pausing is the user's call.** Like a restart, it ends other people's sessions and the
  agents they left running. Ask the user first, and say what it stops. For the Hangar
  you are running in, see below.
- **Exit `6`, a conflict:** it has no machine yet. While it is still starting for the
  first time `retryable` is true, so try again once it is `ready`; one that never
  started stays that way.

### Pausing on its own

A Hangar pauses on its own once nothing has happened in its terminal for its idle
timeout: no output in any window, from an agent, a build or a server's log, and no key
from anyone connected, in the console or the CLI. Traffic on its ports counts only if a
server prints it. The platform checks every 5 minutes, so a timeout of 30 minutes pauses
it between 30 and 35 minutes after the last activity.

```bash
outplane hangar get myhangar --json --fields idleTimeoutMinutes    # null for never
outplane hangar update myhangar --idle-timeout 2h --json
outplane hangar update myhangar --idle-timeout never --json
```

- **The choices** are 15 and 30 minutes, 1, 2, 6, 12 and 24 hours, and never; the
  spellings are in `outplane schema hangar update`. A new Hangar gets 30 minutes unless
  `--idle-timeout` says otherwise. A change applies from the next check and restarts
  nothing.
- **An agent at work keeps it awake**, because its output is activity. **An agent
  waiting on a person does not**: a question left unanswered for longer than the timeout
  lets the Hangar pause, and ends the agent with it.

## When you are running inside a Hangar

The agents in a Hangar read this skill too. Every shell in a Hangar has `HANGAR_NAME`
set to the Hangar's name; when it is set, you are inside that Hangar. Then:

- **Never connect to the Hangar you are in, and never hand the user that command to run
  from inside it.** A session joined from inside itself shows itself inside itself,
  without end. The user reaches it from their own terminal or from the console.
- **Deleting it deletes the machine this work is on.** The deletion is the user's to
  confirm in any case. Before relaying the command, say that the disk goes with it and
  that anything not committed and pushed is lost.
- **Never restart or pause the Hangar you are in without the user's explicit
  go-ahead**, `env ... --hangar --restart` included. Either ends this process along with everything else in the session, so
  nothing you run after it happens, the check that it came back included. Say so, and
  leave that check to the user. A paused one stays down until somebody resumes it from
  the console or a terminal of their own.
- **Waiting on the user counts as idle.** Before you stop to wait on an answer that may
  take longer than this Hangar's idle timeout, tell the user it pauses then and ends
  this session. A longer timeout is theirs to choose, not a way to keep yourself
  running.
- **Work that has to outlive the Hangar belongs in a repository.** The disk survives a
  restart, not a deletion.
- **If `git push` is refused for want of a credential**, nobody has signed in to GitHub
  on this Hangar yet. Ask the user to run `gh auth login` in one of its windows, a step
  for the person and not for you, and say that everyone who can open the Hangar then
  pushes as them. **Never ask for a GitHub token in the chat.**
- **Keep clones, builds and caches under the home directory.** Everything outside it,
  `/tmp` included, is temporary and capped, and going over the cap restarts the machine,
  which ends every program in the session, this one and other people's included.
  `https://docs.outplane.com/docs/console/hangars.md` has the sizes.
- **To let the user open a dev server you started**, it needs a public port on this
  Hangar, `outplane hangar port set "$HANGAR_NAME" <port>:http:public`, which anyone on
  the internet can open. Say so, bind the server to `0.0.0.0`, then give them that port's
  `url` from `ports` in the result. A private port is for the team's applications only.
- **If `outplane whoami` fails**, the CLI there has no credential. Ask the user to run
  `outplane login` in one of the Hangar's windows: there is no browser on a Hangar, so it
  prints a console link and reads a token they paste, a step for the person and not for
  you. Or ask them to add an API token as `OUTPLANE_TOKEN` on the Hangar's Environment
  tab in the console, which reaches this shell only after the Hangar restarts and so
  ends this session. **Never ask them to paste a token into the chat.** Either way,
  everyone who can open the Hangar can use that credential, with a team token's access;
  say so.

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

- **Changing its agents, its name or its repository after creation.** Deleting it and
  creating it again is the only way, and the disk does not carry over. Its variables and groups do change,
  with `env ... --hangar`, and so does its idle timeout, with `hangar update`.
- **Choosing its size or its disk.**
- **Cloning again, pulling or pushing through the platform.** After the one clone at the
  first start, the repository is `git` in the terminal, as on any machine.
- **A custom domain or an IP access profile on a Hangar's port.** A public port is open
  to everyone. To serve something behind either, deploy it as an application.
- **Logs or requests for a Hangar.** What it is using is `hangar metrics`; `logs`,
  `requests` and `metrics` do not reach one.

If `outplane schema hangar` lists a command for one of these, it arrived after this was
written. Use it.
