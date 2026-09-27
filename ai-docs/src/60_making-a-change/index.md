## Making a change here

1. Find the source. A rendered file (anything with a
   `synced from Resnovas/.github templates/...` marker) is changed in
   `templates/`; a default value in `house.yml` or in `sync.values` of
   `smartcloud/house.yml` (downstream repositories read the preset, not
   `house.yml`, so a new value usually goes in both).
2. Keep synced content inside the managed block and leave `house:local` in
   place, so downstream repositories keep their own lines.
3. Run `npm run render`, then `npm test` and `npm run check`. Commit the
   template and its rendered copy together; CI fails if they differ.
4. Add or update a test in `test/` when the change touches `scripts/lib`, a
   workflow rule or a synced tool. Coverage of `scripts/lib` must stay at or
   above 90% of lines and branches.
5. Document it twice in the same commit: the people-facing page under `docs/`
   (or the README) and the matching section under `ai-docs/src`, then
   `npm run ai-docs`. A new synced file gets a row in `docs/synced-files.md`; a
   preset key gets its plain-words explanation in `docs/preset.md`; a workflow
   input gets its row in `docs/workflows.md`.
6. Report what every downstream repository will see in its next sync pull
   request, or on its next run for a reusable workflow or preset change.

The repository-local prompt `change-template` (`.agents/prompts/change-template.md`)
walks an agent through the same steps.
