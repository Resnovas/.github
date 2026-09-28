# Publish to PostHog

Use Mem0 Gateway `posthog__exec` against Resnovas **Default** project.

## Create

```text
call skill-create {"name":"<kebab>","description":"<when to use>","body":"<SKILL.md body without frontmatter or with stripped yaml>","license":"MIT","metadata":{"upstream":"<owner/repo>","pinned_sha":"<sha>"},"files":[{"path":"references/foo.md","content":"..."}]}
```

`files` is optional on create. Prefer bundling all references on create for a pack.

## Update

1. `call skill-get {"skill_name":"<name>"}` - read `version` / `latest_version`.
2. Prefer per-file tools for adds; for full replace of a small pack use `skill-update` with `files` (replaces ALL files - include every file) and required `base_version`.
3. For body-only: `skill-update` with `body` + `base_version` + `version_description`.
4. Chain: each write returns a new version - use that as next `base_version`. Never parallel writes to one skill.

## Description limits

- `name` max 64 kebab-case
- `description` max 1024

Strip YAML frontmatter `name`/`description` into the PostHog fields; body is the markdown after frontmatter (or full SKILL.md text if PostHog expects instructions only - match existing house skills: body without duplicating name).

## Failure

On 409 concurrency: re-get skill, retry once with new `base_version`.
On missing tool: `request_access`, stop.