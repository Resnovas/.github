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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ESLint, Linter } from 'eslint'
import { funnel, contracts } from '../tools/lint/funnel.mjs'
import { headerFor } from '../templates/tools/license/check-headers.mjs'

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
    ['require-throws', documented('Reject invalid ranges before they enter storage.', '', throwing), documented('Reject invalid ranges before they enter storage.', '@throws {RangeError} Invalid range cannot enter storage.', throwing)],
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
  for (const [rule, rejected, accepted] of cases) {
    const messages = lintContract(rejected)
    assert.ok(messages.some((item) => item.ruleId === ruleId(rule)), JSON.stringify({ rule, messages }))
    assert.deepEqual(lintContract(accepted), [], `${rule}: ${accepted}`)
  }
  // A removed rule must not silently leave its fixture behind, nor may a new rule go unexercised.
  assert.deepEqual(cases.map(([rule]) => ruleId(rule)).sort(), Object.entries(contracts.rules).filter(([, value]) => value !== 'off').map(([name]) => name).sort())

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
})

test('the repository config applies shared policies to test and lint-tool scopes', async () => {
  const eslint = new ESLint()
  for (const filePath of ['test/funnel-probe.test.mjs', 'tools/lint/probe.mjs']) {
    const [result] = await eslint.lintText("assert.equal(existsSync('src/old.ts'), false)", { filePath })
    assert.ok(result.messages.some((item) => item.ruleId === 'house/no-source-absence'), JSON.stringify(result.messages))
  }
})
