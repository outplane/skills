# Databases and disks

Managed PostgreSQL, and storage that survives a deployment.

Flag detail: `outplane schema db`, `outplane schema volume`. Behaviour, regions,
versions and limits: `https://docs.outplane.com/docs/cli/db.md` and
`https://docs.outplane.com/docs/cli/volume.md`.

<!-- gen:index db volume -->
| Command | What it does | Traits |
| --- | --- | --- |
| `db list` | list the team's managed databases | read, repeatable |
| `db get <DATABASE>` | show one database and what is inside it | read, repeatable |
| `db url <DATABASE> [flags]` | print a connection string | read, repeatable |
| `db create <NAME> [flags]` | provision a managed PostgreSQL database | write, --dry-run |
| `db delete <DATABASE> [flags]` | permanently destroy a database | destructive, --dry-run |
| `db role list <DATABASE>` | list the logins a database accepts | read, repeatable |
| `db role create <DATABASE> <ROLE>` | add a login to a database | write, --dry-run |
| `db role delete <DATABASE> <ROLE> [flags]` | remove a login | destructive, --dry-run |
| `db database list <DATABASE>` | list the databases inside a managed instance | read, repeatable |
| `db database create <DATABASE> <NAME> [flags]` | add a database inside a managed instance | write, --dry-run |
| `db database delete <DATABASE> <NAME> [flags]` | destroy a database inside an instance | destructive, --dry-run |
| `volume list [flags]` | list the team's disks | read, repeatable |
| `volume get <VOLUME>` | show one disk | read, repeatable |
| `volume create <NAME> [flags]` | create a disk, and optionally mount it | write, --dry-run |
| `volume attach <VOLUME> [flags]` | mount a disk on an application | write, repeatable, --dry-run |
| `volume detach <VOLUME> [flags]` | unmount a disk, keeping it and its contents | write, repeatable, --dry-run |
| `volume delete <VOLUME> [flags]` | permanently destroy a disk and its contents | destructive, --dry-run |
<!-- /gen -->

## Only PostgreSQL is managed

Anything else a project needs is run as an ordinary application with a disk attached,
and it does not appear under `db`. Do not offer a managed engine that is not there;
`outplane schema db create` enumerates what can actually be provisioned.

## Creating a database

```bash
outplane db create orders --region <region>
outplane db get orders --json --fields status      # poll until active
```

Two things decide whether this goes well:

- **The region is required and permanent.** There is no default because it cannot be
  changed afterwards, and moving the data later is a manual job. If the user has not
  said where, ask.
- **The command returns before the database is ready.** Connecting sooner fails. Poll
  `db get` until the status says active, then continue.

Exceeding the plan's allowance is exit `7`, not a validation error, and retrying will
not help.

## Getting a connection string

```bash
DATABASE_URL=$(outplane db url orders)
outplane env set DATABASE_URL="$DATABASE_URL" --app checkout --deploy
```

`db url` prints a bare string in every format, so command substitution works. It is the
only command that returns a password, and asking for it is the request to see it: it is
not masked and it appears nowhere else.

While the instance holds exactly one role and one database, neither has to be named.
With a choice, the command refuses and lists them rather than picking one.

## Roles and databases inside an instance

Two levels share the word *database*: the managed instance, and the databases inside it.

```bash
outplane db role create orders checkout        # a login
outplane db database create orders checkout --owner checkout
outplane db url orders --role checkout --database checkout
```

A role's password is generated and never returned by the command that creates it. It
reaches you inside the connection string and nowhere else, so read it there.

The owner of a new database must already exist. With exactly one role the owner is
filled in; with several it has to be named, because choosing an owner is choosing who
can read the data.

## Deleting

`db delete`, `db role delete` and `db database delete` are destructive and stop with
exit `4` as described in the skill. Two consequences worth stating to the user before
they confirm:

- **There is no snapshot and no retention window.** Take a dump first if the data
  matters.
- **Nothing updates the applications holding a connection string.** They keep it and
  fail on their next connection.

## Disks

```bash
outplane volume create data --size <gb> --app checkout --mount /data
outplane volume list --json
```

The mount reaches the running application at its **next deployment**, not immediately.

Creating and attaching in one call is two steps on the server: the disk is made first,
then mounted. If the mount fails the disk exists and is detached, so **attach it** rather
than running `volume create` again, which would make a second disk.

Four constraints that produce most of the errors here:

- The size is fixed at creation. There is no resize; a bigger disk means a new one and a
  copy.
- Moving a disk to a different path on the same application is refused. Detach, then
  attach at the new path.
- Two disks cannot share a mount path on one application.
- **Detaching is not deleting.** The disk keeps its contents and its cost until it is
  destroyed, and `volume delete` refuses while it is attached.

Names are not unique. Every command also accepts an id, and the id is what to store.

_Generated from `outplane schema` at CLI 0.1.1. Run `node scripts/gen-refs.mjs` after refreshing `cli-schema.json`._
