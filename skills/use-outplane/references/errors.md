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

<!-- gen:exit-codes -->
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
<!-- /gen -->

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

Every command publishes the codes it can raise, so a handler can be written before the
failure is ever seen. `outplane schema <command>` has the list for one command; this is
all of them.

<!-- gen:errors app deploy build env port domain volume db ip-profile registry logs requests metrics team link login api update repos status whoami -->
| Command | Codes |
| --- | --- |
| `app list` | `context.no_team`, `auth.token_invalid` |
| `app get` | `app.not_found`, `app.ambiguous`, `context.no_app`, `usage.empty_argument`, `context.no_team` |
| `app create` | `app.name_invalid`, `app.name_reserved`, `app.source_required`, `app.source_conflict`, `app.repository_invalid`, `app.branch_required`, `app.size_invalid`, `app.instances_invalid`, `app.port_invalid`, `app.port_duplicate`, `app.repository_unavailable`, `app.mount_invalid`, `app.mount_duplicate`, `usage.bad_mount`, `usage.bad_port`, `usage.bad_assignment`, `quota.limit_reached` |
| `app scale` | `app.instances_invalid`, `app.size_invalid`, `usage.missing_argument`, `quota.limit_reached`, `app.not_found`, `context.no_app` |
| `app pause` | `app.not_found`, `context.no_app` |
| `app resume` | `app.not_found`, `context.no_app` |
| `app instances` | `app.not_found`, `context.no_app` |
| `app delete` | `confirmation.required`, `app.confirm_name_mismatch`, `app.delete_blocked`, `app.not_found`, `usage.empty_argument` |
| `login` | `auth.loopback_unavailable`, `auth.loopback_timeout`, `auth.token_malformed`, `auth.token_pre_slug` |
| `whoami` | `auth.not_authenticated`, `auth.team_not_signed_in` |
| `build get` | `context.no_app`, `app.not_found` |
| `build set` | `build.method_invalid`, `build.directory_required`, `build.image_required`, `build.filter_too_long`, `build.not_built_here`, `build.not_an_image`, `usage.no_change`, `context.no_app`, `app.not_found` |
| `app rename` | `app.display_name_required`, `app.display_name_invalid`, `usage.missing_argument`, `context.no_app`, `app.not_found` |
| `db list` | `context.no_team` |
| `db get` | `db.not_found`, `db.ambiguous`, `usage.missing_argument` |
| `db url` | `db.not_found`, `db.role_required`, `db.database_required`, `usage.missing_argument` |
| `db create` | `db.name_required`, `db.name_invalid`, `db.region_required`, `db.region_invalid`, `db.version_invalid`, `quota.limit_reached` |
| `db delete` | `confirmation.required`, `db.confirm_name_mismatch`, `db.not_found` |
| `db role list` | `db.not_found`, `usage.missing_argument` |
| `db role create` | `db.not_found`, `usage.missing_argument` |
| `db role delete` | `confirmation.required`, `db.confirm_name_mismatch`, `db.not_found`, `usage.missing_argument` |
| `db database list` | `db.not_found`, `usage.missing_argument` |
| `db database create` | `db.not_found`, `db.owner_required`, `usage.missing_argument` |
| `db database delete` | `confirmation.required`, `db.confirm_name_mismatch`, `db.not_found`, `usage.missing_argument` |
| `deploy create` | `deploy.image_on_git_app`, `deploy.failed`, `deploy.timeout`, `app.not_found`, `app.ambiguous`, `context.no_app`, `usage.empty_argument`, `quota.limit_reached` |
| `deploy list` | `app.not_found`, `usage.bad_limit`, `context.no_team` |
| `deploy get` | `usage.bad_deployment_id`, `usage.missing_argument`, `app.not_found`, `context.no_app` |
| `deploy logs` | `deploy.no_build`, `deploy.logs_gone`, `app.not_found` |
| `domain list` | `app.not_found`, `context.no_team` |
| `domain dns` | `domain.host_invalid`, `usage.missing_argument` |
| `domain add` | `domain.host_required`, `domain.host_invalid`, `domain.path_invalid`, `domain.path_reserved`, `domain.app_required`, `domain.port_not_found`, `domain.no_ports`, `quota.limit_reached`, `app.not_found` |
| `domain point` | `domain.not_found`, `domain.ambiguous`, `domain.port_not_found`, `domain.no_ports`, `app.not_found`, `usage.missing_argument` |
| `domain unpoint` | `domain.not_found`, `domain.ambiguous`, `usage.missing_argument` |
| `domain remove` | `confirmation.required`, `domain.confirm_name_mismatch`, `domain.not_found`, `domain.ambiguous` |
| `env list` | `context.no_app`, `app.not_found` |
| `env get` | `env.not_found`, `context.no_app`, `app.not_found`, `usage.missing_argument` |
| `env set` | `usage.bad_assignment`, `usage.duplicate_key`, `env.reserved_key`, `env.reserved_prefix`, `env.key_too_long`, `env.value_too_long`, `env.too_many`, `context.no_app`, `app.not_found` |
| `env unset` | `env.not_found`, `context.no_app`, `app.not_found`, `usage.missing_argument` |
| `env pull` | `env.file_exists`, `env.file_unwritable`, `env.file_unreadable`, `env.file_invalid`, `context.no_app`, `app.not_found` |
| `env push` | `env.file_not_found`, `env.file_invalid`, `env.file_unreadable`, `env.reserved_key`, `env.reserved_prefix`, `env.key_too_long`, `env.value_too_long`, `env.too_many`, `context.no_app`, `app.not_found` |
| `env run` | `env.command_not_found`, `env.command_not_executable`, `env.run_failed`, `usage.missing_argument`, `context.no_app`, `app.not_found` |
| `env group list` | `context.no_team` |
| `env group get` | `envgroup.not_found`, `envgroup.ambiguous`, `usage.missing_argument` |
| `env group create` | `envgroup.name_required`, `envgroup.name_invalid`, `envgroup.scope_empty`, `usage.bad_assignment`, `env.reserved_key`, `env.reserved_prefix`, `env.value_too_long` |
| `env group set` | `envgroup.not_found`, `envgroup.scope_empty`, `env.not_found`, `usage.bad_assignment`, `usage.missing_argument` |
| `env group assign` | `envgroup.not_found`, `app.not_found`, `context.no_app` |
| `env group unassign` | `envgroup.not_found`, `app.not_found`, `context.no_app` |
| `env group delete` | `confirmation.required`, `envgroup.confirm_name_mismatch`, `envgroup.not_found`, `envgroup.in_use` |
| `ip-profile list` | `context.no_team` |
| `ip-profile get` | `ipprofile.not_found`, `usage.missing_argument`, `context.no_team` |
| `ip-profile create` | `ipprofile.name_required`, `ipprofile.name_invalid`, `ipprofile.description_invalid`, `ipprofile.cidr_required`, `ipprofile.cidr_invalid`, `ipprofile.rule_duplicate`, `usage.missing_argument`, `context.no_team` |
| `ip-profile set` | `ipprofile.not_found`, `ipprofile.name_invalid`, `ipprofile.description_invalid`, `ipprofile.cidr_invalid`, `ipprofile.rule_duplicate`, `usage.no_change`, `usage.missing_argument`, `context.no_team` |
| `ip-profile delete` | `ipprofile.not_found`, `ipprofile.confirm_name_mismatch`, `confirmation.required`, `usage.missing_argument`, `context.no_team` |
| `ip-profile assign` | `ipprofile.not_found`, `app.not_found`, `context.no_app`, `usage.missing_argument` |
| `ip-profile unassign` | `ipprofile.not_found`, `app.not_found`, `context.no_app`, `usage.missing_argument` |
| `link` | `app.not_found`, `app.ambiguous`, `auth.not_authenticated`, `link.unreadable` |
| `logs` | `logs.no_team_slug`, `app.not_found`, `usage.bad_level`, `usage.empty_argument`, `logs.bad_response` |
| `metrics` | `logs.no_team_slug`, `app.not_found`, `usage.empty_argument`, `metrics.bad_response`, `metrics.query_refused`, `context.no_team` |
| `port list` | `context.no_app`, `app.not_found` |
| `port get` | `port.not_found`, `port.no_address`, `usage.bad_port`, `context.no_app`, `app.not_found` |
| `port set` | `app.port_invalid`, `app.scheme_invalid`, `app.port_duplicate`, `usage.bad_port`, `usage.missing_argument`, `context.no_app`, `app.not_found` |
| `port unset` | `port.not_found`, `usage.bad_port`, `usage.missing_argument`, `context.no_app`, `app.not_found` |
| `api` | `api.method_invalid`, `api.path_required`, `api.path_invalid`, `api.query_invalid`, `api.body_invalid`, `api.body_not_allowed`, `api.body_unreadable`, `confirmation.required`, `usage.missing_argument` |
| `registry list` | `context.no_team` |
| `registry create` | `registry.name_required`, `registry.server_required`, `registry.server_invalid`, `registry.username_required`, `registry.password_required`, `registry.password_unreadable`, `usage.conflicting_flags`, `usage.missing_argument`, `context.no_team` |
| `registry delete` | `registry.not_found`, `registry.confirm_name_mismatch`, `confirmation.required`, `usage.missing_argument`, `context.no_team` |
| `repos` | `repos.not_connected`, `auth.not_authenticated` |
| `requests` | `logs.no_team_slug`, `app.not_found`, `usage.bad_status`, `usage.bad_method`, `usage.empty_argument`, `logs.bad_response`, `usage.bad_duration` |
| `app shell` | `shell.not_interactive`, `shell.no_instance`, `shell.instance_not_found`, `shell.disconnected`, `app.not_found`, `context.no_app` |
| `team use` | `auth.team_not_signed_in` |
| `update` | `update.unmanaged`, `update.failed` |
| `volume list` | `app.not_found`, `context.no_team` |
| `volume get` | `volume.not_found`, `volume.ambiguous`, `usage.missing_argument` |
| `volume create` | `volume.name_required`, `volume.name_invalid`, `volume.size_invalid`, `volume.mount_invalid`, `volume.attach_incomplete`, `usage.bad_size`, `quota.limit_reached`, `app.not_found` |
| `volume attach` | `volume.not_found`, `volume.attach_incomplete`, `volume.mount_invalid`, `app.not_found`, `usage.missing_argument` |
| `volume detach` | `volume.not_found`, `usage.missing_argument` |
| `volume delete` | `confirmation.required`, `volume.confirm_name_mismatch`, `volume.not_found` |
<!-- /gen -->

## Global flags

<!-- gen:global-flags -->
| Flag | Type | Notes |
| --- | --- | --- |
| `-o`, `--output` | `string` | output format. auto means text on a terminal, json when piped One of `auto`, `text`, `json`, `ndjson`. Default `auto`. |
| `--json` | `bool` | shorthand for --output json |
| `--fields` | `string` | limit structured output to these fields, comma separated. An unknown name is an error, not an omission |
| `--team` | `string` | team slug or id, overriding the linked team |
| `--token` | `string` | API token |
| `-q`, `--quiet` | `bool` | suppress everything except errors |
| `--dry-run` | `bool` | print the request that would be sent, without sending it |
| `-y`, `--yes` | `bool` | acknowledge a reversible change. Never enough for a destructive one |
<!-- /gen -->

_Generated from `outplane schema` at CLI 0.1.1. Run `node scripts/gen-refs.mjs` after refreshing `cli-schema.json`._
