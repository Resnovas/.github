## The house preset

`smartcloud/house.yml` is the smartcloud configuration every repository
extends from its synced `.github/smartcloud.yml`:

```yaml
extends:
  - Resnovas/.github/smartcloud/house.yml@main
```

Presets are locked: a repository may add keys the preset leaves unset, or
restate a value exactly, but a different value for a key the preset sets fails
the run. Keys left unset on purpose: `settings.environments`,
`settings.ruleset.requiredDeployments`, `settings.ruleset.statusChecks.checks`
entries beyond `smartcloud`, `settings.ruleset.codeScanning.ESLint`,
`settings.ruleset.codeCoverage.enabled`, `required.ignore`,
`required.expect`, `required.timeout` and `sync.exclude`.

| Section | What it sets |
| --- | --- |
| `roles` | `maintainers` (the review gate and maintainer warning levels) and `trustedBots` (skip disclosure, DCO and title checks). |
| `links.policyBase` | Where findings link: this repository's documents on `main`. |
| `labels` | The process labels from `AI_POLICY.md#labels` and `house-sync`. |
| `conventions.rules` | Conventional pull request titles (a warning for the owner), and warnings for emoji, em and en dashes, and unticked checklist items. |
| `commits` | DCO sign-off and AI attribution checks; a maintainer's own pull request gets warnings, except an AI sign-off. |
| `disclosure` | The AI disclosure in the pull request body; AI-assisted pull requests open as drafts. |
| `reviews.gate` | Two maintainer approvals for an outside author, one for a maintainer; open while fewer than two maintainers are listed. |
| `settings` | The repository baseline: merge options, features, security, the default branch ruleset with a squash merge queue, and Actions defaults. |
| `required` | Turns on the aggregate check: the `smartcloud` job waits for every other check. |
| `sync` | Where templates come from, the `house/sync` branch, the edit check and the placeholder values. |

When you change the preset, keep it valid against smartcloud's schema (the
`yaml-language-server` line names it), and remember it applies to every
repository on its next run. Changing a locked value can make a repository's
own config, which restated the old value, fail; search the organisation first.
