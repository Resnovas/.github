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

### Shared test-process boundary

Canonical sources are `templates/tools/test-process/process.mjs` and its explicit `process.d.mts` boundary. The generic typecheck/editor test launchers import this dependency-free Node core; application adapters provide their existing Effect/Flags and runner registration without owning a second process. `test/test-process.test.mjs` exercises real child exit/output, mandatory private timing, budget rejection, IPC, forced termination, cancellation-through-close and the exact launcher files against small real executables. Run it with `node --test test/test-process.test.mjs`, then the unchanged complete `node --run test` and `node --run check` gates.

`childBudgetIssue([10000, 10000], 5000)` rejects the inconsistent original pattern; `[2300, 2300]` under 5000 and `[60000]` under 65000 remain valid. Every child reserves 100 ms cleanup and the enclosing sum must leave headroom. The public `runChild`/`startChild` API has no timing opt-out. Results preserve business streams and failure status; safe numeric phase records are emitted separately to stderr. Await `completed` or `cancel` before releasing a child. Application flag evaluation may reject admission but cannot disable an admitted Node child's timing.

The typecheck build/compiler ceilings are new 120000/60000 ms safety ceilings, not measured universal performance acceptance. Its whole budget derives from the serial vector. The editor's new 600000 ms command ceiling does not change Vitest's test limits or its existing coverage-off invocation. Both launchers run installed package-manifest Node entry points through `process.execPath`; do not reintroduce POSIX shebang or Windows shell ownership. Exact-launcher fixtures use ordinary Node modules with no executable shim. Review a slow phase using retained timing and representative measurements; do not infer a production defect from host contention or call a passing retry a causal correction. Local Linux proofs do not establish Windows execution or portable descendant termination; the normal OS/Node matrix is still required. See `docs/synced-files.md#test-subprocess-timing` for complete options and limitations. The proposal remains unadopted downstream until the normal house PR merges and syncs; use non-closing `Refs: EVE-261` and `Refs: Resnovas/Eventiva#1035` for this partial delivery.
