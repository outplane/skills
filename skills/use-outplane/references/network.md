# Domains and IP access

Giving an application an address, and restricting who can reach it.

**Do not answer a flag, a limit or an allowed value from memory.** Read it:

- `outplane schema domain` lists every command in this group with its flags, types,
  allowed values, output fields and error codes. Local, no credential, generated from
  what the binary runs.
- `https://docs.outplane.com/docs/cli/domain.md` has the product behaviour and the limits.
  Every documentation page is served as plain Markdown by appending `.md`, and
  `https://docs.outplane.com/llms.txt` says which page covers what.

When this file disagrees with either of them, they win.

## Both take effect immediately

Unlike variables, ports and volumes, nothing here waits for a deployment. A domain
change reaches the edge within seconds and an IP profile applies the moment the request
returns. There is no `--deploy` flag in this group and none is needed.

## Adding a domain

```bash
outplane domain dns app.example.com          # what record is needed. No credential, no network
outplane domain add app.example.com --app checkout
outplane domain list --json
```

`domain dns` is worked out locally, so it answers before the domain is registered and
without signing in. A subdomain gets a CNAME; an apex gets an A record, because a zone
cannot carry a CNAME at its root.

**Registering does not make it work.** DNS has to point at the record that `domain dns`
prints. The certificate is issued on its own once it resolves, and there is nothing to
renew and nothing else to configure.

A host and a path together identify a route, so the same host with a different path is a
second route and is allowed. An application that has never deployed successfully cannot
take a domain, and neither can a TCP port.

## Moving, parking, giving up

| Goal | Command | Effect |
| --- | --- | --- |
| Send it somewhere else | `domain point <host> --app <app>` | Keeps the certificate, no gap in service |
| Take it out of service, keep it | `domain unpoint <host>` | Traffic stops at once, registration and certificate stay |
| Give it up entirely | `domain remove <host>` | Destructive. Registration and certificate go |

Moving is `point`, not a removal followed by an addition: the route keeps its
certificate and there is no moment where it answers nothing.

`unpoint` is also the command that has to run before an application carrying a domain
can be deleted. When `app delete` is refused, this is usually why.

A host carrying more than one route is ambiguous without `--path`, and the error lists
the paths rather than choosing one.

## Restricting who can reach an application

```bash
outplane ip-profile create office --rule 203.0.113.0/24=head-office
outplane ip-profile assign office --app checkout
outplane ip-profile get office --json
```

Every rule **allows**. Profiles add up: an address permitted by any profile attached to
the application gets through. Attaching one therefore narrows access to the union of the
attached profiles, and detaching the last one opens it again.

Three traps:

- **A profile with no rules allows nothing.** Attached to an application, it makes that
  application reachable from nowhere. The request is not refused and the result reports
  zero rules. This is almost never what was intended.
- **`ip-profile set --rule` replaces the entire list.** Sending one rule to a profile
  that had four leaves it with one. Read the profile first and send every rule it should
  end up with.
- **A bare address is refused.** A prefix length is required, because guessing how much
  of a network to admit is not something the CLI will do for you.

A profile cannot be deleted while anything still uses it, so `ip-profile unassign` runs
first; `ip-profile get` lists what is still attached.

## When an application is unreachable

Work down this list, cheapest first:

1. `outplane port list --json` — an empty list, or no public port, reaches nothing.
2. `outplane ip-profile list --json` — if the team uses profiles, check whether one is
   attached and whether the caller's address is in it.
3. `outplane domain list --app <app> --json` — a route with a null application points
   nowhere; a closed port leaves exactly that behind.
4. `outplane app get --json --fields status,url` — a paused application answers nothing.
5. Only then look at logs and requests. See `operate.md`.
