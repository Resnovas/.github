/**
 * @file test/commit-check.test.mjs
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
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { checkMessage, checkStagedText } from '../templates/tools/dev/commit-check.mjs'

const human = { name: 'Jane Doe', email: 'jane@example.com' }
const signed = 'Signed-off-by: Jane Doe <jane@example.com>'
const script = fileURLToPath(new URL('../templates/tools/dev/commit-check.mjs', import.meta.url))

test('a conventional, signed-off, human-authored commit passes', () => {
  assert.deepEqual(checkMessage(`fix(auth): reject expired tokens\n\nBody.\n\n${signed}\n`, human), [])
  assert.deepEqual(
    checkMessage(`feat: x\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>\n${signed}\n`, human),
    [],
  )
})

test('the subject must be a conventional commit, except what git writes itself', () => {
  assert.match(checkMessage(`Add a note\n\n${signed}`, human).join('\n'), /not a conventional commit/)
  assert.deepEqual(checkMessage(`Merge branch 'main' into x\n\n${signed}`, human), [])
  assert.deepEqual(checkMessage(`fixup! fix: x\n\n${signed}`, human), [])
})

test('an AI author, an AI sign-off, or a sign-off that does not match the author fails', () => {
  const ai = { name: 'Claude', email: 'noreply@anthropic.com' }
  const problems = checkMessage(`fix: x\n\n${signed}`, ai).join('\n')
  assert.match(problems, /author "Claude <noreply@anthropic.com>" is an AI tool/)
  assert.match(problems, /No Signed-off-by matching the author <noreply@anthropic.com>/)
  assert.match(
    checkMessage('fix: x\n\nSigned-off-by: Claude <noreply@anthropic.com>', human).join('\n'),
    /names an AI tool/,
  )
  assert.match(checkMessage('fix: x\n\nSigned-off-by: Someone Else <else@example.com>', human).join('\n'), /No Signed-off-by matching/)
  assert.match(checkMessage('fix: x\n', human).join('\n'), /No Signed-off-by/)
})

test('an AI co-author names the model, and host attribution lines are rejected', () => {
  assert.match(
    checkMessage(`fix: x\n\nCo-authored-by: Claude <noreply@anthropic.com>\n${signed}`, human).join('\n'),
    /names a tool family, not the model/,
  )
  const hosted = checkMessage(
    `fix: x\n\n🤖 Generated with Claude Code\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://example.com/s\n${signed}`,
    human,
  ).join('\n')
  assert.match(hosted, /Remove the host attribution line "Claude-Session/)
  assert.match(hosted, /emoji/)
})

test('long dashes fail in the message and in added staged lines, outside generated paths', () => {
  assert.match(checkMessage(`fix: x \u2014 again\n\n${signed}`, human).join('\n'), /em or en dash/)
  const diff = [
    'diff --git a/docs/a.md b/docs/a.md',
    '--- a/docs/a.md',
    '+++ b/docs/a.md',
    '@@ -1 +1 @@',
    '+plain \u2013 dash',
    'diff --git a/graphify-out/graph.json b/graphify-out/graph.json',
    '--- a/graphify-out/graph.json',
    '+++ b/graphify-out/graph.json',
    '@@ -1 +1 @@',
    '+"\u2014"',
    'diff --git a/gone.md b/gone.md',
    '--- a/gone.md',
    '+++ /dev/null',
  ].join('\n')
  const problems = checkStagedText(diff)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /^docs\/a\.md/)
})

test('plain Promise code and any fail in added TypeScript sources, not in tests, comments or marked boundaries', () => {
  const hunk = (path, ...lines) => ['diff --git a/' + path + ' b/' + path, '--- a/' + path, '+++ b/' + path, '@@ -1 +1 @@', ...lines]
  const diff = [
    ...hunk('packages/feature.sync/src/archive.ts', '+const read = async (url: string) => {', '+  const value: any = await fetch(url)', '+  // await in a comment is fine', '+  return value', '+}'),
    ...hunk('packages/integrations.github/src/live.ts', '+  // effect-boundary: octokit returns a promise', '+  Effect.tryPromise(() => octokit.request(options).then((r) => r.data))', '+  throw new Error("still plain")'),
    ...hunk('packages/integrations.posthog/src/transport.ts', ' // effect-boundary: fetch is promise based', '+  async (input, init) => send(input, init),'),
    ...hunk('tests/feature.sync/src/archive.spec.ts', '+const x: any = await run()'),
    ...hunk('tools/dev/build.ts', '+try { await main() } catch (error) { throw error }'),
    ...hunk('packages/core/src/pure.ts', '+export const sum = (a: number, b: number): number => a + b', '+const label = "async" as const'),
  ].join('\n')
  const problems = checkStagedText(diff)
  assert.deepEqual(
    problems.map((problem) => problem.split(':').slice(0, 1).join('') + (problem.includes('`any`') ? ' any' : ' promise')),
    ['packages/feature.sync/src/archive.ts promise', 'packages/feature.sync/src/archive.ts any', 'packages/integrations.github/src/live.ts promise'],
  )
  assert.match(problems[0], /effect-boundary/)
})

test('git-generated commits need no sign-off, and a verbose-commit diff after the cut line is not the message', () => {
  assert.deepEqual(checkMessage("Merge branch 'main' into x", human), [])
  assert.deepEqual(checkMessage('Revert "feat: x"\n\nThis reverts commit abc.', human), [])
  assert.deepEqual(checkMessage('fixup! feat: x', human), [])
  assert.match(checkMessage("Merge branch 'main' \u2014 again", human).join('\n'), /em or en dash/)
  const verbose = `fix: x\n\n${signed}\n# ------------------------ >8 ------------------------\n# Do not modify or remove the line above.\ndiff --git a/a.ts b/a.ts\n+const s = 'plain \u2014 dash'\n`
  assert.deepEqual(checkMessage(verbose, human), [])
})

test('comments after code, block comments and JSX text are not code', () => {
  const hunk = (path, ...lines) => ['diff --git a/' + path + ' b/' + path, '--- a/' + path, '+++ b/' + path, '@@ -1 +1 @@', ...lines]
  const diff = [
    ...hunk('packages/core/src/a.ts', "+run() // don't await here, the caller does", '+const label = "x" /* throw away */', '+const n: number = 1'),
    ...hunk('packages/ui/src/b.tsx', '+<p>Please await confirmation</p>', '+const url = "http://example.com" // async docs'),
  ].join('\n')
  assert.deepEqual(checkStagedText(diff), [])
  assert.equal(checkStagedText(hunk('packages/core/src/c.ts', '+const p = fetch(u).then((r) => r.json()) // fine?').join('\n')).length, 1)
})

test('the command line reads a message file or --message, with an explicit author and no diff', () => {
  const run = (...args) => {
    try {
      execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return { code: 0, stderr: '' }
    } catch (error) {
      return { code: error.status, stderr: String(error.stderr) }
    }
  }
  assert.equal(run('--message', `fix: x\n\n${signed}`, '--author', 'Jane Doe <jane@example.com>', '--no-diff').code, 0)
  const failed = run('--message', 'nope', '--author', 'Jane Doe <jane@example.com>', '--no-diff')
  assert.equal(failed.code, 1)
  assert.match(failed.stderr, /commit-check: Subject "nope"/)
  assert.equal(run('--no-diff').code, 2)
})
