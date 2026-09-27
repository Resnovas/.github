import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listTemplates, renderText } from '../scripts/lib/render.mjs'
import { loadValues } from '../scripts/lib/values.mjs'
import { mergeManaged, splitManaged } from '../scripts/lib/managed.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const templates = join(root, 'templates')
const values = loadValues(join(root, 'house.yml'))
const rendered = (path) => renderText(readFileSync(join(templates, path), 'utf8'), values, path)

// A throwaway repository with the synced generator, the synced house section
// and the given files, removed after the test.
function repository(t, files) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-docs-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  cpSync(join(templates, 'tools/ai-docs/docgen.mjs'), join(dir, 'tools/ai-docs/docgen.mjs'))
  const all = { 'ai-docs/src/05_house-standards/index.md': rendered('ai-docs/src/05_house-standards/index.md'), ...files }
  for (const [path, content] of Object.entries(all)) {
    if (content === null) continue
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}

const docgen = (dir, ...args) => spawnSync(process.execPath, [join(dir, 'tools/ai-docs/docgen.mjs'), ...args], { encoding: 'utf8' })
const llms = (dir) => readFileSync(join(dir, 'LLMS.md'), 'utf8')

const example = [
  '/*',
  ' * Licence header, the same in every file.',
  ' */',
  '',
  '/**',
  ' * @title Decode before use',
  ' *',
  ' * Input from outside is decoded, never cast.',
  ' * @since 1.0.0',
  ' */',
  'import { Schema } from "effect"',
  '',
  'export const decode = Schema.decodeUnknown(Schema.String)',
  '',
].join('\n')

const sample = {
  'package.json': JSON.stringify({ name: '@resnovas/sample' }),
  'ai-docs/src/10_overview/index.md': '## Overview\n\nWhat the sample is.\n',
  'ai-docs/src/20_inputs/index.md': '## Inputs\r\n\r\nWindows line endings.\r\n',
  'ai-docs/src/20_inputs/20_plain.ts': 'export const plain = 1\n',
  'ai-docs/src/20_inputs/10_decode.ts': example,
  'ai-docs/src/20_inputs/fixtures/helper.ts': 'export const helper = 1\n',
  'ai-docs/src/fixtures/index.md': '## Never rendered\n',
}

test('docgen assembles LLMS.md from the sections, in order', (t) => {
  const dir = repository(t, sample)
  const result = docgen(dir)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /from 3 section\(s\) and 2 example\(s\)/)
  const out = llms(dir)

  assert.match(out, /^<!--\n {2}Generated from ai-docs\/src by tools\/ai-docs\/docgen\.mjs/)
  assert.match(out, /\n# @resnovas\/sample for agents\n/)
  const order = ['## House standards', '## Overview', '## Inputs', '### Decode before use', '### plain']
  const positions = order.map((heading) => out.indexOf(`\n${heading}\n`))
  assert.ok(positions.every((at) => at > 0), `missing a heading: ${positions}`)
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)

  // The JSDoc header becomes the text, tags and licence header are dropped.
  assert.match(out, /### Decode before use\n\nInput from outside is decoded, never cast\.\n\n```ts\nimport \{ Schema \}/)
  assert.doesNotMatch(out, /@since|@title|Licence header/)
  // Synced markers, fixtures and Windows line endings do not reach the output.
  assert.doesNotMatch(out, /house:managed|house:local|Never rendered|helper|\r/)
  assert.doesNotMatch(out, /\n{3}/)
  assert.ok(out.endsWith('```\n'))
})

test('docgen is deterministic and --check passes on fresh output', (t) => {
  const dir = repository(t, sample)
  docgen(dir)
  const first = llms(dir)
  docgen(dir)
  assert.equal(llms(dir), first)
  const check = docgen(dir, '--check')
  assert.equal(check.status, 0, check.stderr)
  assert.match(check.stdout, /LLMS\.md is up to date/)
})

test('--check fails when LLMS.md is stale or missing, and never writes it', (t) => {
  const dir = repository(t, sample)
  const missing = docgen(dir, '--check')
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /LLMS\.md is missing/)

  docgen(dir)
  writeFileSync(join(dir, 'ai-docs/src/10_overview/index.md'), '## Overview\n\nChanged.\n')
  const before = llms(dir)
  const stale = docgen(dir, '--check')
  assert.equal(stale.status, 1)
  assert.match(stale.stderr, /LLMS\.md is out of date/)
  assert.equal(llms(dir), before)
})

test('a licence header opened with /** is dropped, not read as the example header', (t) => {
  const header = ['/**', ' * @file 10_decode.ts', ' * Licence header, the same in every file.', ' */', ''].join('\n')
  const dir = repository(t, { ...sample, 'ai-docs/src/20_inputs/10_decode.ts': header + example.split('*/\n\n').slice(1).join('*/\n\n') })
  assert.equal(docgen(dir).status, 0)
  const out = llms(dir)
  assert.match(out, /### Decode before use\n\nInput from outside is decoded, never cast\.\n\n```ts\nimport \{ Schema \}/)
  assert.doesNotMatch(out, /@file|Licence header|### decode\n/)
})

test('sections and examples order by their numeric prefix, so 100_ follows 20_', (t) => {
  const dir = repository(t, {
    ...sample,
    'ai-docs/src/100_last/index.md': '## Last\n',
    'ai-docs/src/20_inputs/100_later.ts': '/**\n * @title Later\n */\nexport const later = 1\n',
  })
  assert.equal(docgen(dir).status, 0)
  const out = llms(dir)
  assert.ok(out.indexOf('## Last') > out.indexOf('### Decode before use'), 'section 100_ comes last')
  assert.ok(out.indexOf('### Later') > out.indexOf('### Decode before use'), 'example 100_ comes after 10_')
})

test('example code is kept exactly: blank lines, and backticks inside a longer fence', (t) => {
  const body = ['export const text = `a', '', '', '', 'b`', '/*', '```', '*/'].join('\n')
  const dir = repository(t, { ...sample, 'ai-docs/src/20_inputs/30_verbatim.ts': `/**\n * @title Verbatim\n */\n${body}\n` })
  assert.equal(docgen(dir).status, 0)
  const four = '`'.repeat(4)
  assert.ok(llms(dir).includes(`### Verbatim\n\n${four}ts\n${body}\n${four}\n`))
})

test('without a package.json name the title is the directory name', (t) => {
  const dir = repository(t, { 'package.json': '{"private":true}', 'ai-docs/src/10_overview/index.md': '## Overview\n' })
  assert.equal(docgen(dir).status, 0)
  assert.match(llms(dir), new RegExp(`\n# ${basename(dir)} for agents\n`))
})

test('a section without index.md, or no sections at all, is an error', (t) => {
  const noIndex = repository(t, { 'ai-docs/src/10_overview/10_a.ts': 'export {}\n' })
  const result = docgen(noIndex)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ai-docs\/src\/10_overview has no index\.md/)

  const empty = repository(t, { 'ai-docs/src/05_house-standards/index.md': null })
  assert.match(docgen(empty).stderr, /no ai-docs\/src directory/)
  mkdirSync(join(empty, 'ai-docs/src/fixtures'), { recursive: true })
  assert.match(docgen(empty).stderr, /no sections under ai-docs\/src/)
})

test('the synced ai-docs files keep what a repository adds after house:local', () => {
  for (const path of ['ai-docs/README.md', 'ai-docs/src/05_house-standards/index.md']) {
    const template = rendered(path)
    assert.ok(splitManaged(template), `${path} has a managed block`)
    const local = `${template}\n### Our own rule\n\nKept.\n`
    const next = template.replace('## House standards', '## House standards (updated)').replace('# ai-docs', '# ai-docs (updated)')
    const merged = mergeManaged(next, local, path)
    assert.match(merged, /### Our own rule\n\nKept\./, path)
    assert.equal(splitManaged(merged).block.join('\n'), splitManaged(next).block.join('\n'), path)
  }
})

// Prettier would reformat a synced Markdown, YAML, JSON or script file and so
// edit its managed block, failing the sync check; the synced .prettierignore
// lists every one, and LLMS.md, which its generator formats.
test('the synced .prettierignore covers every template Prettier formats, and LLMS.md', () => {
  const patterns = rendered('.prettierignore')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.trim())
  const matches = (path) =>
    patterns.some((pattern) => {
      if (pattern.endsWith('/')) return path.startsWith(pattern)
      const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`)
      return regex.test(path)
    })
  const formatted = /\.(md|ya?ml|jsonc?|m?js|ts|toml|xml)$|^[^.]+$/
  const paths = listTemplates(templates)
    .map((path) => path.split('\\').join('/'))
    .filter((path) => path !== '.prettierignore' && formatted.test(basename(path)))
  assert.deepEqual(paths.filter((path) => !matches(path)), [])
  assert.ok(matches('LLMS.md'))
})
