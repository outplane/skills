# Deploy and build

Shipping code, watching a build, and changing how the image is made.

Full behaviour, limits and flag detail: `outplane schema deploy`, `outplane schema build`,
and `https://docs.outplane.com/docs/cli/deploy.md`.

<!-- gen:index deploy build -->
| Command | What it does | Traits |
| --- | --- | --- |
| `build get [flags]` | show how an application is built | read, repeatable |
| `build set [flags]` | change how an application is built | write, repeatable, --dry-run |
| `deploy create [APP] [flags]` | build and deploy an application | write, --dry-run, long-running, streams ndjson |
| `deploy list [APP] [flags]` | list recent deployments | read, repeatable |
| `deploy get <DEPLOYMENT> [APP]` | show one deployment | read, repeatable |
| `deploy logs <DEPLOYMENT> [flags]` | show the build output of one deployment | read, repeatable, long-running |
<!-- /gen -->

## Ship the current application

```bash
outplane deploy create --wait
```

That is the whole thing when a directory is linked. `--wait` blocks until the deployment
reaches a final state and the exit code carries the verdict, so nothing has to be
polled and nothing has to be believed.

Use `--follow` instead when the user should see the build happening; it streams the
build output as NDJSON, one object per line.

Without either flag the command returns as soon as the build is **queued**. That is not
a deploy. If it was run that way, finish the job:

```bash
outplane deploy get <deploymentId> --json --fields status
```

Poll that until `status` is final. Report only what it says.

## Ship a specific image

For an application that runs a prebuilt image:

```bash
outplane deploy create --image <registry>/<repo>:<tag> --wait
```

The image becomes the application's current image, so a later `deploy create` with no
`--image` runs that same one again. An application that builds from a repository refuses
`--image`; the platform builds its image and there is nothing to point at.

## When it fails

The build output is the first place to look, and it is a different thing from what the
running application prints:

```bash
outplane deploy logs <deploymentId>        # the build
outplane logs --follow                     # the running application
```

Two failure shapes to tell apart:

- **The build failed.** `deploy logs` ends with the compiler, the package manager or the
  image build. Fix the repository, then deploy again.
- **The build succeeded and the application will not start.** `deploy logs` looks clean;
  the reason is in `outplane logs`. Usually a missing environment variable or a start
  command that exits. See `operate.md`.

Build output lives with the build and is cleaned up eventually, so an old deployment may
have none left. That is reported, not treated as an empty build. A deployment of an
already-built image never had a build at all.

## There is no rollback and no cancel

Neither exists as a command, and neither is coming through a flag. What there is:

- **Going back** means deploying the previous image again. `outplane deploy list --json`
  shows what shipped; for an image-backed application, deploy that tag explicitly. Only
  the most recent tags are kept per repository, so an old one may be gone.
- **Stopping a running deployment** is not possible. It runs to a final state.

Never tell the user to roll back. Tell them what is deployable.

## Change how it builds

```bash
outplane build get --json                       # what it does today
outplane build set --start-command "node server.js" --deploy
```

`build set` writes the record and rebuilds nothing on its own. Without `--deploy` the
running application keeps the image it already has, and the change only appears after
the next **build**, which is a longer wait than a configuration change that only needs a
deployment.

A flag that is not given keeps its current value. The command reads the current settings
and sends them back with the change applied, so two callers changing different settings
at the same time can lose one of the changes.

Clearing rather than setting: an empty value removes the start command and either path
filter. The build directory cannot be emptied; `--dir /` is the repository root.

Path filters decide whether a push is worth building at all:

```bash
outplane build set --include-paths "apps/api/**" --include-paths "packages/shared/**" --deploy
```

A container-registry application refuses the build method, the directory and the
filters; a repository application refuses `--image`. Neither is sent, because the server
would ignore it silently.

## Composing

- **First deploy of a new application**: `app create` already deploys. See `manage.md`.
- **Configuration then ship**: `env set --deploy` does both in one call. Do not follow it
  with `deploy create`; that is a second deployment for nothing.
- **Build change then ship**: `build set --deploy`.
- **Verify afterwards**: `outplane app get --json --fields status,url`.

_Generated from `outplane schema` at CLI 0.1.1. Run `node scripts/gen-refs.mjs` after refreshing `cli-schema.json`._
