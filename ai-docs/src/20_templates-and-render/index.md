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
