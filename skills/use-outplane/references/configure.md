# Environment variables and ports

What an application reads from its environment, and what it serves on.

**Do not answer a flag, a limit or an allowed value from memory.** Read it:

- `outplane schema env` lists every command in this group with its flags, types,
  allowed values, output fields and error codes. Local, no credential, generated from
  what the binary runs.
- `https://docs.outplane.com/docs/cli/env.md` has the product behaviour and the limits.
  Every documentation page is served as plain Markdown by appending `.md`, and
  `https://docs.outplane.com/llms.txt` says which page covers what.

When this file disagrees with either of them, they win.

## Saving is not deploying

This is the single most common mistake with both groups. `env set`, `env unset`,
`env push`, `port set` and `port unset` write the record and leave the running
application exactly as it was. The change reaches it at its next deployment.

Pass `--deploy` when it should take effect now:

```bash
outplane env set DATABASE_URL=postgres://... --deploy
```

If `--deploy` is deliberately not passed, say so in the answer: *"saved; it reaches the
running app on its next deploy."* Do not let the user believe it is live.

Two things in this area are different and do **not** need a deployment: `app scale`, and
anything in `network.md`.

## Variables

```bash
outplane env list --json                  # values masked
outplane env list --reveal --json         # values shown
outplane env set KEY=value OTHER=value    # only these keys are touched
outplane env unset KEY                    # all the named keys, or none of them
```

`env list` masks values in every format including JSON; check the `revealed` field
before treating a value as a credential. It lists what is set **on the application**;
what arrives through a shared group is not included, and `env group get` has that.

Only the keys you name are changed, so nothing you did not mention can be lost. A value
may contain `=`: only the first one splits the pair, so `KEY=a=b` sets `KEY` to `a=b`.

`env unset` is all or nothing. One name that is not set stops the whole command and
removes nothing, including the names that were valid.

Reserved keys are refused before any request. `PORT` is **not** reserved and may be set.
The current list is in `outplane schema env set` and on the documentation page.

## One value, into a variable

```bash
TOKEN=$(outplane env get API_TOKEN)
```

`env get` prints a bare value in every format, unlike almost everything else, so command
substitution captures the value rather than an object. When it fails it writes a
sentence to standard error and leaves standard output empty, which is what keeps an
error message out of the variable. A missing key exits `5` and the error lists the keys
that do exist, so there is no need to list first.

## Files

```bash
outplane env pull .env            # write them out
outplane env push .env --deploy   # send them back
```

They are a matched pair: what comes out reads back in unchanged, including values with
newlines, quotes or leading spaces. The file is written with owner-only permissions and
replaced atomically, and the values never appear in the command's own output.

Two things to be clear about:

- **`push` is not a synchronisation.** A key set on the application and missing from the
  file is left alone. Removing one is `env unset`.
- **An existing file stops `pull`** with exit `6` rather than being overwritten.
  `--force` replaces it.

Only keys that are new or whose value differs are sent. When everything already matched,
`sent` is `false` and the exit code is `0`. That is a success.

## Running something locally with the deployed configuration

```bash
outplane env run -- npm run migrate
outplane env run --pure -- ./script.sh
```

Everything after `--` belongs to the program, including its exit code, which becomes
this command's own. So a program exiting `2` here is the program's `2`, not a usage
error. There is no shell: no expansion, no globbing, no pipelines. Use `-- sh -c "..."`
when shell syntax is needed.

## Shared groups

A group holds variables once and several applications use it. Creating one reaches
nothing until it is assigned, and a change reaches an application at its **next
deployment**; nothing in this group deploys anything.

```bash
outplane env group create shared --var LOG_LEVEL=info
outplane env group assign shared --app checkout
outplane env group get shared --apps       # who is waiting for a deployment
```

`env group set` replaces the whole group, so the command sends every variable back on
every call. Two people editing the same group at the same time overwrite each other and
nothing detects it.

A group that is assigned to something cannot be deleted. `env group get --apps` lists
what still uses it.

## Ports

```bash
outplane port list --json
outplane port set 3000:http:public --deploy
outplane port set 3000::private --deploy      # change only the visibility
outplane port unset 3000 --deploy
```

The format is `PORT[:SCHEME[:public|private]]` and **a part left out keeps what the port
already had**. So `port set 3000` on an already-public port does not make it private;
`3000::private` does. On a port that is not open yet, an omitted part takes the
create-time default, which is a private HTTP port.

Three things worth knowing:

- **A private port has no public address.** It is reachable inside the platform and by a
  custom domain. `url` is `null` and that is not an error.
- **The platform stores the ports as one set**, so this command reads them and sends
  them back with the change applied. Two callers changing different ports at the same
  moment can lose one of the changes. `env set` does not have this problem.
- **An empty port list means nothing can reach the application**, however healthy its
  last deployment looks. Check this first when an application answers nothing.

`portId` from `port list` is what a custom domain attaches to; the port number is not
enough. Closing a port leaves any custom domain on it pointing at nothing, so read
`domain list` afterwards.
