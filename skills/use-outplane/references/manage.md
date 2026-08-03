# Creating and managing applications

Making an application, looking at it, renaming it, removing it, and the credentials it

**Do not answer a flag, a limit or an allowed value from memory.** Read it:

- `outplane schema app` lists every command in this group with its flags, types,
  allowed values, output fields and error codes. Local, no credential, generated from
  what the binary runs.
- `https://docs.outplane.com/docs/cli/app.md` has the product behaviour and the limits.
  Every documentation page is served as plain Markdown by appending `.md`, and
  `https://docs.outplane.com/llms.txt` says which page covers what.

When this file disagrees with either of them, they win.

## Creating

`app create` creates **and deploys** in one call. Everything an application needs can be
set here, so nothing has to be filled in afterwards:

```bash
# From a repository
outplane app create checkout --repo acme/checkout --branch main \
  --port 3000:http:public --env NODE_ENV=production

# From a prebuilt image
outplane app create checkout --image <registry>/<repo>:<tag> --port 8080:http:public
```

Decide these before running it:

| Question | Flag | Why it matters now |
| --- | --- | --- |
| Repository or image? | `--repo` + `--branch`, or `--image` | Mutually exclusive. Passing both is an error, not a preference |
| What is it called? | the positional name | **Permanent.** It appears in the address and nothing renames it |
| What does it serve? | `--port` | Without a public port nothing outside can reach it |
| Is the repository private? | `--public-repo` when it is not | A private repository is read through the token owner's own connection |

The name is the one decision that cannot be revised. `app rename` changes only the label
the console shows; the name in the address is fixed at creation.

`--port` is repeatable and takes `PORT[:SCHEME[:public|private]]`. A port is **private**
unless it says `public`. `--env` is repeatable and its values are never echoed back; the
result reports how many were set.

Everything the server would refuse is checked before anything is sent, so an error names
the field. The two exceptions are the plan limit and the name already being taken, which
only the server knows.

`--volume` and `--env-group` take ids of things that already exist, and attaching is best
effort: one that cannot be attached is skipped and the creation still succeeds. Confirm
with `app get` when it matters.

**Creating deploys.** The `deploymentId` in the result is a queued build, not a finished
one. Follow it as `deploy.md` describes.

## Looking at one

```bash
outplane app list --json                              # the inventory
outplane app get --json --fields status,url,instances # one, in detail
```

`app list` reports configuration and has no address in it, because a public address needs
a per-application request. `app get` has `url` and `endpoints`.

`url` is the first address the application answers on. An application with several ports
has one `url` and several `endpoints`, so read `endpoints` when the port matters.

`repository` and `imageRef` are mutually exclusive; `source` says which to expect.
Environment variables are never included, in any format, and no flag adds them.

## Renaming

```bash
outplane app rename "Checkout Service" --app checkout
```

The label only. The address does not change and cannot. There is no way to remove a
display name; setting it to the application's own name is the closest thing.

## Deleting

Destructive: it stops with exit `4` and hands back the exact command, as the skill
describes. Before confirming, tell the user two things:

- **There is no undelete and no retention window.**
- **Some things block a deletion rather than being removed with it**, a custom domain and
  an attached volume among them. The server owns that list and its refusal names the
  rule. `domain unpoint` and `volume detach` are the usual unblockers.

`--confirm-name` is matched against the permanent name, not the display name.

## Private images

```bash
outplane registry create ghcr --server ghcr.io --username <user> --password-stdin < token.txt
outplane registry list --json
```

Prefer `--password-stdin`: an argument is visible in process lists and in most pipeline
logs. It reads standard input and strips one trailing newline, which is what `echo` adds,
and nothing else, because a password may legitimately begin or end with a space.

Nothing binds a credential to an application. The platform picks one by matching the
registry the image comes from. A credential added now is used by the **next** deployment;
an application already running keeps pulling with whatever it had, which is also why
deleting one breaks nothing until the next pull.

No password is ever returned, by this or any other command. A credential is replaced,
not inspected.
