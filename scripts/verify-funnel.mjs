/**
 * @file scripts/verify-funnel.mjs
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
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkCoverage, digest, parseRegistry } from '../tools/verification/registry.mjs'
import { validateEvidence } from '../tools/verification/evidence.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const markdown = readFileSync('docs/verification.md', 'utf8')
const entries = parseRegistry(markdown)
const inventory = ['tools/dev/pre-commit.mjs', ...['tools/lint', 'tools/verification'].flatMap((directory) => readdirSync(directory).filter((name) => name.endsWith('.mjs')).map((name) => `${directory}/${name}`))]
checkCoverage(entries, inventory)
const mode = process.argv[2]
if (mode === 'registry') {
  console.log(`Registry covers ${inventory.length} shared funnel interfaces.`)
} else if (mode === 'collect' || mode === 'check') {
  // HEAD alone cannot identify local edits. Refuse divergence rather than certifying the wrong bytes.
  if (git('diff', '--name-only') || git('ls-files', '--others', '--exclude-standard')) throw new Error('Stage the complete working tree before collecting revision-bound evidence.')
  const base = process.env.FUNNEL_BASE_SHA || git('rev-parse', 'HEAD^')
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('FUNNEL_BASE_SHA must identify a real full base commit, not event text or a branch.')
  const changed = git('diff', '--name-only', base, '--').split('\n')
  const affected = changed.some((path) => /^(?:templates\/)?(?:tools\/(?:verification\/|lint\/|dev\/(?:surfaces|pre-commit)\.mjs)|test\/funnel|scripts\/(?:verify-funnel|test-affected)\.mjs|docs\/(?:verification|house-funnel)\.md|package(?:-lock)?\.json|eslint\.config\.mjs|\.github\/workflows\/(?:ci|house-funnel)\.yml)/.test(path))
  const context = { markdown, commit: git('rev-parse', 'HEAD'), tree: git('write-tree'), affected: ['house.funnel'] }
  const directory = resolve('.verification/publish')
  if (!affected) {
    rmSync(directory, { recursive: true, force: true })
    console.log('Not applicable: no shared funnel interface changed; no feature proof collected or claimed.')
  } else if (mode === 'collect') {
    // A failed collector must not leave an older successful publication behind.
    rmSync(directory, { recursive: true, force: true })
    const entry = entries[0]
    if (entry.command[0] !== 'node') throw new Error('The house adapter executes Node test commands only; correct the documented command.')
    const startedAt = new Date().toISOString()
    const result = spawnSync(process.execPath, entry.command.slice(1), { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
    const finishedAt = new Date().toISOString()
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    if (result.error) throw result.error
    const results = [...result.stdout.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)]
    const tests = Number(result.stdout.match(/^# tests (\d+)$/m)?.[1])
    if (!tests || results.length !== entry.assertions.length || tests !== results.length) throw new Error('TAP did not execute exactly the documented assertions. Fix selection; do not publish empty or partial proof.')
    const assertions = entry.assertions.map((name) => {
      const matching = results.filter((match) => match[2] === name)
      if (matching.length !== 1) throw new Error('A documented assertion did not execute exactly once.')
      return { name, passed: matching[0][1] === 'ok' }
    })
    const passed = result.status === 0 && assertions.every((assertion) => assertion.passed)
    if (git('diff', '--name-only') || git('ls-files', '--others', '--exclude-standard') || git('write-tree') !== context.tree) throw new Error('Verification changed the source snapshot; review and rerun before publishing evidence.')
    // Publish only known synthetic assertion names/outcomes, never arbitrary subprocess output.
    const log = assertions.map((assertion) => `${assertion.passed ? 'PASS' : 'FAIL'} ${assertion.name}`).join('\n') + `\nExecuted tests: ${tests}\n`
    const manifest = { version: 1, commit: context.commit, tree: context.tree, registryDigest: digest(markdown), synthetic: true, retentionDays: 7, audience: 'existing-artifact-audience', affected: context.affected, runs: [{ id: entry.id, status: passed ? 'pass' : 'fail', startedAt, finishedAt, command: entry.command, selector: entry.selector, tests, assertions, exitCode: result.status ?? 1, files: [{ kind: 'log', path: 'contracts.log', sha256: digest(log), reviewed: true }] }] }
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'contracts.log'), log)
    writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    validateEvidence(directory, manifest, context)
    process.exitCode = passed ? 0 : 1
  } else {
    // Safe failed evidence may upload, but collect retains its nonzero outcome in CI.
    validateEvidence(directory, JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')), context)
    console.log('Publication evidence is structurally valid and byte-bound.')
  }
} else {
  throw new Error('Usage: node scripts/verify-funnel.mjs registry | collect | check')
}
