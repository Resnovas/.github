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
import { ESLint, Linter } from 'eslint'
import { funnel, contracts } from '../templates/tools/lint/funnel.mjs'

const lint = (code, config = funnel) => new Linter().verify(code, [{ ...config, languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } }])

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
})

test('the repository config applies shared policies to test and lint-tool scopes', async () => {
  const eslint = new ESLint()
  for (const filePath of ['test/funnel-probe.test.mjs', 'tools/lint/probe.mjs']) {
    const [result] = await eslint.lintText("assert.equal(existsSync('src/old.ts'), false)", { filePath })
    assert.ok(result.messages.some((item) => item.ruleId === 'house/no-source-absence'), JSON.stringify(result.messages))
  }
})
