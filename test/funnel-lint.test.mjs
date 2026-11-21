/**
 * @file test/funnel-lint.test.mjs
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
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { ESLint, Linter } from 'eslint'
import { funnel, contracts } from '../tools/lint/funnel.mjs'
import { reactLifecycle, reactUiTimers } from '../tools/lint/react.mjs'
import { headerFor } from '../templates/tools/license/check-headers.mjs'
import { renderAll } from '../scripts/lib/render.mjs'
import { loadValues } from '../scripts/lib/values.mjs'

const lint = (code, config = funnel) => new Linter().verify(code, [{ ...config, languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } }])

// Exercise real TypeScript ASTs using the parser already locked under the approved JSDoc dependency.
// Consumers supply their own ESLint parser; this test adapter adds no production parser or dependency.
const jsdocRequire = createRequire(import.meta.resolve('eslint-plugin-jsdoc'))
const typescriptRequire = createRequire(jsdocRequire.resolve('@typescript-eslint/utils'))
const { parse } = typescriptRequire('@typescript-eslint/typescript-estree')
const { analyze } = typescriptRequire('@typescript-eslint/scope-manager')
const { visitorKeys } = createRequire(typescriptRequire.resolve('@typescript-eslint/typescript-estree'))('@typescript-eslint/visitor-keys')
const parser = {
  parseForESLint(code) {
    const ast = parse(code, { comment: true, tokens: true, loc: true, range: true, filePath: 'contract.ts' })
    return { ast, visitorKeys, scopeManager: analyze(ast, { sourceType: 'module' }) }
  },
}
const lintContract = (code, { cwd = process.cwd(), filename = 'contract.js' } = {}) => new Linter({ cwd }).verify(code, [{ ...contracts, languageOptions: { parser, sourceType: 'module' } }], { filename })
const documented = (description, tags, declaration) => `/**\n * ${description}\n${tags ? ` *\n${tags.split('\n').map((line) => ` * ${line}`).join('\n')}\n` : ''} */\n${declaration}`

test('opt-in React lint preserves corrective lifecycle and lexical timer contracts', () => {
  const lifecycleMessage = 'Initialize app-owned services in bootstrap before rendering product content. Derive render state or update its owner from events; use named React imports, never useEffect.'
  const timerMessage = 'Do not defer UI state with a zero-delay timer. Keep state in one owner and update it from the event; use scoped Effect scheduling for genuine timed work.'
  for (const [code, ruleId] of [
    ["import { useEffect } from 'react'", 'no-restricted-imports'],
    ["import { useEffect as effect } from 'react'", 'no-restricted-imports'],
    ["export { useEffect } from 'react'", 'no-restricted-imports'],
    ["export * from 'react'", 'no-restricted-imports'],
    ["import * as React from 'react'; React.useEffect(work)", 'no-restricted-imports'],
    ["import React from 'react'; React.useEffect(work)", 'no-restricted-imports'],
    ["import('react')", 'no-restricted-syntax'],
    ["const React = require('react')", 'no-restricted-modules'],
  ]) {
    const messages = lint(code, reactLifecycle)
    assert.ok(messages.some((item) => item.ruleId === ruleId && item.severity === 2 && item.message.endsWith(lifecycleMessage)), JSON.stringify({ code, messages }))
    assert.deepEqual(lint(code), [], 'the base set must remain opt-in')
  }
  for (const code of [
    "import { useState, useSyncExternalStore, createElement } from 'react'",
    "import { useEffect } from './owned.js'",
    "import('./owned.js')",
    "const owned = require('./owned.js')",
  ]) assert.deepEqual(lint(code, reactLifecycle), [], code)

  for (const code of [
    'setTimeout(done, 0)', 'setTimeout(done)', 'setTimeout(done, -0, value)',
    'globalThis.setTimeout(done, 0)', 'window["setTimeout"](done, 0)',
    'self.setTimeout(done, -0)', 'globalThis.setTimeout?.(done, +0)',
    'window?.setTimeout(done, 0)', 'setTimeout?.(done, 0)',
  ]) {
    const messages = lint(code, reactUiTimers)
    assert.deepEqual(messages.map(({ ruleId, message, severity }) => ({ ruleId, message, severity })), [{ ruleId: 'house-react/no-zero-delay-ui-timer', message: timerMessage, severity: 2 }], code)
    assert.deepEqual(lint(code), [], 'the base set must not activate UI timer policy')
  }
  for (const code of [
    'setTimeout(done, 25)', 'window.setTimeout(done, 25)', 'setTimeout(done, delay)',
    'setTimeout(...args)', 'setTimeout(done, 0, ...args)', 'setTimeout()', 'updateOwner(value)',
    'function run(setTimeout) { setTimeout(done, 0) }',
    'function run(window) { window.setTimeout(done, 0) }',
    'const self = owned; function run() { self.setTimeout(done, 0) }',
    'const globalThis = owned; globalThis.setTimeout(done, 0)',
    'scheduler.setTimeout(done, 0)', 'window[method](done, 0)',
  ]) assert.deepEqual(lint(code, reactUiTimers), [], code)
})

test('React opt-in composition retains consumer restrictions and UI-only timer scope', () => {
  const lifecycle = reactLifecycle.rules
  const config = [
    { files: ['**/*.{ts,tsx,mts,js,mjs}'], languageOptions: { parser }, rules: {
      ...lifecycle,
      'no-restricted-imports': ['error', { ...lifecycle['no-restricted-imports'][1], paths: [
        ...lifecycle['no-restricted-imports'][1].paths,
        { name: 'zod', message: 'Use effect/Schema.' },
      ], patterns: [{ group: ['node:*'], message: 'Take platform services from the caller.' }] }],
    } },
    { files: ['packages/**/src/**/*.ts'], rules: {
      'no-restricted-syntax': [...lifecycle['no-restricted-syntax'], { selector: 'ExportAllDeclaration', message: 'No barrels: export each name explicitly.' }],
    } },
    { ...reactUiTimers, files: ['apps/client/**/*.tsx', 'apps/client/**/*.ts', 'packages/ui-modules/src/**/*.{ts,tsx}'] },
  ]
  const check = (code, filename) => new Linter().verify(code, config, { filename })
  for (const path of ['apps/client/view.tsx', 'packages/ui-modules/src/view.ts', 'apps/server/main.ts', 'packages/runtime/src/main.ts', 'tests/probe.mts']) {
    for (const [code, ruleId, message] of [
      ["import { useEffect } from 'react'", 'no-restricted-imports', 'use named React imports, never useEffect.'],
      ["import('react')", 'no-restricted-syntax', 'use named React imports, never useEffect.'],
      ["const React = require('react')", 'no-restricted-modules', 'use named React imports, never useEffect.'],
      ["import z from 'zod'", 'no-restricted-imports', 'Use effect/Schema.'],
      ["import fs from 'node:fs'", 'no-restricted-imports', 'Take platform services from the caller.'],
    ]) assert.ok(check(code, path).some((item) => item.ruleId === ruleId && item.message.endsWith(message)), `${path}: ${code}`)
    assert.deepEqual(check("import { useSyncExternalStore } from 'react'", path), [], path)
  }
  for (const path of ['apps/client/view.tsx', 'packages/ui-modules/src/view.ts']) {
    assert.deepEqual(check('setTimeout(done, 0)', path).map((item) => item.ruleId), ['house-react/no-zero-delay-ui-timer'])
    assert.deepEqual(check('setTimeout(done, 25)', path), [])
  }
  assert.deepEqual(check('setTimeout(done, 0)', 'apps/server/main.ts'), [])
  assert.deepEqual(check("export * from './owned.js'", 'packages/ui-modules/src/view.ts').map((item) => item.message), ['No barrels: export each name explicitly.'])
})

test('source-absence lint rejects source inspections while allowing behavior and redaction assertions', () => {
  const invalid = [
    "assert.doesNotMatch(readFileSync('src/main.ts', 'utf8'), /oldSymbol/)",
    "const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'); assert.equal(source.includes('old'), false)",
    "assert.equal(fs.existsSync('src/removed.ts'), false)",
    "const path = 'src/main.ts'; const source = readFileSync(path, 'utf8'); expect(source).not.toContain('old')",
    "const source = readFileSync('src/main.ts', 'utf8'); if (!source.includes('old')) context.report({message:'gone'})",
    "assert.doesNotMatch(context.sourceCode.getText(), /oldSymbol/)",
    "import { readFileSync as read } from 'node:fs'; assert.doesNotMatch(read('src/main.ts','utf8'), /old/)",
    "assert.equal(readFileSync(`${root}/main.ts`, 'utf8').includes('old'), false)",
    "function fixture() { writeFileSync('src/main.ts', 'new') }; assert.equal(readFileSync('src/main.ts','utf8').includes('old'), false)",
  ]
  for (const code of invalid) {
    const messages = lint(code)
    assert.ok(messages.some((item) => item.ruleId === 'house/no-source-absence'), JSON.stringify({ code, messages }))
    assert.match(messages.find((item) => item.ruleId === 'house/no-source-absence').message, /Execute the affected public path/)
  }
  for (const code of [
    "assert.equal(render({flag:false}).bannerVisible, false)",
    "expect(render({flag:false}).banner).not.toBeVisible()",
    "assert.doesNotMatch(redact('synthetic-secret'), /synthetic-secret/)",
    "const source = runCli(); assert.equal(source.includes('secret'), false)",
    "assert.doesNotMatch(readFileSync('output.log', 'utf8'), /secret/)",
    "assert.match(readFileSync('src/main.ts','utf8'), /copyright/)",
    "writeFileSync('fixture.ts', 'export const value = 1'); transform('fixture.ts'); assert.doesNotMatch(readFileSync('fixture.ts','utf8'), /secret/)",
    "const bundle = join(root, 'bundle.mjs'); writeFileSync(bundle, 'console.log(1)'); redact(bundle); assert.doesNotMatch(readFileSync(bundle,'utf8'), /sourceMappingURL/)",
  ]) assert.deepEqual(lint(code), [], code)
})

test('JSDoc rejects name restatements and missing contracts while accepting purpose and constraints', () => {
  const restatement = lint('/** Runs the main entry point. */\nfunction runMain() {}', contracts)
  assert.ok(restatement.some((item) => item.ruleId === 'jsdoc/informative-docs'), JSON.stringify(restatement))
  assert.ok(lint('function total() { return 17 }', contracts).some((item) => item.ruleId === 'jsdoc/require-jsdoc'))
  assert.deepEqual(lint('/** Release scoped resources before the process exits, including on cancellation. */\nfunction runMain() {}', contracts), [])

  const purpose = 'Preserve caller ownership while selecting the first available value.'
  const callable = 'function first(value: number): number { return value }'
  const tags = '@param value - Candidate supplied by the caller.\n@returns The unchanged candidate.'
  const complete = documented(purpose, tags, callable)
  const idle = documented('Release scoped resources before shutdown, including cancellation.', '', 'function dispose() {}')
  const generic = 'function first<T>(value: T): T { return value }'
  const throwing = 'function reject(): never { throw new RangeError("Invalid range") }'
  const cases = [
    ['require-jsdoc', callable, complete],
    ['require-description', documented('', tags, callable), complete],
    ['informative-docs', '/** Runs the main entry point. */\nfunction runMain() {}', idle],
    ['no-blank-block-descriptions', complete.replace('/**\n', '/**\n *\n'), complete],
    ['require-param', documented(purpose, '@returns The unchanged candidate.', callable), complete],
    ['require-param-description', documented(purpose, '@param value\n@returns The unchanged candidate.', callable), complete],
    ['check-param-names', documented(purpose, tags.replace('@param value', '@param other'), callable), complete],
    ['require-returns', documented(purpose, '@param value - Candidate supplied by the caller.', callable), complete],
    ['require-returns-description', documented(purpose, '@param value - Candidate supplied by the caller.\n@returns', callable), complete],
    ['check-tag-names', documented(purpose, `${tags}\n@unknownTag`, callable), complete],
    ['no-types', documented(purpose, tags.replace('@param value', '@param {number} value'), callable), complete],
    ['valid-types', documented('Reject invalid ranges before they enter storage.', '@throws {Array<} Invalid range cannot enter storage.', throwing), documented('Reject invalid ranges before they enter storage.', '@throws {RangeError} Invalid range cannot enter storage.', throwing)],
    ['require-template', documented(purpose, tags, generic), documented(purpose, `@template T - Candidate type preserved without coercion.\n${tags}`, generic)],
    ['empty-tags', documented(purpose, `${tags}\n@readonly text`, callable), documented(purpose, `${tags}\n@readonly`, callable)],
    ['check-alignment', complete.replace(' * @param', '   * @param'), complete],
    ['multiline-blocks', `/** ${purpose}\n */\nfunction dispose() {}`, idle],
    ['tag-lines', complete.replace(' *\n * @param', ' * @param'), complete],
    ['match-description', documented('select caller value', tags, callable), complete],
    ['require-example', documented(purpose, tags, `export ${callable}`), documented(purpose, `${tags}\n@example first(17) // 17`, `export ${callable}`)],
  ]
  const ruleId = (rule) => `${['require-description', 'match-description'].includes(rule) ? 'house' : 'jsdoc'}/${rule}`
  const canonical = headerFor(readFileSync('tools/license/header.txt', 'utf8'), 'contract.js', String(new Date().getFullYear()))
  for (const [rule, rejected, accepted] of cases) {
    const messages = lintContract(rejected)
    assert.ok(messages.some((item) => item.ruleId === ruleId(rule)), JSON.stringify({ rule, messages }))
    assert.deepEqual(lintContract(accepted), [], `${rule}: ${accepted}`)
    assert.ok(lintContract(`${canonical}\n\n${rejected}`).some((item) => item.ruleId === ruleId(rule)), `${rule}: a canonical header must not exempt the declaration`)
    assert.deepEqual(lintContract(`${canonical}\n\n${accepted}`), [], `${rule}: a canonical header must not add findings`)
  }
  // A removed rule must not silently leave its fixture behind, nor may a new rule go unexercised.
  assert.deepEqual(cases.map(([rule]) => ruleId(rule)).sort(), Object.entries(contracts.rules).filter(([, value]) => value !== 'off').map(([name]) => name).sort())

  // Effect failures travel in the typed error channel, so a throwing body needs no @throws contract.
  assert.equal(contracts.rules['jsdoc/require-throws'], 'off')
  assert.deepEqual(lintContract(documented('Reject invalid ranges before they enter storage.', '', throwing)), [])
  // A repository overrides the shared set with a later entry for the same files, without editing the module.
  const banned = ['error', { contexts: [{ comment: 'JsdocBlock:has(JsdocTag[tag=/^(?:throws|exception|author|license)$/])', context: 'any', message: 'Do not use @throws, @author or @license.' }] }]
  const overridden = (code) => new Linter().verify(code, [{ ...contracts, languageOptions: { parser, sourceType: 'module' } }, { rules: { 'jsdoc/no-restricted-syntax': banned } }], { filename: 'contract.js' })
  for (const tag of ['@throws {RangeError} Invalid range cannot enter storage.', '@exception {RangeError} Invalid range cannot enter storage.', '@author Someone', '@license MIT']) {
    const messages = overridden(documented('Reject invalid ranges before they enter storage.', tag, throwing))
    assert.ok(messages.some((item) => item.ruleId === 'jsdoc/no-restricted-syntax' && item.message === 'Do not use @throws, @author or @license.'), JSON.stringify({ tag, messages }))
  }
  assert.deepEqual(overridden(documented('Reject invalid ranges before they enter storage.', '', throwing)), [])

  for (const fragment of ['select caller value.', 'Select caller value']) {
    assert.ok(lintContract(documented(fragment, tags, callable)).some((item) => item.ruleId === 'house/match-description'))
  }
  assert.ok(lintContract(documented(purpose, tags.replace('Candidate supplied by the caller.', 'Candidate supplied by the caller'), callable)).some((item) => item.ruleId === 'house/match-description'))

  for (const [bare, attached] of [
    ['function dispose() {}', idle],
    ['const dispose = () => {}', '/** Release scoped resources before shutdown. */\nconst dispose = () => {}'],
    ['const dispose = function () {}', '/** Release scoped resources before shutdown. */\nconst dispose = function () {}'],
    ['schedule(() => {})', 'schedule(/** Release scoped resources before shutdown. */ () => {})'],
    ['schedule(function () {})', 'schedule(/** Release scoped resources before shutdown. */ function () {})'],
    ['class Session {}', '/** Own scoped resources until cancellation or shutdown. */\nclass Session {}'],
    ['const Session = class {}', '/** Own scoped resources until cancellation or shutdown. */\nconst Session = class {}'],
    ['/** Own scoped resources until shutdown. */\nclass Session { dispose() {} }', '/** Own scoped resources until shutdown. */\nclass Session {\n/** Release handles before cancellation completes. */\ndispose() {}\n}'],
    ['interface Session {}', '/** Own scoped resources until cancellation or shutdown. */\ninterface Session {}'],
    ['type Session = string', '/** Identify a scoped resource without exposing its contents. */\ntype Session = string'],
    ['/** Own scoped resources until shutdown. */\ninterface Session { dispose(): void }', '/** Own scoped resources until shutdown. */\ninterface Session {\n/** Release handles before cancellation completes. */\ndispose(): void\n}'],
    ['declare function dispose(): void', '/** Release scoped resources before shutdown. */\ndeclare function dispose(): void'],
  ]) {
    const messages = lintContract(bare)
    assert.ok(messages.some((item) => item.ruleId === 'jsdoc/require-jsdoc'), JSON.stringify({ bare, messages }))
    assert.deepEqual(lintContract(attached), [], attached)
  }

  for (const declaration of [
    'export function dispose() {}',
    'export default function dispose() {}',
    'export const dispose = () => {}',
    'export const dispose = function () {}',
    'export const timeout = 17',
    'export const dispose = createDisposer()',
    'export default createDisposer()',
    'export class Session {}',
    'export interface Session {}',
    'export type Session = string',
    'export { dispose } from "./scoped.js"',
    'export * from "./scoped.js"',
    'export default dispose',
  ]) {
    assert.ok(lintContract(declaration).some((item) => item.ruleId === 'jsdoc/require-jsdoc'), `public boundary: ${declaration}`)
    const rejected = documented('Preserve scoped resources until cancellation completes.', '', declaration)
    assert.ok(lintContract(rejected).some((item) => item.ruleId === 'jsdoc/require-example'), rejected)
    const accepted = documented('Preserve scoped resources until cancellation completes.', '@example\n// Use a scoped resource until cancellation.', declaration)
    assert.deepEqual(lintContract(accepted), [], accepted)
  }
  const publicFunction = documented(purpose, `${tags}\n@public`, callable)
  assert.ok(lintContract(publicFunction).some((item) => item.ruleId === 'jsdoc/require-example'))
  assert.deepEqual(lintContract(documented(purpose, `${tags}\n@public\n@example first(17) // 17`, callable)), [])
  assert.deepEqual(lintContract(complete), [], 'a private helper needs a contract, not a public example')
  const classDescription = '/**\n * Own scoped resources until shutdown.\n *\n * @example new Session()\n */\n'
  const member = '/** Release handles before cancellation completes. */\n'
  assert.ok(lintContract(`${classDescription}export class Session {\n${member}dispose() {}\n}`).some((item) => item.ruleId === 'jsdoc/require-example'))
  const memberWithExample = documented('Release handles before cancellation completes.', '@example new Session().dispose()', 'dispose() {}')
  assert.deepEqual(lintContract(`${classDescription}export class Session {\n${memberWithExample}\n}`), [])
  assert.deepEqual(lintContract(`${classDescription}export class Session {\n${member}private dispose() {}\n}`), [])
  assert.deepEqual(lintContract(`${classDescription}export class Session {\n${member}#dispose() {}\n}`), [])

  const nestedPath = 'packages/fixture/src/contract.js'
  for (const [cwd, filename, path] of [
    [process.cwd(), 'contract.js', 'contract.js'],
    [process.cwd(), resolve(nestedPath), nestedPath],
    [resolve('packages/fixture'), resolve(nestedPath), nestedPath],
    [resolve('packages/fixture'), 'src/contract.js', nestedPath],
  ]) {
    const check = (code) => lintContract(code, { cwd, filename })
    const year = new Date().getFullYear()
    const header = headerFor(readFileSync('tools/license/header.txt', 'utf8'), path, String(year))
    assert.deepEqual(check(`${header}\n\n${complete}`), [], `canonical header from ${cwd}`)
    assert.deepEqual(check(`${header}\n\n${complete}`.replaceAll('\n', '\r\n')), [], 'canonical CRLF headers remain valid')
    assert.deepEqual(check(`#!/usr/bin/env node\n${header}\n\n${complete}`), [], 'the header checker permits a leading shebang')
    for (const prefix of [
      `/** @file ${path} */`,
      header.replace('All rights reserved.', 'All rights changed.'),
      header.replace(`@file ${path}`, '@file other.js'),
      header.replace(`@file ${path}`, '@file src/contract.js'),
      header.replace(`Copyright ${year}`, `Copyright ${year - 1}`),
      `// Not a file header at byte zero.\n${header}`,
    ]) {
      assert.ok(check(`${prefix}\n\n${complete}`).some((item) => /require-description|match-description/.test(item.ruleId)), prefix)
    }
    assert.ok(check(`${header}\n\n${documented('', tags, callable)}`).some((item) => /require-description$/.test(item.ruleId)))
    assert.ok(check(`${header}\n\n${documented('select caller value', tags, callable)}`).some((item) => /match-description$/.test(item.ruleId)))
    assert.ok(check(`${header}\n\n${callable}`).some((item) => item.ruleId === 'jsdoc/require-jsdoc'), 'a file header cannot document a declaration')
  }

  // Consumer-added JSDoc rules must use the same exemption as the twenty shared contracts.
  for (const shared of [funnel, contracts]) {
    const config = {
      plugins: shared.plugins,
      settings: { jsdoc: { mode: 'typescript', tagNamePreference: { file: false } } },
      rules: { 'jsdoc/check-tag-names': 'error', 'jsdoc/require-description-complete-sentence': 'error' },
    }
    const code = `${canonical}\n\n${idle}`
    assert.deepEqual(new Linter().verify(code, [config], { filename: 'contract.js' }), [])
    const fixed = new Linter().verifyAndFix(code, [config], { filename: 'contract.js' })
    assert.equal(fixed.output, code, 'autofix must preserve the canonical legal text')
    assert.ok(new Linter().verify(`${canonical}\n\n/** release resources */\nfunction dispose() {}`, [config], { filename: 'contract.js' }).some((item) => item.ruleId === 'jsdoc/require-description-complete-sentence'))
    const settingsError = new Linter().verify(code, [{ plugins: shared.plugins, rules: { 'jsdoc/no-missing-syntax': 'error' } }], { filename: 'contract.js' })
    assert.ok(settingsError.some((item) => /missing a `contexts` option/.test(item.message)), 'a file header must not conceal invalid rule settings')
    const overview = { plugins: shared.plugins, rules: { 'jsdoc/require-file-overview': ['error', { tags: { author: { mustExist: true } } }] } }
    assert.ok(new Linter().verify(code, [overview], { filename: 'contract.js' }).some((item) => item.message === 'Missing @author'), 'a file header must not exempt whole-file requirements')
    assert.deepEqual(new Linter().verify(`${canonical}\n\n/** @author Fixture owner */\n${idle}`, [overview], { filename: 'contract.js' }), [])
  }
})

test('the repository config applies shared policies to test and lint-tool scopes', async () => {
  const eslint = new ESLint()
  for (const filePath of ['test/funnel-probe.test.mjs', 'tools/lint/probe.mjs']) {
    const [result] = await eslint.lintText("assert.equal(existsSync('src/old.ts'), false)", { filePath })
    assert.ok(result.messages.some((item) => item.ruleId === 'house/no-source-absence'), JSON.stringify(result.messages))
  }
})

test('rendered Node consumers exempt canonical headers across JSDoc rules without exempting declarations', async (context) => {
  const scratch = resolve('.amp/in/orb-backup')
  mkdirSync(scratch, { recursive: true })
  for (const repository of ['Resnovas/Eventiva', 'Resnovas/smartcloud', 'Fixture/other-node']) {
    const root = mkdtempSync(join(scratch, 'jsdoc-consumer-'))
    context.after(() => rmSync(root, { recursive: true, force: true }))
    const values = { ...loadValues('house.yml'), REPOSITORY: repository, LEGAL_HOLDER: `${repository} fixture owner` }
    const rendered = renderAll('templates', values)
    for (const path of ['tools/lint/funnel.mjs', 'tools/license/header.txt', 'tools/license/check-headers.mjs']) {
      const file = rendered.find((entry) => entry.path.replaceAll('\\', '/') === path)
      assert.ok(file, `house sync must deliver ${path} to ${repository}`)
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), file.content)
    }
    writeFileSync(join(root, 'eslint.config.mjs'), `
import { funnel, contracts } from './tools/lint/funnel.mjs'
export default [
  { ...funnel, files: ['**/src/**/*.js'] },
  { ...contracts, files: ['**/src/**/*.js'] },
  { files: ['**/src/**/*.js'], settings: { jsdoc: { tagNamePreference: { file: false } } }, rules: { 'jsdoc/require-description-complete-sentence': 'error' } },
]
`)
    const path = 'packages/fixture/src/main.js'
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    const header = headerFor(readFileSync(join(root, 'tools/license/header.txt'), 'utf8'), path, String(new Date().getFullYear()))
    const declaration = '/** Release scoped resources before shutdown. */\nfunction dispose() {}\n'
    for (const cwd of [root, join(root, 'packages/fixture')]) {
      const eslint = new ESLint({ cwd })
      writeFileSync(file, `${header}\n\n${declaration}`)
      const [accepted] = await eslint.lintFiles([file])
      assert.deepEqual(accepted.messages, [], `${repository} from ${cwd}`)
      writeFileSync(file, `${header.replace(`@file ${path}`, '@file src/main.js')}\n\n${declaration}`)
      const [wrongPath] = await eslint.lintFiles([file])
      assert.ok(wrongPath.messages.some((item) => item.ruleId === 'jsdoc/check-tag-names'), 'noncanonical headers retain consumer rule checks')
      writeFileSync(file, `${header}\n\nfunction dispose() {}\n`)
      const [undocumented] = await eslint.lintFiles([file])
      assert.ok(undocumented.messages.some((item) => item.ruleId === 'jsdoc/require-jsdoc'), 'all consumer declaration gates remain active')
    }
  }
})
