## Templates and the renderer

Every file under `templates/` is rendered to the same relative path in a
repository. Rendering does three things:

1. **Substitutes placeholders.** `{{KEY}}` is replaced from the values
   (`scripts/lib/render.mjs`). An unknown key throws, naming the template, so a
   blank copyright holder or contact address can never ship; `{{KEY:-default}}`
   renders the default instead, for an optional per-repository value such as
   `PROJECT_TYPE`. Keys are upper snake case. Avoid a literal `{{UPPER}}` in a template for any other reason.
2. **Merges managed blocks.** A template with a `house:managed:begin` and
   `house:managed:end` pair is extendable: only the lines between the markers
   are replaced, and everything the repository added around them is kept
   (`scripts/lib/managed.mjs`, `mergeManaged`). A template without the pair is
   replaced whole.
3. **Keeps the executable bit.** A template with the owner execute bit (such as
   `tools/graphify/graphify`) is written with mode 755.

Marker rules an agent must keep:

- A marker counts only on a comment line: `#` in YAML, TOML and CODEOWNERS,
  `//` in JSON with comments, `<!--` in Markdown. Prose that merely mentions a
  marker, as `GOVERNANCE.md` does, leaves the file whole-file managed.
- `house:local` marks where a repository adds its own lines. When a repository
  first adopts a file it already had, its old content is parked there,
  commented out, with a notice.
- In `CODEOWNERS` the managed block comes last, because the last matching rule
  wins; nothing may follow it.
- `managedConflicts` reports local lines that would redefine synced ones: a
  top-level YAML key, an issue form field id, a workflow job, a TOML table, a
  JSON `label`, `name` or `id`, or a duplicate Dependabot update.

`scripts/render.mjs` options:

| Option | Default | Meaning |
| --- | --- | --- |
| `--out <dir>` | the repository root | Where to render. |
| `--override <file>` | none | A values file layered over `house.yml`. |
| `--repository owner/name` | `REPOSITORY` from the values | The repository being rendered. |
| `--check` | off | Write nothing; exit 1 listing every stale file. |

Values come from `house.yml`, then the override file, then `--repository`, each
replacing the keys of the one before. `HOUSE_EXCLUDE` (comma separated
template paths) skips templates, as a downstream `sync.exclude` does.

A new synced file needs three things besides the template itself: an entry in
`templates/.prettierignore` if Prettier can format it (a test fails otherwise),
a row in `docs/synced-files.md`, and a render so the root copy exists.

## Generated Linear source and the commit hook

`templates/tools/dev/commit-check.mjs` fixes the generated-source exclusions by path: `docs/planning/issues/**` and exactly `tools/documentation/linear-snapshot.json` preserve verbatim Linear text, including historical em and en dashes. These are generated-source locations only. Human-authored planning prose outside the issue mirror and arbitrary JSON remain subject to the existing ASCII dash rule. Content markers and local configuration cannot extend these exclusions; commit-message checks are unchanged.

For example, preserve a generated `docs/planning/issues/EVE-45.md` description unchanged, but use ASCII hyphen-minus in `docs/planning/timeline.md`. Verify with `node --test test/commit-check.test.mjs`. Render the canonical template and deliver it through the repository's existing house-sync rules; do not patch a downstream managed copy independently or rewrite mirrored source to pass the hook.

## Development task traceability

Follow [AGENTS.md, Issues and handoff](../../../AGENTS.md#issues-and-handoff) for task-owned start, blocked, pause/handoff and verified-delivery updates. Verify the actual Linear/GitHub pair and mirrored comments, preserve other active slices, and keep read-only requests read-only. Every mapped task commit, including generated outputs, cites both verified issues; partial delivery uses `Refs`, never whole-issue closure.

The existing renderer accepts optional `sync.values.TASK_LINEAR_PREFIX` from the downstream local `.github/smartcloud.yml`. It renders only into plaintext `tools/dev/commit-check-linear-prefix.txt`, never executable JavaScript. Sync that file with the checker; a missing file fails closed. Default `none` leaves unmapped repositories compatible; a verified uppercase team key such as Eventiva's `EVE` makes the offline checker require that exact key and a qualified GitHub issue reference on ordinary commits. `Refs: EVE-266, Resnovas/Eventiva#1053` is this rollout's verified pair, not IDs to copy into unrelated tasks. Full GitHub issue URLs also work. Bare numbers, pull request URLs, different/prefixed keys and references hidden in git comments or the verbose diff fail. Invalid prefix values, including quote/backtick/newline injection payloads, fail explicitly without executing configuration. Existing git-generated exceptions and signing/credit/staged-source rules are unchanged.

Run `node --test test/commit-check.test.mjs`, then normal render/test/check and doc generation. The rendered CLI tests cover both default-unmapped and opted-in behavior, including generated graph/docs commits. This is a syntax guard, not remote mapping verification, tracker synchronization, acceptance or a new runtime feature flag. An accepted upstream change and normal downstream sync must precede downstream managed adoption. Record this rollout's actual evidence and remaining house/sync acceptance in [the canonical timeline](https://github.com/Resnovas/Eventiva/blob/main/docs/planning/timeline.md) and both linked trackers; never report a proposed template as delivered everywhere.

## Issue forms

`templates/.github/ISSUE_TEMPLATE/` holds one form per kind of issue, matching
the Linear issue templates so an issue reads the same on either tracker:

| Form | Title prefix | Label | Linear template |
| --- | --- | --- | --- |
| `bug_report.yml` | `fix: ` | `bug` | Bug report |
| `feature_request.yml` | `feat: ` | `enhancement` | General |
| `documentation.yml` | `docs: ` | `documentation` | Documentation review |
| `performance.yml` | `perf: ` | `performance` | Bug report (measured) |

Every form ends with the same three required fields, in this order:
`duplicates`, `ai-level` (a dropdown of the AI policy levels) and `ai-tools`,
because smartcloud's disclosure check and AI-01 read them. `config.yml` turns
off blank issues, so a new kind of issue needs a new form. Keep field ids
stable: a downstream repository adds its own fields after `house:local`, and
`managedConflicts` rejects a local field that reuses a managed id.
