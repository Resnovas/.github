/**
 * @file scripts/test-affected.mjs
 *
 * Copyright 2026 Jonathan Stevens trading as Resnovas. All rights reserved.
 * Licensed under the Fair Core License, Version 1.0, MIT Future License
 * (FCL-1.0-MIT); see LICENSE. You may not move, change, disable or circumvent
 * the licence key functionality, or modify any part of the software that the
 * licence key protects.
 *
 * Contributions are made under the Developer Certificate of Origin (DCO.md) and
 * the Contributing Guidelines (CONTRIBUTING.md), subject to the Code of Conduct
 * (CODE_OF_CONDUCT.md) and the Cooperation Commitment (COOPERATION_COMMITMENT.md).
 *
 * DELETING THIS NOTICE AUTOMATICALLY VOIDS YOUR LICENSE.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// This house-only map includes file-reading tests as well as imported dependencies.
// Products use their own dependency graph; these paths are not a synced selector.
const rendered = ['render', 'values', 'ai-docs', 'funnel-lint']
const owners = [
  [/^templates\//, rendered],
  [/^(?:scripts\/render\.mjs|scripts\/lib\/(?:render|values|managed)\.mjs|house\.yml|smartcloud\/)/, [...rendered, 'managed', 'commit-check']],
  [/^(?:templates\/)?tools\/dev\//, ['render', 'commit-check', 'funnel']],
  [/^(?:templates\/)?tools\/license\//, ['check-headers', 'funnel-lint']],
  [/^(?:templates\/)?tools\/lint\/|^eslint\.config\.mjs$/, ['funnel-lint']],
  [/^(?:templates\/)?tools\/verification\/|^scripts\/(?:verify-funnel|test-affected)\.mjs$|^docs\/(?:verification|house-funnel)\.md$/, ['funnel', 'funnel-lint']],
  [/^(?:templates\/)?tools\/ai-docs\/|^ai-docs\//, ['ai-docs']],
  [/^(?:templates\/)?(?:tools\/graphify\/|graphify-out\/|\.graphifyignore$)/, ['graphify']],
  [/^(?:templates\/)?tools\/release\//, ['release-tools']],
  [/^(?:templates\/)?tools\/(?:test-process|typecheck|ci)\//, ['test-process']],
  [/^(?:templates\/)?\.github\/workflows\//, ['actions', 'workflows', 'codeql-alert-comment']],
  [/^scripts\/lib\/codeql-alert-comment\.mjs$/, ['codeql-alert-comment']],
  [/^(?:templates\/)?(?:skills\/|\.(?:agents|claude)\/skills\/)/, ['skills']],
  [/^test\/[^/]+\.test\.mjs$/, []],
]

/** Select existing test files from staged paths; refuse new executable paths without an owner. */
export function selectAffectedTests(paths, tests) {
  const selected = new Set()
  for (const path of paths) {
    // Dependency/toolchain changes affect every test, but still run tests only, not full verify.
    if (/^(?:package(?:-lock)?\.json|\.node-version|\.npmrc|\.gitignore)$/.test(path)) return [...tests].sort()
    const matches = owners.filter(([pattern]) => pattern.test(path))
    if (tests.includes(path)) selected.add(path)
    for (const [, names] of matches) for (const name of names) selected.add(`test/${name}.test.mjs`)
    if (matches.length === 0 && /\.(?:[cm]?[jt]sx?|sh|ya?ml|jsonc?)$/.test(path)) {
      throw new Error(`Map ${path} to its affected tests in scripts/test-affected.mjs; do not fall back to full verification or silently skip code.`)
    }
  }
  return [...selected].filter((path) => tests.includes(path)).sort()
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const paths = execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  const tests = readdirSync('test').filter((name) => name.endsWith('.test.mjs')).map((name) => `test/${name}`)
  const selected = selectAffectedTests(paths, tests)
  console.log(`Staged affected tests: ${selected.join(', ') || 'none (no test-owned path changed)'}`)
  if (selected.length > 0) {
    const result = spawnSync(process.execPath, ['--test', ...selected], { stdio: 'inherit' })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  }
}
