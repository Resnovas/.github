/**
 * @file test/values.test.mjs
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

// The house values reach templates two ways: house.yml renders this
// repository's root, and sync.values in smartcloud/house.yml is what
// smartcloud's sync renders every other repository with. These tests keep the
// two in step, keep the values in step with the preset's own settings, and
// check the templates render with the preset's values alone.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { list, loadValues, parseValues } from '../scripts/lib/values.mjs'
import { renderAll } from '../scripts/lib/render.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const templates = join(root, 'templates')
const house = loadValues(join(root, 'house.yml'))
const preset = readFileSync(join(root, 'smartcloud', 'house.yml'), 'utf8').split('\n')

// Root-only keys: smartcloud sets REPOSITORY itself, and sync.exclude is the
// preset's equivalent of HOUSE_EXCLUDE.
const ROOT_ONLY = new Set(['REPOSITORY', 'HOUSE_EXCLUDE'])

test('COPYRIGHT_YEAR is the current year, so LICENSE and the synced copies carry it', () => {
  assert.equal(house.COPYRIGHT_YEAR, String(new Date().getFullYear()))
})

// The lines nested under the first `<indent><key>:` found after `from`.
const block = (key, indent, from = 0) => {
  const start = preset.findIndex((line, index) => index >= from && line === `${' '.repeat(indent)}${key}:`)
  assert.notEqual(start, -1, `smartcloud/house.yml has no ${key}`)
  const lines = []
  for (const line of preset.slice(start + 1)) {
    if (line.trim() !== '' && line.search(/\S/) <= indent) break
    lines.push(line)
  }
  return { start, lines }
}

const syncValues = () => {
  const { start } = block('sync', 0)
  const { lines } = block('values', 2, start)
  return parseValues(lines.map((line) => line.trim()).join('\n'), 'smartcloud/house.yml sync.values')
}

// A YAML flow list of logins, such as [a, "b[bot]"].
const flowList = (key) => {
  const line = block('roles', 0).lines.find((entry) => entry.trim().startsWith(`${key}:`))
  assert.ok(line, `roles.${key} is missing`)
  return line
    .slice(line.indexOf('[') + 1, line.lastIndexOf(']'))
    .split(',')
    .map((item) => item.trim().replace(/^(['"])(.*)\1$/, '$2'))
    .filter(Boolean)
}

// Every creatorMatches regex under conventions.rules, by rule name.
const creatorPatterns = () => {
  const found = []
  let rule
  let creator = false
  for (const line of block('conventions', 0).lines) {
    rule = /^ {4}([\w-]+):\s*$/.exec(line)?.[1] ?? rule
    if (/type: creatorMatches/.test(line)) creator = true
    else if (creator && /^\s+condition:/.test(line)) {
      found.push({ rule, pattern: /condition: '(.*)'/.exec(line)?.[1] })
      creator = false
    }
  }
  return found
}

const escape = (login) => login.replace(/[\\[\]]/g, '\\$&')

test('sync.values holds the same keys and values as house.yml', () => {
  const shared = Object.fromEntries(Object.entries(house).filter(([key]) => !ROOT_ONLY.has(key)))
  assert.deepEqual(syncValues(), shared)
})

test('MAINTAINERS and TRUSTED_BOTS match the preset roles', () => {
  const values = syncValues()
  assert.deepEqual(list(values.MAINTAINERS), flowList('maintainers'))
  assert.deepEqual(list(values.TRUSTED_BOTS), flowList('trustedBots'))
})

test('CODE_SCANNING_GATE is true exactly when the preset gates merges on CodeQL', () => {
  const { lines } = block('codeScanning', 4, block('ruleset', 2).start)
  const gated = lines.some((line) => line.trim() === 'CodeQL:')
  assert.equal(syncValues().CODE_SCANNING_GATE, String(gated))
})

test('the title and house style rules exempt exactly the maintainers and trusted bots', () => {
  const maintainers = flowList('maintainers')
  const bots = flowList('trustedBots')
  const patterns = creatorPatterns()
  assert.ok(patterns.length > 0)
  for (const { rule, pattern } of patterns) {
    const expected =
      rule === 'title'
        ? `/^(${[...maintainers, ...bots].map(escape).join('|')})$/i`
        : rule === 'title-maintainer'
          ? `/^${maintainers.length === 1 ? maintainers[0] : `(${maintainers.join('|')})`}$/i`
          : `/^(${bots.map((bot) => bot.replace(/\[bot\]$/, '')).join('|')})\\[bot\\]$/i`
    assert.equal(pattern, expected, `conventions.rules.${rule}`)
  }
})

test('every template renders from the preset values alone, as the sync does', () => {
  const values = { ...syncValues(), REPOSITORY: 'Resnovas/example' }
  const rendered = renderAll(templates, values)
  const text = (path) => rendered.find((file) => file.path.replaceAll('\\', '/') === path).content
  assert.match(text('GOVERNANCE.md'), /The current maintainers are `TGTGamer`\./)
  assert.match(text('GOVERNANCE.md'), /`dependabot\[bot\], renovate\[bot\], github-actions\[bot\], resnovas-smartcloud\[bot\]`/)
  assert.match(text('GOVERNANCE.md'), /the CodeQL merge gate, which is `true` here/)
  assert.match(text('DCO.md'), /`dependabot\[bot\],/)
  assert.match(text('.github/smartcloud.yml'), /#\s+roles\.maintainers\s+TGTGamer\n/)
})

test('an override replaces the maintainers and trusted bots wherever they are named', () => {
  const values = { ...house, MAINTAINERS: 'alice, bob', TRUSTED_BOTS: 'renovate[bot]', CODE_SCANNING_GATE: 'false' }
  const rendered = renderAll(templates, values)
  const all = rendered.map((file) => file.content).join('\n')
  assert.doesNotMatch(all, /TGTGamer`/)
  assert.doesNotMatch(all, /dependabot\[bot\], renovate/)
  const governance = rendered.find((file) => file.path === 'GOVERNANCE.md').content
  assert.match(governance, /The current maintainers are `alice, bob`\./)
  assert.match(governance, /automation accounts .*: `renovate\[bot\]`\./)
  assert.match(governance, /which is `false` here/)
})

test('a template placeholder without a value fails the render, as it fails the sync', () => {
  for (const key of ['MAINTAINERS', 'TRUSTED_BOTS', 'CODE_SCANNING_GATE']) {
    const values = { ...house }
    delete values[key]
    assert.throws(() => renderAll(templates, values), new RegExp(`no value for \\{\\{${key}\\}\\}`))
  }
})

test('project type and environments are per repository: defaults when unset, the value when set', () => {
  for (const key of ['PROJECT_TYPE', 'ENVIRONMENTS']) {
    assert.ok(!(key in house), `house.yml sets ${key}`)
    assert.ok(!(key in syncValues()), `sync.values would lock ${key} for every repository`)
  }
  const governance = (values) => renderAll(templates, values).find((file) => file.path === 'GOVERNANCE.md').content
  assert.match(governance(house), /ships as `none`, with the environments `that its project type implies`/)
  assert.match(
    governance({ ...house, PROJECT_TYPE: 'library', ENVIRONMENTS: 'Release' }),
    /ships as `library`, with the environments `Release`/,
  )
})
