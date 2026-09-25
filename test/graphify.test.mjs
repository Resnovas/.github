import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const templates = new URL('../templates/', import.meta.url).pathname

test('the Claude Code skill is the same as the .agents skill', () => {
  const body = (path) => readFileSync(join(templates, path), 'utf8').replace(/^<!-- Synced from .*-->$/m, '')
  assert.equal(body('.claude/skills/graphify/SKILL.md'), body('.agents/skills/graphify/SKILL.md'))
})

test('the graphify wrapper template is executable', () => {
  assert.ok(statSync(join(templates, 'tools/graphify/graphify')).mode & 0o100)
})

test('graphify-out commits the graph and the semantic cache, nothing else', () => {
  const repo = mkdtempSync(join(tmpdir(), 'graphify-out-'))
  try {
    execFileSync('git', ['init', '-q', repo])
    cpSync(join(templates, 'graphify-out'), join(repo, 'graphify-out'), { recursive: true })
    const ignored = (path) => {
      try {
        execFileSync('git', ['-C', repo, 'check-ignore', '-q', '--no-index', path])
        return true
      } catch {
        return false
      }
    }
    for (const path of ['graph.json', 'cache/semantic/p1/abc.json', 'cache/semantic-deep/p1/abc.json', '.gitignore', '.gitattributes']) {
      assert.equal(ignored(`graphify-out/${path}`), false, `${path} should be committed`)
    }
    for (const path of ['cache/ast/v1/abc.json', 'cache/stat-index.json', 'manifest.json', '.graphify_root', 'graph.html', 'GRAPH_REPORT.md', '.graphify_labels.json', 'cost.json', 'memory/q.json']) {
      assert.equal(ignored(`graphify-out/${path}`), true, `${path} should be ignored`)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
