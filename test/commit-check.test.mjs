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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkMessage, checkStagedText } from '../templates/tools/dev/commit-check.mjs'
import { renderText } from '../scripts/lib/render.mjs'

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

test('mapped tasks require both their exact Linear prefix and a qualified GitHub issue on every ordinary commit', () => {
  for (const subject of ['fix(auth): reject expired tokens', 'chore(graphify): refresh the code graph', 'docs: regenerate agent docs']) {
    const message = `${subject}\n\n${signed}`
    assert.equal(checkMessage(message, human, 'EVE').length, 2)
    assert.equal(checkMessage(`${subject}\n\nRefs: EVE-266\n\n${signed}`, human, 'EVE').length, 1)
    for (const reference of ['Resnovas/Eventiva#1053', 'https://github.com/Resnovas/Eventiva/issues/1053']) {
      assert.deepEqual(checkMessage(`${subject}\n\nRefs: EVE-266, ${reference}\n\n${signed}`, human, 'EVE'), [])
    }
    // Unmapped repositories keep the existing signing and disclosure contract.
    assert.deepEqual(checkMessage(message, human), [])
    assert.match(checkMessage(subject, human).join('\n'), /No Signed-off-by/)
  }
})

test('traceability rejects wrong prefixes, bare numbers, pull requests and references hidden in comments or verbose diffs', () => {
  for (const linear of ['OTHER-266', 'NOT-EVE-266', 'EVE-0', 'EVE-266suffix']) {
    assert.match(checkMessage(`fix: x\n\nRefs: ${linear}, Resnovas/Eventiva#1053\n\n${signed}`, human, 'EVE').join('\n'), /owning EVE issue/)
  }
  for (const github of ['#1053', 'Resnovas/Eventiva#0', 'https://github.com/Resnovas/Eventiva/pull/1053', 'https://example.com/Resnovas/Eventiva/issues/1053']) {
    assert.match(checkMessage(`fix: x\n\nRefs: EVE-266, ${github}\n\n${signed}`, human, 'EVE').join('\n'), /qualified GitHub issue/)
  }
  for (const hidden of ['# Refs: EVE-266, Resnovas/Eventiva#1053', '# ------------------------ >8 ------------------------\nRefs: EVE-266, Resnovas/Eventiva#1053']) {
    assert.equal(checkMessage(`fix: x\n\n${signed}\n${hidden}`, human, 'EVE').length, 2)
  }
  assert.match(checkMessage(`fix: x\n\n${signed}`, human, 'EVE|OTHER').join('\n'), /invalid task Linear prefix/)
  // Keep git's existing merge/revert/fixup handling; normal graph commits are not exempt.
  assert.deepEqual(checkMessage("Merge branch 'main'", human, 'EVE'), [])
  assert.deepEqual(checkMessage('Revert "fix: x"', human, 'EVE'), [])
  assert.deepEqual(checkMessage('fixup! fix: x', human, 'EVE'), [])
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

test('only the exact generated Linear mirror paths preserve verbatim source dashes', () => {
  const mirrors = [
    'docs/planning/issues/EVE-45.md',
    'docs/planning/issues/archive/EVE-46.md',
    'tools/documentation/linear-snapshot.json',
  ]
  const authored = [
    'docs/planning/README.md',
    'docs/planning/timeline.md',
    'docs/planning/issues.md',
    'docs/planning/issues-archive/EVT-1.md',
    'other/docs/planning/issues/EVT-1.md',
    'tools/documentation/other.json',
    'tools/documentation/linear-snapshot.json.backup',
    'tools/documentation/linear-snapshot.json/extra.json',
    'other/tools/documentation/linear-snapshot.json',
  ]
  for (const dash of ['\u2013', '\u2014']) {
    // A generated marker cannot grant an exclusion to an arbitrary path.
    const hunk = (path) => [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      '@@ -0,0 +1,2 @@',
      '+<!-- Generated from Linear. Do not edit. -->',
      `+{"description":"Historical source ${dash} preserved verbatim"}`,
    ].join('\n')
    for (const path of mirrors) {
      assert.deepEqual(checkStagedText(hunk(path)), [], path)
      assert.deepEqual(checkStagedText(hunk(path).replace('+<!-- Generated from Linear. Do not edit. -->\n', '')), [], path)
    }
    for (const path of authored) {
      const problems = checkStagedText(hunk(path))
      assert.equal(problems.length, 1, path)
      assert.ok(problems[0].startsWith(`${path}:`), path)
      assert.match(problems[0], /em or en dash/, path)
    }
    // An excluded file must not disable scanning of the next authored file.
    assert.equal(checkStagedText([...mirrors, authored[0]].map(hunk).join('\n')).length, 1)
  }
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

test('the rendered command line reads messages and enforces the configured mapping without network access', (t) => {
  const parent = fileURLToPath(new URL('../.amp/in/orb-backup/', import.meta.url))
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(join(parent, 'commit-check-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const rendered = join(directory, 'commit-check.mjs')
  const prefixFile = join(directory, 'commit-check-linear-prefix.txt')
  const prefixTemplate = readFileSync(new URL('../templates/tools/dev/commit-check-linear-prefix.txt', import.meta.url), 'utf8')
  const source = readFileSync(script, 'utf8')
  writeFileSync(rendered, renderText(source, {}))
  writeFileSync(prefixFile, renderText(prefixTemplate, {}))
  const run = (...args) => {
    try {
      execFileSync(process.execPath, [rendered, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
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
  writeFileSync(prefixFile, renderText(prefixTemplate, { TASK_LINEAR_PREFIX: 'EVE' }))
  assert.equal(run('--message', `chore(graphify): refresh graph\n\n${signed}`, '--author', 'Jane Doe <jane@example.com>', '--no-diff').code, 1)
  const messageFile = join(directory, 'message.txt')
  writeFileSync(messageFile, `chore(graphify): refresh graph\n\nRefs: EVE-266, Resnovas/Eventiva#1053\n\n${signed}`)
  assert.equal(run(messageFile, '--author', 'Jane Doe <jane@example.com>', '--no-diff').code, 0)
  for (const prefix of ["none' + (console.error('PREFIX_EXECUTED'), '') + '", '` ${process.exit(0)}', 'EVE\nconsole.error("PREFIX_EXECUTED")']) {
    writeFileSync(prefixFile, renderText(prefixTemplate, { TASK_LINEAR_PREFIX: prefix }))
    const invalid = run(messageFile, '--author', 'Jane Doe <jane@example.com>', '--no-diff')
    assert.doesNotMatch(invalid.stderr, /PREFIX_EXECUTED/)
    assert.equal(invalid.code, 1)
    assert.match(invalid.stderr, /invalid task Linear prefix/)
  }
  rmSync(prefixFile)
  assert.equal(run(messageFile, '--author', 'Jane Doe <jane@example.com>', '--no-diff').code, 1)
})
