---
label: Change a house template
description: Change a governed file or house default and carry it through to the rendered copies
argument-hint: <what to change>
---

Make this change to the house standard: $ARGUMENTS

1. Read `README.md` for the layout. Edit the source under `templates/`, or a default in `house.yml`, never a rendered copy in the root or `.github/`.
2. In a configuration template, keep the synced content inside the `house:managed` block and leave the `house:local` marker in place, so downstream repositories keep their own rules.
3. Run `npm run render`, then `npm test` and `npm run check`. Add or update a test in `test/` when the change touches `scripts/lib`.
4. Report the rendered files that changed and what every downstream repository will see in its next sync pull request.
