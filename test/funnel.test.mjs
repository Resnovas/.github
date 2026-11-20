/**
 * @file test/funnel.test.mjs
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync, statSync, utimesSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { installPreCommit, runPreCommit } from '../templates/tools/dev/pre-commit.mjs'
import { checkDocs } from '../templates/tools/verification/docs-budget.mjs'
import { verifyBuild } from '../templates/tools/verification/build-info.mjs'
import { checkCoverage, checkManifest, digest, parseRegistry, selectFeatures } from '../templates/tools/verification/registry.mjs'
import { validateEvidence } from '../templates/tools/verification/evidence.mjs'
import { selectAffectedTests } from '../scripts/test-affected.mjs'

// Fixture repositories must not inherit the enclosing real commit's index or worktree.
for (const key of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) delete process.env[key]
const scratch = resolve('.amp/in/orb-backup/funnel-tests')
mkdirSync(scratch, { recursive: true })
const fixture = () => mkdtempSync(join(scratch, 'case-'))
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

test('pre-commit checks the staged snapshot, orders gates, propagates failure and preserves foreign hooks', () => {
  const root = fixture()
  git(root, 'init', '-q')
  git(root, 'config', 'user.name', 'Synthetic Fixture')
  git(root, 'config', 'user.email', 'fixture@example.invalid')
  git(root, 'config', 'commit.gpgSign', 'false')
  mkdirSync(join(root, 'tools/dev'), { recursive: true })
  copyFileSync(resolve('templates/tools/dev/pre-commit.mjs'), join(root, 'tools/dev/pre-commit.mjs'))
  writeFileSync(join(root, '.gitignore'), 'events\n')
  const pkg = { scripts: { 'verify:static': 'node static.cjs', 'test:affected': 'node affected.cjs', verify: 'node verify.cjs', 'verify:evidence': 'node verify.cjs', 'verify:smoke': 'node verify.cjs' } }
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
  writeFileSync(join(root, 'static.cjs'), "require('node:fs').appendFileSync('events', 'static\\n')")
  writeFileSync(join(root, 'affected.cjs'), "require('node:fs').appendFileSync('events', 'affected\\n')")
  // Expensive CI commands must not run even when available in an adopted repository.
  writeFileSync(join(root, 'verify.cjs'), 'process.exit(9)')
  git(root, 'add', '.')
  installPreCommit(root)
  const installedHook = join(root, '.git/hooks/pre-commit')
  utimesSync(installedHook, 946684800, 946684800)
  installPreCommit(root)
  assert.equal(statSync(installedHook).mtimeMs, 946684800000, 'an existing hook must not be rewritten during setup')
  git(root, 'commit', '-qm', 'fixture')
  assert.equal(readFileSync(join(root, 'events'), 'utf8'), 'static\naffected\n')
  writeFileSync(join(root, 'static.cjs'), 'process.exit(3)')
  assert.throws(() => runPreCommit(root), /Stage or preserve/)
  git(root, 'add', 'static.cjs')
  assert.throws(() => runPreCommit(root), /verify:static failed/)
  assert.equal(readFileSync(join(root, 'events'), 'utf8'), 'static\naffected\n')
  writeFileSync(join(root, 'static.cjs'), "require('node:fs').appendFileSync('events', 'static\\n')")
  writeFileSync(join(root, 'affected.cjs'), 'process.exit(4)')
  git(root, 'add', '.')
  assert.throws(() => runPreCommit(root), /test:affected failed/)
  delete pkg.scripts['test:affected']
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
  git(root, 'add', '.')
  assert.throws(() => runPreCommit(root), /Define package script test:affected/)
  writeFileSync(join(root, 'static.cjs'), "require('node:fs').writeFileSync('static.cjs', '// changed by verification')")
  git(root, 'add', 'static.cjs')
  assert.throws(() => runPreCommit(root), /Stage or preserve/)
  writeFileSync(join(root, '.git/hooks/pre-commit'), '#!/bin/sh\necho foreign\n')
  assert.throws(() => installPreCommit(root), /Preserve the existing/)
  assert.equal(readFileSync(join(root, '.git/hooks/pre-commit'), 'utf8'), '#!/bin/sh\necho foreign\n')
})

test('staged test selection follows source owners without collecting full verification evidence', () => {
  const tests = ['test/funnel.test.mjs', 'test/funnel-lint.test.mjs', 'test/graphify.test.mjs', 'test/render.test.mjs']
  assert.deepEqual(selectAffectedTests(['tools/lint/react.mjs'], tests), ['test/funnel-lint.test.mjs'])
  assert.deepEqual(selectAffectedTests(['test/graphify.test.mjs'], tests), ['test/graphify.test.mjs'])
  assert.deepEqual(selectAffectedTests(['docs/funnel-timeline.md'], tests), [])
  assert.deepEqual(selectAffectedTests(['tools/dev/pre-commit.mjs', 'tools/lint/react.mjs'], tests), ['test/funnel-lint.test.mjs', 'test/funnel.test.mjs', 'test/render.test.mjs'])
  assert.deepEqual(selectAffectedTests(['package-lock.json'], tests), [...tests].sort())
  assert.throws(() => selectAffectedTests(['scripts/new-tool.mjs'], tests), /Map scripts\/new-tool.mjs to its affected tests/)
  // A deleted test is not an executable target; deleted source still selects its owner's tests.
  assert.deepEqual(selectAffectedTests(['test/removed.test.mjs', 'tools/lint/removed.mjs'], tests), ['test/funnel-lint.test.mjs'])

  const root = fixture()
  git(root, 'init', '-q')
  for (const directory of ['scripts', 'test', 'tools/lint']) mkdirSync(join(root, directory), { recursive: true })
  copyFileSync(resolve('scripts/test-affected.mjs'), join(root, 'scripts/test-affected.mjs'))
  writeFileSync(join(root, 'test/funnel-lint.test.mjs'), "import { test } from 'node:test'; test('selected lint path', () => {});")
  writeFileSync(join(root, 'test/graphify.test.mjs'), 'process.exit(7)')
  writeFileSync(join(root, 'tools/lint/changed file.mjs'), '// staged lint input')
  // Only the lint input is staged: untracked tests must not widen selection to all tests.
  git(root, 'add', 'tools/lint/changed file.mjs')
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT // Exercise the CLI as a hook, not as a nested Node test worker.
  const execute = () => spawnSync(process.execPath, ['scripts/test-affected.mjs'], { cwd: root, encoding: 'utf8', env })
  const passed = execute()
  assert.equal(passed.status, 0, passed.stderr)
  assert.match(passed.stdout, /selected lint path/)
  // A failing selected test must reach the caller; an unrelated failing test above did not.
  writeFileSync(join(root, 'test/funnel-lint.test.mjs'), 'process.exit(3)')
  assert.equal(execute().status, 1)
})

test('document budgets reject both line inflation and a single enormous paragraph', () => {
  const root = fixture()
  git(root, 'init', '-q')
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs/guide.md'), 'Short guide\n'.repeat(400))
  assert.deepEqual(checkDocs(root), [])
  writeFileSync(join(root, 'docs/guide.md'), 'Short guide\n'.repeat(401))
  assert.match(checkDocs(root)[0], /Condense, split/)
  writeFileSync(join(root, 'docs/guide.md'), 'x'.repeat(32001))
  assert.match(checkDocs(root)[0], /32001\/32000/)
  writeFileSync(join(root, 'docs/guide.md'), 'short')
  writeFileSync(join(root, 'AGENTS.md'), 'Guidance\n'.repeat(121))
  assert.match(checkDocs(root)[0], /121\/120/)

  // Populate the real index without writing thousands of irrelevant fixture files.
  const large = fixture()
  git(large, 'init', '-q')
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: large, input: '', encoding: 'utf8' }).trim()
  const paths = Array.from({ length: 18000 }, (_, index) => `docs/${String(index).padStart(5, '0')}-${'x'.repeat(180)}.md`)
  assert.ok(Buffer.byteLength(paths.join('\0')) > 3303046)
  execFileSync('git', ['update-index', '-z', '--index-info'], { cwd: large, input: paths.map((path) => `100644 ${blob}\t${path}\0`).join('') })
  mkdirSync(join(large, 'docs/nested'), { recursive: true })
  writeFileSync(join(large, 'docs/zz-tracked.md'), 'x'.repeat(32001))
  git(large, 'add', 'docs/zz-tracked.md')
  writeFileSync(join(large, 'docs/nested/untracked.md'), 'Guide\n'.repeat(401))
  writeFileSync(join(large, '.gitignore'), 'docs/ignored.md\n')
  writeFileSync(join(large, 'docs/ignored.md'), 'x'.repeat(32001))
  assert.deepEqual(checkDocs(large).map((finding) => finding.split(':')[0]).sort(), ['docs/nested/untracked.md', 'docs/zz-tracked.md'])

  const regions = fixture()
  git(regions, 'init', '-q')
  mkdirSync(join(regions, 'docs'))
  for (const generator of ['linear', 'planning']) {
    const generated = `<!-- ${generator}:generated:start -->\n${'Generated source\n'.repeat(500)}<!-- ${generator}:generated:end -->\n`
    writeFileSync(join(regions, 'docs/mixed.md'), generated)
    assert.deepEqual(checkDocs(regions), [])
    writeFileSync(join(regions, 'docs/mixed.md'), `Authored context\n${generated}Authored conclusion\n`)
    assert.deepEqual(checkDocs(regions), [])
    writeFileSync(join(regions, 'docs/mixed.md'), `Authored context\n${generated}Authored conclusion\n`.replaceAll('\n', '\r\n'))
    assert.deepEqual(checkDocs(regions), [])
    writeFileSync(join(regions, 'docs/mixed.md'), `${'Authored context\n'.repeat(200)}${generated}${'Authored conclusion\n'.repeat(201)}`)
    assert.match(checkDocs(regions)[0], /401\/400/)
    writeFileSync(join(regions, 'docs/mixed.md'), `${generated}${'x'.repeat(32001)}`)
    assert.match(checkDocs(regions)[0], /32001\/32000/)
    // Literal examples and malformed or unknown boundaries must not hide authored prose.
    for (const text of [
      `\`\`\`markdown\n${generated}\`\`\`\n`,
      `~~~~markdown\n${generated}~~~~\n`,
      generated.replace(':generated:end', ':generated:start'),
      generated.replace(`${generator}:generated:end`, 'unknown:generated:end'),
      generated.replaceAll(`${generator}:generated`, 'unknown:generated'),
      generated.replace('<!-- ', 'text <!-- '),
    ]) {
      writeFileSync(join(regions, 'docs/mixed.md'), text)
      assert.ok(checkDocs(regions).length > 0, text.slice(0, 100))
    }
  }
})

test('deployment proof accepts only the full intended live build-info commit', async () => {
  const sha = 'a'.repeat(40)
  const response = (commit) => async () => ({ ok: true, json: async () => ({ commit }) })
  assert.equal(await verifyBuild('https://example.invalid/build-info', sha, response(sha)), `Verified deployed build-info commit ${sha}.`)
  await assert.rejects(verifyBuild('https://example.invalid/build-info', sha, response('b'.repeat(40))), /does not match/)
  await assert.rejects(verifyBuild('https://example.invalid/build-info', 'main', response(sha)), /full intended/)
  await assert.rejects(verifyBuild('https://example.invalid/build-info', sha, async () => ({ ok: false, status: 503 })), /HTTP 503/)
  await assert.rejects(verifyBuild('http://example.invalid/build-info', sha, response(sha)), /HTTPS/)
})

const feature = { id: 'checkout', status: 'implemented', interfaces: ['cli:checkout'], command: ['node', '--test', 'checkout.test.mjs'], selector: 'checkout works', assertions: ['cart total equals 17'], evidence: ['log'] }
const markdown = `# Checkout\n\n\`\`\`verification\n${JSON.stringify(feature)}\n\`\`\`\n`
const context = { markdown, commit: 'a'.repeat(40), tree: 'b'.repeat(40), affected: ['checkout'] }
const proof = () => ({ version: 1, commit: context.commit, tree: context.tree, registryDigest: digest(markdown), synthetic: true, retentionDays: 7, audience: 'existing-artifact-audience', affected: ['checkout'], runs: [{ id: 'checkout', status: 'pass', command: feature.command, selector: feature.selector, tests: 1, assertions: [{ name: feature.assertions[0], passed: true }], exitCode: 0, startedAt: '2026-11-19T00:00:00Z', finishedAt: '2026-11-19T00:00:01Z', files: [{ kind: 'log', path: 'checkout.log', sha256: digest('total=17\n'), reviewed: true }] }] })

test('registry coverage uses an independent inventory and refuses empty or unknown selections', () => {
  const entries = parseRegistry(markdown)
  assert.equal(selectFeatures(entries, ['checkout'])[0].selector, 'checkout works')
  checkCoverage(entries, ['cli:checkout'])
  assert.throws(() => checkCoverage(entries, ['cli:checkout', 'ui:pay']), /ui:pay/)
  assert.throws(() => checkCoverage(entries, []), /inventory is empty/)
  assert.throws(() => selectFeatures(entries, []), /empty run/)
  assert.throws(() => selectFeatures(entries, ['invented']), /Unknown affected/)
  assert.throws(() => parseRegistry('# No proof'), /empty registry/)
  assert.throws(() => parseRegistry(markdown.replace('checkout works', '')), /nonempty test selector/)
  assert.throws(() => parseRegistry(markdown + markdown), /unique stable/)
})

test('evidence rejects empty proof, weakened assertions, widened selection and stale provenance', () => {
  assert.equal(checkManifest(proof(), context), true)
  for (const [mutate, diagnostic] of [
    [(manifest) => { manifest.runs = [] }, /exactly one/],
    [(manifest) => { manifest.runs[0].tests = 0 }, /empty proof/],
    [(manifest) => { manifest.runs[0].assertions = [] }, /every documented/],
    [(manifest) => { manifest.runs[0].assertions[0].passed = false }, /contradicts/],
    [(manifest) => { manifest.affected.push('other') }, /selection differs/],
    [(manifest) => { manifest.registryDigest = '0'.repeat(64) }, /stale/],
    [(manifest) => { manifest.tree = 'c'.repeat(40) }, /stale/],
    [(manifest) => { manifest.retentionDays = 90 }, /seven-day/],
    [(manifest) => { manifest.synthetic = false }, /synthetic/],
    [(manifest) => { manifest.runs[0].files[0].reviewed = false }, /review\/redact/],
    [(manifest) => { manifest.runs[0].files[0].path = '../secret.log' }, /relative allowlisted/],
    [(manifest) => { manifest.rawEnvironment = 'synthetic payload' }, /Unknown evidence field/],
    [(manifest) => { manifest.runs[0].assertions[0].rawOutput = 'synthetic payload' }, /Unknown evidence field/],
  ]) {
    const manifest = proof()
    mutate(manifest)
    assert.throws(() => checkManifest(manifest, context), diagnostic)
  }
  const blocked = proof()
  blocked.runs[0] = { id: 'checkout', status: 'blocked', reason: 'Disposable fixture unavailable', startedAt: '2026-11-19T00:00:00Z', finishedAt: '2026-11-19T00:00:00Z' }
  assert.equal(checkManifest(blocked, context), false)
  const failed = proof()
  failed.runs[0].status = 'fail'
  failed.runs[0].assertions[0].passed = false
  failed.runs[0].exitCode = 1
  assert.equal(checkManifest(failed, context), false)
})

test('evidence validation binds reviewed bytes rather than accepting a manifest alone', () => {
  const directory = fixture()
  writeFileSync(join(directory, 'checkout.log'), 'total=17\n')
  assert.equal(validateEvidence(directory, proof(), context), true)
  writeFileSync(join(directory, 'checkout.log'), 'total=0\n')
  assert.throws(() => validateEvidence(directory, proof(), context), /changed since review/)
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(proof()))
  const registry = join(fixture(), 'registry.md')
  const contextFile = join(fixture(), 'context.json')
  writeFileSync(registry, markdown)
  writeFileSync(contextFile, JSON.stringify(context))
  const result = spawnSync(process.execPath, ['templates/tools/verification/evidence.mjs', directory, registry, contextFile], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /changed since review/)
  writeFileSync(join(directory, 'checkout.log'), 'total=17\n')
  writeFileSync(join(directory, 'unreviewed.log'), 'synthetic unreviewed payload')
  assert.throws(() => validateEvidence(directory, proof(), context), /Unlisted evidence file/)
})
