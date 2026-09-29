---
name: skills-upstream-sync
description: Publish the house skills and watched upstream skills from Resnovas/.github to the skills catalogue. Use when publishing or updating catalogued skills, when upstream SHAs move, or when the weekly skills-upstream sync automation runs.
license: MIT
---
# Skills upstream sync

Read the catalog, compare upstream SHAs (or local content), publish or update the catalogue's skills, refresh local `upstream/` checkouts when vendor, then update pins and commit.

## Catalog

SoT: `.agents/skills-upstream-catalog.yaml` in `Resnovas/.github`. First-party skills are the directories under `templates/.agents/skills/` (synced to every repository) and `skills/` (catalogue only) in that repository.

Load only:

| File | When |
| --- | --- |
| `references/publish.md` | Creating or updating a catalogue skill |
| `references/convert-claude-commands.md` | `kind: claude-commands-pack` (founder) |
| `references/sanitize.md` | Before every publish body/file write |

## Loop

1. Read the catalog `entries[]`.
2. For each entry:
   - **GitHub kinds** (`agent-skill`, `claude-commands-pack`): resolve HEAD SHA for `source.owner/repo@ref`. If equal to `pinned_sha`, skip.
   - **first-party / local**: hash `local_path` tree (or treat as always-publish when `content_hash: pending-first-publish`). Skip only when hash matches `content_hash`.
3. On change:
   - Fetch skill files from GitHub or read `local_path`.
   - Convert if needed (Claude commands pack).
   - Sanitize em/en dashes per `references/sanitize.md`.
   - Publish via Mem0 Gateway `posthog__exec` (`skill-create` or `skill-update` + `skill-file-*`). Always pass `base_version` when updating. Chain versions sequentially - never parallel file writes on the same skill.
   - For vendor kinds: write/update `local_path` under `.agents/skills/upstream/...`.
   - Set `pinned_sha` (and `content_hash` for first-party) in the catalog.
4. Commit catalog (+ local upstream + this skill if changed) with GitButler `but` on a focused branch. Do not push unless asked.
5. Report table: id | action (created/updated/skipped/failed) | sha | notes.

## Tools

- Prefer Mem0 Gateway: `find_tools` then `invoke` for PostHog and GitHub.
- If PostHog/GitHub missing: `find_tools(..., type=requestable)` then `request_access`; stop and tell the user.

## Hard rules

- Never invent SDK examples into skill bodies (Context7 for library how-to).
- Never paste secrets.
- ASCII hyphen-minus only in published text.
- Do not delete local upstream after publish.
- Do not publish out-of-catalog skills in this loop.
- The first-party source of truth is `Resnovas/.github`; the catalogue is its published mirror with version history. Never edit a skill in the catalogue, and publish every house skill there.
- Orca stubs: keep stub body; do not invent `orca` CLI flags - point agents at `ORCA skills get <name>`.

## Done when

Every catalog entry is skipped (up to date) or successfully published with an updated pin, and a summary is returned.