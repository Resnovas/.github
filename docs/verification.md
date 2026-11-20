# House funnel contracts

This registry covers the shared funnel tooling introduced in RES-67 (formerly SMC-175), not every existing house feature. Source inventory is discovered from `tools/verification/`, the pre-commit entry point and shared lint configuration. The adapter is `scripts/verify-funnel.mjs`. Other house tests remain required in `verify`.

Use disposable Git repositories, synthetic JSON and lint snippets. Execute the command below. The tests exercise installed hooks, rejected/accepted lint samples, document boundaries, build-info match/mismatch and registry/evidence failures. No real deployment or browser path is claimed; logs are sufficient for these nonvisual contracts.

```verification
{
  "id": "house.funnel",
  "status": "implemented",
  "interfaces": [
    "tools/dev/pre-commit.mjs",
    "tools/lint/funnel.mjs",
    "tools/lint/react.mjs",
    "tools/verification/build-info.mjs",
    "tools/verification/docs-budget.mjs",
    "tools/verification/evidence.mjs",
    "tools/verification/registry.mjs"
  ],
  "command": ["node", "--test", "--test-reporter=tap", "test/funnel.test.mjs", "test/funnel-lint.test.mjs"],
  "selector": "house funnel public contracts",
  "assertions": [
    "pre-commit checks the staged snapshot, orders gates, propagates failure and preserves foreign hooks",
    "staged test selection follows source owners without collecting full verification evidence",
    "document budgets reject both line inflation and a single enormous paragraph",
    "deployment proof accepts only the full intended live build-info commit",
    "registry coverage uses an independent inventory and refuses empty or unknown selections",
    "evidence rejects empty proof, weakened assertions, widened selection and stale provenance",
    "evidence validation binds reviewed bytes rather than accepting a manifest alone",
    "source-absence lint rejects source inspections while allowing behavior and redaction assertions",
    "JSDoc rejects name restatements and missing contracts while accepting purpose and constraints",
    "the repository config applies shared policies to test and lint-tool scopes",
    "rendered Node consumers exempt canonical headers across JSDoc rules without exempting declarations",
    "opt-in React lint preserves corrective lifecycle and lexical timer contracts",
    "React opt-in composition retains consumer restrictions and UI-only timer scope"
  ],
  "evidence": ["log"]
}
```

The local collector requires a fully staged working tree and binds its tree SHA as well as HEAD. CI binds the clean checkout tree. Test output is reduced to the allowlisted assertion names, outcomes and counts before publication; raw process output stays in the CI log. A malformed or empty TAP result fails rather than producing an empty success. For a later change outside this bounded feature, the adapter reports not applicable and publishes no feature proof; the normal complete suite still runs.
