# Parity: house scripts and smartcloud

Every test case in `test/policy.test.mjs`, `test/settings.test.mjs`, `test/managed.test.mjs` and `test/render.test.mjs`, mapped to the smartcloud test that covers the same behaviour.
Paths are under `Resnovas/smartcloud/tests/`.
"Preset" means the behaviour comes from a rule in `smartcloud/house.yml` rather than from feature code; those rows were checked with the before/after comparison script (see the end of this file).

Result: the 4 gaps found (G1 to G4 below) are closed in smartcloud, so the policy and settings scripts and their tests are deleted. The renderer (`scripts/render.mjs` with `scripts/lib/{render,values,managed}.mjs` and their tests) stays: this repository renders its own root from `templates/`, and smartcloud's sync check deliberately skips the source repository, so `npm run check` is still what keeps the root in step.

## policy.test.mjs

| House test | smartcloud test |
| --- | --- |
| a compliant AI-assisted pull request passes | `feature.commits/src/feature.spec.ts` and `feature.disclosure/src/feature.spec.ts`: "a compliant AI-assisted pull request passes"; `feature.conventions/src/feature.spec.ts`: "records nothing when every rule passes" |
| a compliant pull request with no AI passes | `feature.commits` and `feature.disclosure` `feature.spec.ts`: "a compliant pull request with no AI passes" |
| missing or invalid disclosure fails AI-01 | `feature.disclosure/src/feature.spec.ts`: "a missing or invalid disclosure fails AI-01" |
| template guidance inside HTML comments is not read as an answer | `feature.disclosure/src/feature.spec.ts` and `parse.spec.ts`: "template guidance inside HTML comments is not read as an answer" / "does not read template guidance inside HTML comments as an answer" |
| an AI level other than none must name tools and credit a co-author | **G2.** `feature.disclosure/src/feature.spec.ts`: "an AI level other than none must name tools and credit a co-author" covers the behaviour, but the missing co-author is reported as `AI-01`, not `AI-02` |
| claiming no AI while crediting an AI co-author is inconsistent | `feature.disclosure/src/feature.spec.ts`: same name |
| an AI tool can never sign off, even for a maintainer | `feature.commits/src/feature.spec.ts`: same name; `policy.spec.ts`: "downgrades maintainer errors, except AI-03" |
| every non-merge commit needs a sign-off matching its author | `feature.commits/src/feature.spec.ts`: same name |
| AI-assisted pull requests must be opened as drafts | `feature.disclosure/src/feature.spec.ts`: same name |
| leaving draft requires the author as accountable human and a review statement | `feature.disclosure/src/feature.spec.ts`: same name |
| maintainer pull requests report policy errors as warnings | `feature.commits/src/feature.spec.ts`: "maintainer pull requests report errors as warnings, or at the configured level"; `feature.disclosure/src/feature.spec.ts`: "maintainer pull requests report policy errors as warnings, or at the configured level". The title downgrade is the preset's `title` / `title-maintainer` pair (preset) |
| trusted automation accounts are skipped | `feature.commits` and `feature.disclosure` `feature.spec.ts`: "trusted automation accounts are skipped"; `feature.reviews/src/feature.spec.ts`: "lets a trusted bot skip the gate with a notice". Title and style exemptions are `creatorMatches` conditions (preset) |
| non-conventional titles fail | Preset `conventions.title` (`titleMatches` with the old pattern); `feature.conventions/src/feature.spec.ts`: "a failing preset is an error explaining the preset, unless the rule sets a level and message", `presets.spec.ts`: "conventionalCommits rejects other types, casing, spacing and empty descriptions" |
| emoji, dashes and unticked checklists are style warnings | `feature.conventions/src/feature.spec.ts`, "house style through when and $not": "flags emoji in the title or the description", "flags em and en dashes", "flags unticked checklist items on pull requests, however they are bulleted or indented" (the preset sets `level: warning`) |
| trailers are parsed case-insensitively | `feature.commits/src/attribution.spec.ts`: "parses trailers case-insensitively, lower-casing emails"; `feature.spec.ts`: "trailers are parsed case-insensitively" |
| AI identities are recognised by address or tool name | `feature.commits/src/identity.spec.ts`: "recognises AI identities by address or tool name" |
| review gate is open with fewer than two maintainers | `feature.reviews/src/gate.spec.ts`: "is open with fewer than two maintainers"; `feature.spec.ts`: "is open with fewer than two maintainers: a notice, linked to the default policy base" |
| outside contributions need two maintainer approvals | `feature.reviews/src/gate.spec.ts`: "needs two maintainer approvals on outside contributions" |
| a maintainer needs one other maintainer, and cannot approve their own pull request | `feature.reviews/src/gate.spec.ts`: "needs one other maintainer on a maintainer pull request, and ignores the author approving their own" |
| a later change request withdraws an earlier approval; comments do not | `feature.reviews/src/gate.spec.ts`: "withdraws an approval on a later change request; comments and pending reviews change nothing" |
| claiming no AI while listing AI tools is inconsistent | `feature.disclosure/src/feature.spec.ts`: same name |
| Co-authored-by and Assisted-by must appear together on each AI commit | `feature.commits/src/feature.spec.ts`: same name. **G2** applies to the Assisted-by-only half: the pull request level finding is `AI-01`, not a second `AI-02` |
| Assisted-by is parsed in the kernel form | `feature.commits/src/attribution.spec.ts`: "parses Assisted-by in the kernel form" |
| claiming no AI while carrying only Assisted-by is inconsistent | **G3.** `feature.disclosure/src/feature.spec.ts`: same name gives `AI-01`, but the commits feature adds an `AI-02` the old check did not raise |

## settings.test.mjs

| House test | smartcloud test |
| --- | --- |
| project types choose their environments, and ENVIRONMENTS overrides them | `feature.settings/src/plan.spec.ts`: "project types choose their environments, and explicit names override them". **G4** for the unknown `PROJECT_TYPE` error: the schema's literal rejects it (checked with `smartcloud validate`), but no smartcloud test asserts it |
| shipping environments deploy only from protected branches | `feature.settings/src/plan.spec.ts`: "shipping environments deploy only from protected branches" |
| the merge settings enforce squash or rebase, sign-off, and trailer-preserving squashes | `feature.settings/src/plan.spec.ts`: same name |
| a public repository gets every step, in order | `feature.settings/src/plan.spec.ts`: same name; `apply.spec.ts`: "applies the full house baseline, in order, with the exact requests" |
| discussions and sponsorships go through GraphQL with the repository node id | `feature.settings/src/plan.spec.ts`: same name |
| a private repository skips paid secret scanning and treats the ruleset as optional | `feature.settings/src/plan.spec.ts`: same name |
| environment names are URL encoded | `feature.settings/src/plan.spec.ts`: same name |
| the ruleset targets the default branch with linear history and AI review | `feature.settings/src/plan.spec.ts`: same name |
| a sole maintainer can bypass and has no required checks | `feature.settings/src/plan.spec.ts`: same name |
| two maintainers require the house checks, and the owner can still bypass | `feature.settings/src/plan.spec.ts`: "two maintainers require the configured checks, and the owner can still bypass" |
| the code scanning gate can be switched off for repositories CodeQL cannot analyse | `feature.settings/src/plan.spec.ts`: same name. The preset sets the gate on, so a repository extending it can no longer switch it off (see differences) |

## managed.test.mjs

| House test | smartcloud test |
| --- | --- |
| a file without markers is fully managed | `feature.sync/src/managed.spec.ts`: same name |
| a new file gets the whole template | `feature.sync/src/managed.spec.ts`: same name |
| the managed block is replaced and local additions are kept | `feature.sync/src/managed.spec.ts`: same name |
| first adoption keeps the previous file, commented out at the local marker | `feature.sync/src/managed.spec.ts`: same name |
| first adoption of a Markdown file wraps the previous content in a comment | `feature.sync/src/managed.spec.ts`: same name |
| first adoption without a local marker appends the previous content | `feature.sync/src/managed.spec.ts`: same name |
| a local Dependabot update may not duplicate a synced one | `feature.sync/src/managed.spec.ts`: same name |
| local YAML may not redefine a synced top-level key | `feature.sync/src/managed.spec.ts`: same name |
| local issue form fields may not reuse a synced id | `feature.sync/src/managed.spec.ts`: same name |
| local workflow jobs may not redefine a synced job | `feature.sync/src/managed.spec.ts`: same name |
| nothing may follow a managed block that must come last | `feature.sync/src/managed.spec.ts`: same name |
| conflict checks ignore files without markers on either side | `feature.sync/src/managed.spec.ts`: same name |
| sync findings: documents may not be edited, only synced | `feature.sync/src/managed.spec.ts`: "documents may not be edited, only synced" |
| sync findings: managed blocks may not be edited, local rules may be added | `feature.sync/src/managed.spec.ts`: "managed blocks may not be edited, local rules may be added" |
| sync findings: a sync that brings the block up to date is allowed | `feature.sync/src/managed.spec.ts`: "a sync that brings the block up to date is allowed"; `feature.spec.ts`: "allows a pull request that brings synced files up to date" |
| synced file findings fail contributors and warn maintainers | **G1.** `feature.sync/src/feature.spec.ts`: "fails edits to synced content at the pull request head, linking the policy" covers contributors; smartcloud has no maintainer level for `SYNC`, so a maintainer's edit is an error, not a warning |
| markers only count on comment lines, so a document quoting them is synced whole | `feature.sync/src/managed.spec.ts`: "only count on comment lines, so a document quoting them is synced whole" |
| isMarker accepts YAML and Markdown comment markers and rejects look-alikes | `feature.sync/src/managed.spec.ts`: same name |

## render.test.mjs

| House test | smartcloud test |
| --- | --- |
| values parse flat keys, strip comments and one pair of quotes | `feature.sync/src/render.spec.ts`: "parse flat keys, strip comments and one pair of quotes" |
| values reject anything that is not KEY: value | `feature.sync/src/render.spec.ts`: "reject anything that is not KEY: value, naming the file and line"; `config/src/load.spec.ts`: "reject sync values whose keys are not SCREAMING_SNAKE_CASE" |
| lists split on commas and drop blanks | `feature.sync/src/render.spec.ts`: "splits on commas and drops blanks" |
| placeholders are replaced and unknown keys are an error | `feature.sync/src/render.spec.ts`: "replaces placeholders, and an unknown key is an error" |
| renderAll walks nested templates and keeps relative paths | `feature.sync/src/render.spec.ts`: "renders nested templates, keeps their paths and execute bits, and sorts by path" |
| loadValues reads a file, and a missing file is an error unless optional | Obsolete: there is no values file. Values live in `sync.values`, decoded by the config schema (`config/src/load.spec.ts`: "decode and round-trip every section") |

The CI step `npm run check` (rendered root matches `templates/`) is replaced by the sync feature running on this repository: it proposes a pull request whenever the root drifts. `feature.sync/src/feature.spec.ts`: "proposes nothing when the repository is up to date".

## Gaps

| Gap | What differed | Resolution |
| --- | --- | --- |
| G1 | A maintainer's edit to synced content was always an error in smartcloud; the house check warned | Fixed: `sync.maintainerLevel`, a warning by default, using the commits feature's role rules (Resnovas/smartcloud, sync PR) |
| G2 | "No commit credits the AI tool" was reported as `AI-01` | Fixed: reported as `AI-02`, linking to `AI_POLICY.md#ai-02` (Resnovas/smartcloud, disclosure PR) |
| G3 | With `AI level: none`, an Assisted-by-only commit also gets an `AI-02` from the commits feature | Kept on purpose: the commit's trailers are malformed whatever the disclosure says, so the extra finding is accurate and stricter |
| G4 | No test for an unknown project type | Fixed: a decode test in smartcloud's `config/src/load.spec.ts` |

## Differences not tied to a house test

- **Locked preset values.** A repository could override any key in `.github/house.yml`. Under "add, never change" it cannot change `roles.maintainers`, `settings.ruleset.codeScanningGate` or any `sync.values` entry (for example `COPYRIGHT_YEAR`) that the preset sets. Environments and `sync.exclude` stay open because the preset leaves them unset. A repository needing a different copyright year or code owners must exclude the file and keep its own copy.
- **Required checks.** The ruleset now requires the `smartcloud` workflow job instead of `house-policy / policy` and `house-policy / reviews`. The job fails on any error finding, so it covers the policy, the synced files check and the review gate together, and it still reports on pull requests from forks.
- **HTML comments.** The old style check ignored text inside HTML comments; `descriptionMatches` sees it. The house pull request template's comments contain no emoji, long dashes or checklists, so this only matters for a template a repository adds itself.
- **Title and style for maintainers and bots** are expressed with `creatorMatches` conditions naming TGTGamer and the three trusted bots, so a maintainer added later must also be added to those patterns.

## Before and after

`compare.mjs` (kept in the session scratchpad, not in this repository) runs the old `evaluatePullRequest`, `evaluateReviews` and `planSettings` next to smartcloud's features with the preset, through `resolveConfig` of the synced `.github/smartcloud.yml`. Rule ids and levels match on 6 of 9 pull request scenarios and all 4 review gate scenarios; the 3 differences are G2 and G3. Settings plans match step for step and body for body, except the ruleset's required check names. Syncing the real templates with the preset values renders all 25 files with no unresolved placeholder, and this repository's root is already up to date.
