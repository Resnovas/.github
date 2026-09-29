# Convert Claude Code commands pack

For `kind: claude-commands-pack` (e.g. founder):

## Input

Upstream `commands/*.md` with frontmatter:

```yaml
---
description: ...
argument-hint: [idea]
---
```

Body may use `$ARGUMENTS`.

## Output PostHog skill

- `skill_name`: catalog `posthog.skill_name` (e.g. `founder`)
- `description`: one paragraph listing when to use the pack and naming each command
- `body`: thin router - table of command -> `references/<stem>.md`; instruct to load exactly one reference; say user natural language replaces `$ARGUMENTS`
- `files[]`: one `references/<stem>.md` per command file
  - Keep instruction structure
  - Replace `$ARGUMENTS` with "the user's idea / input for this turn"
  - Drop `argument-hint` frontmatter; optional one-line purpose at top from original `description`

## Sanitize

Run sanitize pass on body and every reference before publish.