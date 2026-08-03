# In a pipeline

A runner is not a small terminal. There is no browser to open, no keychain to store a
token, and nobody to answer a prompt.

## Four rules cover almost all of it

**1. Do not sign in.** Set `OUTPLANE_TOKEN`. It outranks everything else and the token
names its own team, so nothing needs linking or selecting.

```bash
export OUTPLANE_TOKEN=***      # from the runner's secret store
```

Never pass it as `--token`: arguments appear in process lists and in most runners' logs.
Never run `outplane login`, `outplane link` or `outplane team use` in a pipeline; the
first needs a person and the other two write to the checkout or the machine.

**2. Pin the version.** A runner that installs the newest release on every run changes
behaviour without a commit.

```bash
OUTPLANE_VERSION=<tag> sh -c "$(curl -fsSL https://outplane.com/install.sh)"
```

**3. Ask for the format.** Output is JSON in a pipe already, but a step that sometimes
runs attached should say what it wants: `--json`, and `--fields` to narrow it.

**4. Branch on the exit status.** It is a contract, appended to and never reused.

```bash
outplane deploy create --wait --timeout 15m || case $? in
  7)   echo "plan limit reached"; exit 1 ;;
  124) echo "did not finish in time"; exit 1 ;;
  *)   exit 1 ;;
esac
```

## Deploying

`deploy create` returns as soon as the build is **queued**. A step that stops there is
reporting a success it has not seen.

| Form | Behaviour |
| --- | --- |
| `deploy create` | Returns immediately. The step passes while the build may still fail |
| `deploy create --wait` | Blocks until the deployment is final. Usually what a pipeline wants |
| `deploy create --follow` | Blocks and streams the build, so the runner's log holds it |

Both waiting forms take `--timeout` and exit `124` when it expires. The build keeps going
on the platform: a timeout is this side giving up, not a cancellation.

## A complete workflow

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      OUTPLANE_TOKEN: ${{ secrets.OUTPLANE_TOKEN }}
    steps:
      - uses: actions/checkout@v4

      - name: Install the CLI
        run: OUTPLANE_VERSION=<tag> sh -c "$(curl -fsSL https://outplane.com/install.sh)"

      # ... build and push your image here ...

      - name: Deploy and wait
        run: |
          outplane deploy create checkout \
            --image ghcr.io/acme/checkout:${{ github.sha }} \
            --follow --timeout 15m

      - name: Report where it landed
        run: outplane app get checkout --json --fields status,url
```

For an application the platform builds from a repository, send no image and the branch is
built again.

## What will not work

| Command | Why |
| --- | --- |
| `outplane login` | Needs a browser or a person to paste a token |
| `outplane link`, `outplane team use` | Write to the checkout or the machine |
| `outplane app shell` | Needs a real terminal at both ends. Exits `2` behind a pipe |
| Destructive commands | Never prompt. They stop with exit `4` |

## Destructive commands in a pipeline

They never prompt and never proceed on a flag alone. Without confirmation they exit `4`
and return the exact command in `confirm_command`.

That is deliberate: the approval belongs in the pipeline's own gate, an environment
protection rule or a manual step, rather than in a terminal nobody is watching. When a
job genuinely should delete something, spell it out:

```bash
outplane app delete preview-$PR --yes --confirm-name preview-$PR
```

## Configuration from a pipeline

Saving does not restart anything. Pass `--deploy` when the change should reach the
running application in the same step:

```bash
outplane env push .env.production --deploy
```

`env push` is not a synchronisation: a variable set on the application and missing from
the file is left alone. `env unset` removes one.

_Generated from `outplane schema`._
