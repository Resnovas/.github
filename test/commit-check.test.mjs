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
