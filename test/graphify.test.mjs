/**
 * @file test/graphify.test.mjs
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
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const templates = fileURLToPath(new URL('../templates/', import.meta.url))

// Hook-launched tests must never use the enclosing commit's index or worktree.
for (const key of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) delete process.env[key]

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

test('graphify-out tracks configuration only, including after git add all', () => {
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
    for (const path of ['.gitignore', '.gitattributes']) {
      assert.equal(ignored(`graphify-out/${path}`), false, `${path} should be committed`)
    }
    for (const path of ['graph.json', 'cache/semantic/p1/abc.json', 'cache/semantic-deep/p1/abc.json', 'cache/ast/v1/abc.json', 'cache/stat-index.json', 'manifest.json', '.graphify_root', 'graph.html', 'GRAPH_REPORT.md', '.graphify_labels.json', 'cost.json', 'memory/q.json']) {
      assert.equal(ignored(`graphify-out/${path}`), true, `${path} should be ignored`)
    }
    writeFileSync(join(repo, 'graphify-out/graph.json'), '{}')
    execFileSync('git', ['-C', repo, 'add', '.'])
    assert.equal(execFileSync('git', ['-C', repo, 'ls-files', 'graphify-out/graph.json'], { encoding: 'utf8' }), '')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// CI exercises a synthetic extractor contract only. It never installs
// Graphify or generates/publishes a repository navigation graph on a PR.
test('local lifecycle preserves the last good graph, caches, hooks and index', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'graphify-lifecycle-'))
  const python = process.platform === 'win32' ? 'python' : 'python3'
  const write = (path, text) => {
    const full = join(repo, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, text)
  }
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
  const env = { ...process.env, PYTHONPATH: join(repo, '.fixture') }
  const run = (...args) => execFileSync(python, ['tools/graphify/local.py', ...args], { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const graph = () => JSON.parse(readFileSync(join(repo, 'graphify-out/graph.json'), 'utf8'))
  const sources = () => graph().nodes.map((node) => node.id)
  try {
    git('init', '-q')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    cpSync(join(templates, 'tools/graphify'), join(repo, 'tools/graphify'), { recursive: true })
    cpSync(join(templates, 'graphify-out'), join(repo, 'graphify-out'), { recursive: true })
    write('.gitignore', '.fixture/\nignored/\n')
    write('first.py', 'def alpha(): pass\n')
    write('second.py', 'def beta(): pass\n')
    git('add', '.')
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture')
    write('.fixture/graphifyy-1.0.dist-info/METADATA', 'Name: graphifyy\nVersion: 1.0\n')
    write('.fixture/graphify/__init__.py', '')
    write('.fixture/graphify/detect.py', 'def ignored_predicate(root):\n    return lambda path: False\n')
    write('.fixture/graphify/__main__.py', `import json, os, time
from pathlib import Path
time.sleep(0.05)
if os.environ.get('FIXTURE_FAIL'): raise RuntimeError('extractor failed')
root = Path.cwd()
out = Path(os.environ['GRAPHIFY_OUT'])
out.mkdir(exist_ok=True)
nodes = [{'id': str(p.relative_to(root)), 'text': p.read_text()} for p in sorted(root.glob('*.py'))]
(out / 'graph.json').write_text(json.dumps({'nodes': nodes, 'links': []}))
`)
    write('graphify-out/cache/semantic/p1/expensive.json', '{"preserve":true}\n')
    run('update')
    assert.deepEqual(sources(), ['first.py', 'second.py'])
    run('check')
    const initial = graph().house_snapshot.fingerprint
    write('graphify-snapshot/graph.json', '{"published":"older source"}')
    write('graphify-snapshot/provenance.json', '{"source_sha":"old"}')
    git('add', 'graphify-snapshot')
    const published = readFileSync(join(repo, 'graphify-snapshot/graph.json'), 'utf8')
    run('update')
    assert.equal(graph().house_snapshot.fingerprint, initial)
    assert.equal(readFileSync(join(repo, 'graphify-snapshot/graph.json'), 'utf8'), published)
    assert.equal(git('diff', '--', 'graphify-snapshot'), '')
    write('first.py', 'def changed(): pass\n')
    assert.throws(() => run('check'), /stale/)
    run('update')
    assert.notEqual(graph().house_snapshot.fingerprint, initial)
    assert.match(graph().nodes[0].text, /changed/)
    rmSync(join(repo, 'first.py'))
    renameSync(join(repo, 'second.py'), join(repo, 'renamed.py'))
    write('new.py', 'def new(): pass\n')
    write('ignored/secret.py', 'secret')
    write('Examples/eventiva-before-amp/history.py', 'historical')
    run('update')
    assert.deepEqual(sources(), ['new.py', 'renamed.py'])
    const good = readFileSync(join(repo, 'graphify-out/graph.json'), 'utf8')
    assert.throws(() => execFileSync(python, ['tools/graphify/local.py', 'update', '--force'], { cwd: repo, env: { ...env, FIXTURE_FAIL: '1' }, stdio: 'pipe' }))
    assert.equal(readFileSync(join(repo, 'graphify-out/graph.json'), 'utf8'), good)
    write('new.py', 'def latest(): pass\n')
    await Promise.all([1, 2].map(() => new Promise((resolve, reject) => {
      const child = spawn(python, ['tools/graphify/local.py', 'update'], { cwd: repo, env, stdio: 'ignore' })
      child.on('error', reject)
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`update exited ${code}`)))
    })))
    assert.match(graph().nodes[0].text, /latest/)
    assert.equal(readFileSync(join(repo, 'graphify-out/cache/semantic/p1/expensive.json'), 'utf8'), '{"preserve":true}\n')
    write('.git/hooks/pre-commit', '#!/bin/sh\nexit 17\n')
    write('.git/hooks/post-commit', '#!/bin/sh\n# graphify-hook-start\nexit 99\n# graphify-hook-end\nprintf foreign\nexit 23\n')
    run('hooks')
    const hook = readFileSync(join(repo, '.git/hooks/post-commit'), 'utf8')
    run('hooks')
    assert.equal(readFileSync(join(repo, '.git/hooks/post-commit'), 'utf8'), hook)
    assert.match(hook, /printf foreign\nexit 23/)
    assert.doesNotMatch(hook, /exit 99/)
    assert.equal(readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf8'), '#!/bin/sh\nexit 17\n')
    write('.git/hooks/post-merge', '#!/bin/sh\n# graphify-merge-hook-end\n')
    assert.throws(() => run('hooks'), /Ambiguous/)
    run('snapshot')
    assert.equal(JSON.parse(readFileSync(join(repo, 'graphify-out/snapshot/provenance.json'), 'utf8')).source_sha, git('rev-parse', 'HEAD'))
    git('add', '.')
    assert.equal(git('ls-files', 'graphify-out'), 'graphify-out/.gitattributes\ngraphify-out/.gitignore')
    git('add', '-f', 'graphify-out/graph.json')
    assert.throws(() => run('update'), /still tracked/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('snapshot caller has only daily/manual triggers and narrowly scoped signed publication', () => {
  const caller = readFileSync(join(templates, '.github/workflows/house-graphify.yml'), 'utf8')
  const publisher = readFileSync(join(templates, '../.github/workflows/graphify-snapshot.yml'), 'utf8')
  const triggers = caller.slice(caller.indexOf('\non:'), caller.indexOf('\npermissions:'))
  assert.match(triggers, /schedule:[\s\S]*cron: '23 4 \* \* \*'/)
  assert.match(triggers, /workflow_dispatch:/)
  assert.doesNotMatch(triggers, /pull_request|push:|merge_group/)
  assert.match(publisher, /github.event_name == 'schedule'.*github.event_name == 'workflow_dispatch'/)
  assert.match(publisher, /github.ref == 'refs\/heads\/main'/)
  assert.match(publisher, /ref: main\n\s+fetch-depth: 0/)
  assert.match(publisher, /SOURCE_SHA: \$\{\{ github.sha \}\}/)
  assert.match(publisher, /git merge-base --is-ancestor "\$SOURCE_SHA" origin\/main\n\s+git checkout -B main "\$SOURCE_SHA"/)
  assert.match(publisher, /name: graphify-\$\{\{ github.sha \}\}-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/)
  assert.match(publisher, /retention-days: 7/)
  assert.match(publisher, /sign-commits: true/)
  assert.match(publisher, /branch: house\/graphify-navigation/)
  assert.match(publisher, /commit-message: \$\{\{ inputs.publication-message \}\}/)
  assert.match(publisher, /node tools\/dev\/commit-check.mjs --message "\$GRAPHIFY_PUBLICATION_MESSAGE"/)
  assert.match(publisher, /add-paths: \|\n\s+graphify-snapshot\/graph.json\n\s+graphify-snapshot\/provenance.json/)
  assert.doesNotMatch(publisher, /git push|gh pr merge|signoff: true|continue-on-error|secrets\.token|token: \$\{\{ github.token/)
})
