import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { list, parseValues } from '../scripts/lib/values.mjs'
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
