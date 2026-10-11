/**
 * @file test/skills.test.mjs
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

// Skill front matter must be strict YAML. Agents that read it leniently
// accept a plain description holding ": " or " #", but strict parsers, such as
// the one in `npx skills`, reject the whole skill, so every repository the
// skills sync into would list them as broken. A plain scalar is safe only when
// it has neither; anything else is quoted.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const skillDirs = ['templates/.agents/skills', 'skills']

const skillFiles = () =>
  skillDirs.flatMap((dir) =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, dir, entry.name, 'SKILL.md')))
      .map((entry) => `${dir}/${entry.name}/SKILL.md`),
  )

// A top-level `key: value` line whose plain value strict YAML cannot read.
export const unsafePlainScalars = (frontMatter) =>
  frontMatter
    .split('\n')
    .map((line) => /^([a-z][\w-]*): (.+)$/.exec(line))
    .filter((match) => match !== null)
    .filter(([, , value]) => !/^['"|>[{]/.test(value) && (value.includes(': ') || value.includes(' #')))
    .map(([, key]) => key)

test('a plain scalar with ": " or " #" is reported, a quoted one is not', () => {
  assert.deepEqual(unsafePlainScalars('name: a\ndescription: Use it when: always'), ['description'])
  assert.deepEqual(unsafePlainScalars("name: a\ndescription: 'Use it when: always'"), [])
  assert.deepEqual(unsafePlainScalars('description: Tag it #1 here'), ['description'])
  assert.deepEqual(unsafePlainScalars('description: Plain words only'), [])
})

test('every house skill has front matter strict YAML parsers can read', () => {
  const files = skillFiles()
  assert.ok(files.length > 0)
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8')
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    assert.ok(match, `${file} has no front matter`)
    assert.deepEqual(unsafePlainScalars(match[1]), [], `${file}: quote these values`)
  }
})
