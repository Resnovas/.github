# Skills catalogue

Skills that belong to the house but do not sync into every repository: they only apply on a particular host or to this repository's own jobs. Each directory is one skill in the Agent Skills format (`SKILL.md` plus reference files).

- The skills every repository gets live under [`templates/.agents/skills/`](../templates/.agents/skills/) and reach each repository as `.agents/skills/` through the sync, with `.claude/skills/` generated from them.
- The skills here are published to the catalogue with version history by the `skills-upstream-sync` skill, together with the synced ones, so an agent on a host that reads the catalogue can load them on demand.
- Change a skill here or under `templates/`, never in the catalogue or in a downstream copy. Move a directory between the two places to change whether it syncs.
