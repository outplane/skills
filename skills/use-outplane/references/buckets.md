# Buckets

S3 compatible storage for an application's files, and the keys that open it.

**Do not answer a flag, a limit or an allowed value from memory.** Read it:

- `outplane schema bucket` lists every command in this group with its flags, types,
  allowed values, output fields and error codes. Local, no credential, generated from
  what the binary runs.
- `https://docs.outplane.com/docs/cli/bucket.md` has the product behaviour and the limits,
  and `https://docs.outplane.com/docs/console/buckets.md` how an S3 client connects.
  Every documentation page is served as plain Markdown by appending `.md`, and
  `https://docs.outplane.com/llms.txt` says which page covers what.

When this file disagrees with either of them, they win.

If `outplane schema bucket` exits `2` because it does not know the command, the
installed CLI is older than buckets. `outplane update` is the fix.

## A bucket, a volume or a database

A bucket holds **files** that every instance, and any S3 client with a key, reaches over
the network. A volume is a **disk** mounted into one application, which then runs a
single instance.

| The user wants | Use |
| --- | --- |
| Somewhere for an application to keep uploads, exports or generated files | A bucket |
| The same files from every instance, or from outside the platform | A bucket |
| Files served to browsers by link | A public bucket |
| Software that expects a directory on disk, such as a database it runs itself | A volume, `data.md` |
| Rows, queries and transactions | Managed PostgreSQL, `data.md` |

What a bucket is:

- It belongs to the team, not to an application. Nothing attaches it, and creating or
  changing one involves no deployment.
- It is reached with an S3 client and an access key. A key opens that one bucket and no
  other, with the permission chosen when it was made.
- It is private unless it says otherwise: only requests signed with a key read it.
- Listing stays off even when it is public. A public bucket serves a file to anyone who
  has its link, never a list of what is in it.

A `bucket` command that acts on one bucket takes its name or its id, never its
`bucketName`.

## Creating

```bash
outplane bucket create uploads --dry-run --json    # checks the name, sends nothing
outplane bucket create uploads --json
```

- **The name is permanent.** No command renames a bucket. It is unique in the team, and
  the rules for it are in `outplane schema bucket create`.
- **Private unless `--public` is given.** Make it public only when the user asked for
  files served by link; see Going public, or private.
- **A new bucket has no key.** No client reaches it until somebody makes one; see Giving
  an application access.
- **Its address takes a few minutes to start working**, for S3 clients and public links
  alike. A TLS error right after creating it means it is not ready yet. Wait a few
  minutes and try again, rather than changing the client or creating it again.

A create that timed out can still finish on the server. `bucket list` says whether it
did, and running create again after one that finished is refused as taken.

## What an S3 client needs

```bash
outplane bucket get uploads --json --fields bucketName,endpoint,region
```

- **`bucketName`, not `name`.** `name` is what `bucket` commands take. The name an S3
  client needs carries a suffix, so it differs, and a client given `name` reaches
  nothing.
- **`endpoint` and `region` come from the result.** Take them from there, not from
  memory or from another provider's defaults. The console shows the region as Global;
  clients sign with the value in `region`.
- **Virtual-hosted addressing only.** The bucket goes in the host, and path-style
  requests fail. Some S3 clients switch to path-style when given a custom endpoint, or
  have a setting that forces it. **Before deploying an application that uses a bucket,
  read how its S3 client is set up** and make sure nothing forces path-style. A
  connection error on the endpoint's host, or a 404 on a file that exists, usually means
  path-style.

## Giving an application access

A client needs an access key: an id and a secret. **Do not run `bucket key create`
yourself.** It prints the secret on standard output, once, in every format, so the
secret stays in the record of whatever ran it, and for you that record is the
transcript. Nothing can read the secret again afterwards.

Hand the user the command to run in a terminal of their own:

```bash
outplane bucket key create <bucket> <name> --permission <permission>    # for the user
```

Choose the permission with the user, and the narrowest one the application needs; the
choices are in `outplane schema bucket key create`. Tell them the secret is shown this
once. The console's Access tab on the bucket creates a key too, and shows its values as
a block ready for a `.env` file.

The values then reach the application through a file, never through the chat, and not
on a command line, where the shell's history keeps them:

1. The user puts the endpoint, the region, the access key id, the secret and the bucket
   name in a local file, under the names the application's S3 client reads. The
   console's block has them, and `https://docs.outplane.com/docs/console/buckets.md`
   lists the names. Keep that file out of version control.
2. The user previews it with `outplane env push <file> --app <app> --dry-run`, which
   names what is new and what would change, and sends nothing. A variable reported as
   changed already exists on the application, and pushing replaces it.
3. The user applies it with `outplane env push <file> --app <app> --deploy`.

**Never ask for the secret in the chat, and do not read it back by any route:** not the
file that holds it, not `env get` on its variable, not `env pull`, and not `--reveal`.
To check that the variables arrived, `outplane env list --app <app> --json` shows their
names with the values masked.

`env push` is for applications only. For a Hangar, the user adds the same values on the
Hangar's Environment tab in the console, or with `env set --hangar` in their own
terminal, which leaves them in its history. They apply at its next start, and
`--restart` applies them now, which ends its terminal session; see `hangars.md`.

If the user's `bucket key create` timed out or lost its connection, a key can exist
whose secret nobody saw. `retryable` is false, because running it again makes another
key. `bucket key list` shows what exists; delete the key nobody has the secret of, which
is the user's to confirm, and hand them the create again.

```bash
outplane bucket key list uploads --json --fields name,accessKeyId,permission
```

No secret appears here or anywhere else. Key names are not unique: `accessKeyId` is
what to store, and what to delete by.

## Replacing a key

There is no rotation. To replace a key:

1. The user creates a new key, as above, and pushes its values to every application
   that used the old one, with `--deploy`.
2. Once they run on the new key, delete the old one by its `accessKeyId`.
   `outplane bucket key delete <bucket> <accessKeyId>` stops with exit `4`. Relay
   `confirm_command` and stop.

- **The old secret can keep working for some minutes after the delete.** The notes in
  `outplane schema bucket key delete` say how long.
- **Applications holding the old key are not updated.** They fail once it stops working.
- **If the secret leaked, delete it first.** It stays open until it is deleted. The
  applications using it fail until they have the new key.

## Going public, or private

```bash
outplane bucket update uploads --public --dry-run --json
outplane bucket update uploads --private --json
```

- **Public means anyone with a file's link can read it**, every file already in the
  bucket included. A file's link is the bucket's `url` followed by the file's path.
  Listing stays off.
- **Only when the user asked for it.** No confirmation and no gate stops `--public`
  under an agent harness, so the decision is the user's. Say what it exposes when you
  make the change.
- **A change takes a few minutes to reach every request.** Until then some requests see
  the old setting, and a connection already open can keep it longer. After going
  private, `url` can keep serving files for some minutes. If a file is sensitive, keep
  the bucket private from the start.
- **`changed: true` means accepted, not applied.** `public` is the setting last
  accepted, not what every request sees yet. Running the same change again sends nothing
  and exits `0` with `changed: false`.
- **No deployment is involved**, and none makes it faster.

## Refusals only the server makes

Everything else is checked before anything is sent, so an error names the field.

- **Exit `6`, a conflict,** on `bucket create`: the team already has a bucket with that
  name, which includes the one a timed out create made.
- **Exit `6` on the user's `bucket key create`** is `bucket.key_conflict`: the server
  refused the key's name, not the bucket's. Another key name is the fix.
- **Exit `7`, a quota, has two causes**, and the error's code says which. A team can
  have a fixed number of buckets, the same on every plan, and this one has them all.
  Retrying never helps and a plan change does not either, so do not send the user to
  billing. Deleting one makes room. The other cause is a team without an active
  subscription, which also refuses a new key and going public; billing is in the
  console. Going private never needs one.

The exact error codes are in `outplane schema bucket`.

## Deleting

```bash
outplane bucket delete uploads --dry-run --json    # which bucket the name reaches
outplane bucket delete uploads                     # stops with exit 4
```

Destructive: it stops with exit `4` and hands back the exact command, as the skill
describes. Under an agent harness it stops whatever else it is given; `--dry-run` still
runs. Relay `confirm_command` and stop. Before confirming, tell the user:

- **There is no undelete, no snapshot and no retention window.** Every file and every
  key goes with the bucket.
- **Applications holding a key are not updated.** Move them off first, or they fail.
- **It leaves `bucket list` at once**, while the deletion finishes in the background, so
  its files and keys can keep answering for some minutes.

`bucket key delete` stops the same way; see Replacing a key.

## What does not exist

None of these is a command. Do not offer them.

- **Rotating a key.** Replacing one is a new key, then deleting the old one.
- **Reading a secret again.** A lost secret means a new key.
- **Files.** No command uploads, lists, downloads or deletes a bucket's files. That is
  the job of an S3 client holding a key.
- **Renaming a bucket, or choosing its region.**
- **How much it holds.** No command reports a bucket's size or how many files it has.
- **Path-style addressing.**

If `outplane schema bucket` lists a command for one of these, it arrived after this was
written. Use it.
