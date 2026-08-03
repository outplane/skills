# Failures

What the CLI returns when something goes wrong, and what to do with it.

## Branch on this, never on the message

Every failure arrives as one object, on standard output, in a structured format:

```json
{
  "error": {
    "kind": "not_found",
    "code": "app.not_found",
    "message": "No application called checkout in this team.",
    "hint": "The name is the permanent one, not the display name.",
    "next_steps": [
      { "why": "list the applications in this team", "argv": ["outplane", "app", "list"] }
    ],
    "retryable": false
  }
}
```

`kind`, `code` and the exit status are frozen once shipped and only ever added to.
**`message` is prose and changes with any release.** Never match on it.

`next_steps` carries `argv` rather than a string, so a suggestion can be executed
directly with no shell parsing and no quoting bug turning it into a different command.

Other fields that appear when they apply: `retry_after` in seconds, `confirm_command` on
a confirmation, `details` with structured context such as the fields that failed
validation, `request_id` for support, and `docs_url`.

## Exit codes

| Exit | Kind | Worth retrying | Meaning |
| --- | --- | --- | --- |
| `0` | | no | The command did what it said. |
| `1` | `internal` | no | An unexpected failure in the CLI itself. |
| `2` | `usage` | no | Invalid arguments, unknown flag, or client-side validation failure. |
| `3` | `auth` | no | Not authenticated, token revoked or expired, or forbidden for this team. |
| `4` | `confirmation_required` | no | A destructive operation stopped. Replay the command in confirm_command. |
| `5` | `not_found` | no | The named resource does not exist, or is not visible to this credential. |
| `6` | `conflict` | no | The resource already exists, or a concurrent change won. |
| `7` | `quota` | no | Plan limit reached or payment required. Not a rate limit; retrying will not help. |
| `8` | `upstream` | yes | The Out Plane API returned a server error. |
| `9` | `upgrade_required` | no | This release of the CLI is too old for the API. Updating is the only fix. |
| `124` | `timeout` | yes | A client-side deadline expired. The server operation may still be running. |
| `130` | `interrupted` | no | Cancelled by the user. |

Three of these change what an agent should do next:

- **`4` is not a failure.** A destructive command stopped and handed back the exact
  command that would proceed. Relay it. Do not retry, and do not report it as an error.
- **`8` and `124` are worth retrying**, and nothing else is. `7` in particular is a plan
  limit rather than rate limiting; retrying it never helps.
- **`9` has one remedy**: `outplane update`.

## When a command fails, in order

1. Read `kind`. It says which of eleven classes this is.
2. Read `code` if you need to distinguish two failures within a class.
3. Follow `next_steps` if there are any; they are runnable.
4. Only then read `message`, and only to relay it to the user.

## Codes by command

Every command publishes the codes it can raise, so a handler can be written before
the failure is ever seen. They change as commands change, so read them rather than
recalling them:

```bash
outplane schema app delete | jq -r '.commands[0].error_codes[]'
outplane schema | jq -r '.commands[] | "\(.name): \(.error_codes // [] | join(", "))"'
```

The global flags are in the same place, under `global_args`.

