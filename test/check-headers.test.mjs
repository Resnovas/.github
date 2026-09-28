/**
 * @file test/check-headers.test.mjs
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
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkHeaders, headerFor } from '../templates/tools/license/check-headers.mjs'

const templates = fileURLToPath(new URL('../templates/', import.meta.url))
const year = String(new Date().getFullYear())

const repository = () => {
  const root = mkdtempSync(join(tmpdir(), 'headers-'))
  mkdirSync(join(root, 'tools/license'), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'tools/license/header.txt'), readFileSync(join(templates, 'tools/license/header.txt'), 'utf8').replace('{{LEGAL_HOLDER}}', 'Example Ltd'))
  return root
}

test('a file without a header, or with an old year, is reported and fixed with the current year and its path', () => {
  const root = repository()
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 1\n')
  const old = headerFor(readFileSync(join(root, 'tools/license/header.txt'), 'utf8'), 'src/b.ts', '2021')
  writeFileSync(join(root, 'src/b.ts'), `${old}\n\nexport const b = 2\n`)
  writeFileSync(join(root, 'src/c.ts'), `${headerFor(readFileSync(join(root, 'tools/license/header.txt'), 'utf8'), 'src/c.ts', year)}\n\nexport const c = 3\n`)
  const files = ['src/a.ts', 'src/b.ts', 'src/c.ts']
  assert.deepEqual(checkHeaders(root, { files }), { checked: 3, wrong: ['src/a.ts', 'src/b.ts'] })
  assert.deepEqual(checkHeaders(root, { files, fix: true }).wrong, ['src/a.ts', 'src/b.ts'])
  assert.deepEqual(checkHeaders(root, { files }), { checked: 3, wrong: [] })
  const b = readFileSync(join(root, 'src/b.ts'), 'utf8')
  assert.match(b, new RegExp(`^/\\*\\*\\n \\* @file src/b\\.ts\\n \\*\\n \\* Copyright ${year} Example Ltd\\.`))
  assert.equal(b.split('DELETING THIS NOTICE').length, 2)
  assert.match(b, /export const b = 2\n$/)
})

test('synced house files, typings, generated directories and ignore patterns are skipped, and a shebang stays first', () => {
  const root = repository()
  writeFileSync(join(root, 'src/synced.mjs'), '#!/usr/bin/env node\n// Synced from Resnovas/.github templates/tools/x.mjs. Edit it there.\nexport const x = 1\n')
  writeFileSync(join(root, 'src/types.d.ts'), 'export type T = string\n')
  mkdirSync(join(root, 'dist'))
  writeFileSync(join(root, 'dist/index.js'), 'module.exports = 1\n')
  writeFileSync(join(root, 'src/vendored.js'), 'var v = 1\n')
  writeFileSync(join(root, 'tools/license/ignore'), '# vendored\n^src/vendored\\.js$\n')
  writeFileSync(join(root, 'bin/run.mjs'.replace('bin/', '')), '#!/usr/bin/env node\nconsole.log(1)\n')
  const files = ['src/synced.mjs', 'src/types.d.ts', 'dist/index.js', 'src/vendored.js', 'run.mjs']
  assert.deepEqual(checkHeaders(root, { files }), { checked: 1, wrong: ['run.mjs'] })
  checkHeaders(root, { files, fix: true })
  const run = readFileSync(join(root, 'run.mjs'), 'utf8')
  assert.ok(run.startsWith('#!/usr/bin/env node\n/**\n * @file run.mjs\n'))
  assert.equal(readFileSync(join(root, 'src/synced.mjs'), 'utf8').includes('Copyright'), false)
})

test('every synced tool starts with the sync marker, so the header check skips it everywhere', () => {
  const tools = ['tools/license/check-headers.mjs', 'tools/ci/coverage-goal.ts', 'tools/ci/flaky-tests.ts', 'tools/test/file.ts', 'tools/typecheck/tests.ts', 'tools/dev/docs.ts', 'tools/dev/surfaces.mjs', 'tools/dev/open.mjs', 'tools/dev/commit-check.mjs', 'tools/ai-docs/docgen.mjs']
  for (const tool of tools) {
    const head = readFileSync(join(templates, tool), 'utf8').split('\n').slice(0, 6).join('\n')
    assert.match(head, /Synced from Resnovas\/\.github/, tool)
  }
  assert.ok(readdirSync(join(templates, 'tools/license')).includes('header.txt'))
})
