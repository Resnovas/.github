/**
 * @file test/render.test.mjs
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
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { list, loadValues, parseValues } from '../scripts/lib/values.mjs'
import { renderAll, renderText } from '../scripts/lib/render.mjs'

test('values parse flat keys, strip comments and one pair of quotes', () => {
  const values = parseValues('# heading\nORG_NAME: Resnovas  # trailing\nURL: "https://x.io/#a"\n\nEMPTY:\n')
  assert.deepEqual(values, { ORG_NAME: 'Resnovas', URL: 'https://x.io/#a', EMPTY: '' })
})

test('values reject anything that is not KEY: value', () => {
  assert.throws(() => parseValues('lower: nope', 'house.yml'), /house.yml:1/)
  assert.throws(() => parseValues('- a list'), /expected "KEY: value"/)
})

test('lists split on commas and drop blanks', () => {
  assert.deepEqual(list(' a, b ,, c '), ['a', 'b', 'c'])
  assert.deepEqual(list(undefined), [])
})

test('placeholders are replaced and unknown keys are an error', () => {
  assert.equal(renderText('(c) {{YEAR}} {{WHO}}', { YEAR: '2026', WHO: 'R' }), '(c) 2026 R')
  assert.throws(() => renderText('{{MISSING}}', {}, 'LICENSE'), /LICENSE: no value for \{\{MISSING\}\}/)
})

test('renderAll walks nested templates and keeps relative paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'house-'))
  mkdirSync(join(root, '.github', 'ISSUE_TEMPLATE'), { recursive: true })
  writeFileSync(join(root, 'README.md'), '= {{ORG_NAME}}\n')
  writeFileSync(join(root, '.github', 'ISSUE_TEMPLATE', 'bug.yml'), 'name: {{ORG_NAME}} bug\n')
  const rendered = renderAll(root, { ORG_NAME: 'Resnovas' })
  assert.deepEqual(rendered, [
    { path: join('.github', 'ISSUE_TEMPLATE', 'bug.yml'), content: 'name: Resnovas bug\n' },
    { path: 'README.md', content: '= Resnovas\n' },
  ])
})

test('loadValues reads a file, and a missing file is an error unless optional', async () => {
  const { loadValues } = await import('../scripts/lib/values.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'house-'))
  writeFileSync(join(dir, 'house.yml'), 'ORG_NAME: Resnovas\n')
  assert.deepEqual(loadValues(join(dir, 'house.yml')), { ORG_NAME: 'Resnovas' })
  assert.deepEqual(loadValues(join(dir, 'absent.yml'), { optional: true }), {})
  assert.throws(() => loadValues(join(dir, 'absent.yml')), /values file not found/)
})

test('sync renders Verify host mirrors that the surface generator accepts without replacing local prompts', (context) => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const scratch = join(root, '.amp/in/orb-backup')
  mkdirSync(scratch, { recursive: true })
  const fixture = mkdtempSync(join(scratch, 'verify-mirrors-'))
  context.after(() => rmSync(fixture, { recursive: true, force: true }))
  const rendered = renderAll(join(root, 'templates'), loadValues(join(root, 'house.yml')))
    .map(({ path, content }) => ({ path: path.replaceAll('\\', '/'), content }))
  const mirrors = ['.claude/commands/verify.md', '.cursor/commands/verify.md']
  for (const path of mirrors) assert.ok(rendered.some((file) => file.path === path), `sync must render ${path}`)
  for (const { path, content } of rendered) {
    mkdirSync(dirname(join(fixture, path)), { recursive: true })
    writeFileSync(join(fixture, path), content)
  }
  const local = '---\nlabel: Local proof\ndescription: Exercise a repository-only command\n---\n\nRun the local proof.\n'
  writeFileSync(join(fixture, '.agents/prompts/local-proof.md'), local)
  const run = (command) => spawnSync(process.execPath, ['tools/dev/surfaces.mjs', command], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, CI: 'true' },
  })
  // Bootstrap unrelated skill/MCP outputs, then put the proposed sync bytes back before checking.
  const synced = run('sync')
  assert.equal(synced.status, 0, synced.stderr)
  const localMirrors = mirrors.map((path) => path.replace('verify.md', 'local-proof.md'))
  const preserved = localMirrors.map((path) => readFileSync(join(fixture, path), 'utf8'))
  for (const path of mirrors) writeFileSync(join(fixture, path), rendered.find((file) => file.path === path).content)
  const checked = run('check')
  assert.equal(checked.status, 0, checked.stderr)

  // A source-only update must reject both stale host templates, not establish a second authority.
  const source = join(fixture, '.agents/prompts/verify.md')
  const original = readFileSync(source, 'utf8')
  writeFileSync(source, `${original}\nChanged source contract.\n`)
  const staleSource = run('check')
  assert.equal(staleSource.status, 1, staleSource.stderr)
  for (const path of mirrors) assert.ok(staleSource.stderr.includes(path), staleSource.stderr)
  writeFileSync(source, original)
  for (const path of mirrors) {
    const target = join(fixture, path)
    const content = readFileSync(target, 'utf8')
    writeFileSync(target, `${content}\nStale host-only change.\n`)
    const staleHost = run('check')
    assert.equal(staleHost.status, 1, staleHost.stderr)
    assert.ok(staleHost.stderr.includes(path), staleHost.stderr)
    writeFileSync(target, content)
  }
  const final = run('check')
  assert.equal(final.status, 0, final.stderr)
  assert.equal(readFileSync(join(fixture, '.agents/prompts/local-proof.md'), 'utf8'), local)
  assert.deepEqual(localMirrors.map((path) => readFileSync(join(fixture, path), 'utf8')), preserved)
})
