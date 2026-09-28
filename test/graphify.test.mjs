import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const templates = fileURLToPath(new URL('../templates/', import.meta.url))

// surfaces.mjs sync mirrors .agents/skills to .claude/skills in the rendered
// root, so Claude Code reads the same copy as every other host.
test('the generated Claude Code skill is the same as the .agents skill', () => {
  const root = join(templates, '..')
  const body = (path) => readFileSync(join(root, path), 'utf8')
  assert.equal(body('.claude/skills/graphify/SKILL.md'), body('.agents/skills/graphify/SKILL.md'))
})

// Read from git, which records the executable bit on every OS; Windows file
// modes have none.
test('the graphify wrapper template is executable', () => {
  const entry = execFileSync('git', ['ls-files', '--stage', 'templates/tools/graphify/graphify'], {
    cwd: join(templates, '..'),
    encoding: 'utf8',
  })
  assert.match(entry, /^100755 /)
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
