/**
 * @file test/codeql-alert-comment.test.mjs
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
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { commentCodeQL, githubRequest } from '../scripts/lib/codeql-alert-comment.mjs'

const head = 'a'.repeat(40)
const merge = 'b'.repeat(40)
const marker = '<!-- house-codeql-alerts:v1 -->'
const bot = { login: 'github-actions[bot]', type: 'Bot' }
const physical = (uri, startLine) => ({ artifactLocation: { uri }, region: { startLine } })
const zip = (document, filename = 'javascript.sarif') => execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-c', 'import io,json,sys,zipfile; o=io.BytesIO(); z=zipfile.ZipFile(o,"w"); z.writestr(zipfile.ZipInfo(sys.argv[1]),sys.stdin.buffer.read()); z.close(); sys.stdout.buffer.write(o.getvalue())', filename], { input: JSON.stringify(document), maxBuffer: 40 * 1024 * 1024 })

function fixture() {
  const f = {
    run: { event: 'pull_request', path: '.github/workflows/house-codeql.yml', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo', id: 1 }, head_repository: { id: 2 }, head_sha: head, run_started_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:02:00Z' },
    pr: { number: 7, state: 'open', head: { sha: head, repo: { id: 2 } }, base: { repo: { full_name: 'owner/repo' } }, merge_commit_sha: merge },
    analyses: [{ id: 10, ref: 'refs/pull/7/merge', commit_sha: merge, tool: { name: 'CodeQL' }, category: '/language:javascript-typescript', created_at: '2026-11-20T10:01:00Z', results_count: 1 }],
    alerts: [{ number: 64, tool: { name: 'CodeQL' }, rule: { id: 'js/command-line-injection', security_severity_level: 'high', severity: 'error' }, most_recent_instance: { ref: 'refs/pull/7/merge', commit_sha: merge, message: { text: 'Tainted input reaches exec.' }, location: { path: 'src/sink.js', start_line: 27 } } }],
    result: { ruleId: 'js/command-line-injection', message: { text: 'Tainted input reaches exec.' }, locations: [{ physicalLocation: physical('src/sink.js', 27) }], codeFlows: [{ threadFlows: [{ locations: [{ location: { physicalLocation: physical('src/source.js', 3), message: { text: 'request input' } } }, { location: { physicalLocation: physical('src/middle.js', 19), message: { text: 'propagate' } } }, { location: { physicalLocation: physical('src/sink.js', 27), message: { text: 'exec' } } }] }] }] },
    comments: [], writes: [], calls: [], kind: 'path-problem', artifactPatch: {}, artifactFilename: 'javascript.sarif',
  }
  f.request = async (method, path, body, accept) => {
    f.calls.push({ method, path, accept })
    const url = new URL(`https://api.github.com${path}`)
    const page = Number(url.searchParams.get('page') ?? 1)
    const paginate = (values) => values.slice((page - 1) * 100, page * 100)
    if (method !== 'GET') {
      f.writes.push({ method, path, body })
      if (method === 'POST') f.comments.push({ id: 55, user: bot, body: body.body })
      else f.comments.find((comment) => path.endsWith(`/${comment.id}`)).body = body.body
      return {}
    }
    if (f.fail && path.includes(f.fail)) throw new Error('GitHub API HTTP 403; results unavailable.')
    if (url.pathname.endsWith('/actions/runs/9')) return f.run
    if (url.pathname.endsWith('/actions/runs/9/jobs')) return { jobs: f.jobs ?? [{ name: 'house-codeql / analyze (javascript-typescript)' }], total_count: f.jobTotal ?? 1 }
    if (url.pathname.endsWith('/pulls')) return paginate(f.prs ?? [structuredClone(f.pr)])
    if (url.pathname.endsWith('/pulls/7')) {
      f.reads = (f.reads ?? 0) + 1
      return f.stale && f.reads > 1 ? { ...f.pr, head: { ...f.pr.head, sha: 'c'.repeat(40) } } : f.pr
    }
    if (url.pathname.endsWith('/code-scanning/analyses')) return f.badPage ? {} : paginate(f.analyses)
    if (url.pathname.endsWith('/code-scanning/alerts')) return f.repeatPages ? Array(100).fill(f.alerts[0]) : paginate(f.alerts)
    const original = { runs: [{ automationDetails: { id: '/language:javascript-typescript/' }, tool: { driver: { name: 'CodeQL', rules: [{ id: f.result.ruleId, properties: { kind: f.kind } }] } }, results: [f.result] }] }
    const archive = f.archive ?? zip(original, f.artifactFilename)
    if (url.pathname.endsWith('/artifacts')) {
      const artifact = { id: 40, name: 'house-codeql-sarif-javascript-typescript', digest: `sha256:${createHash('sha256').update(archive).digest('hex')}`, size_in_bytes: archive.length, workflow_run: { id: 9, repository_id: 1, head_repository_id: 2, head_sha: head }, ...f.artifactPatch }
      return { artifacts: f.noArtifact ? [] : [artifact], total_count: f.noArtifact ? 0 : 1 }
    }
    if (url.pathname.endsWith('/artifacts/40/zip')) return archive
    if (url.pathname.endsWith('/analyses/10')) {
      const { codeFlows, ...result } = f.result
      void codeFlows
      return f.sarif ?? { runs: [{ results: [{ ...result, properties: f.propertyBag ? { 'github/alertNumber': 64 } : [{ 'github/alertNumber': 64 }] }] }] }
    }
    if (url.pathname.endsWith('/comments')) return paginate(f.comments)
    throw new Error(`Unexpected API request: ${path}`)
  }
  f.execute = () => commentCodeQL({ repository: 'owner/repo', runID: 9, request: f.request })
  f.body = () => f.comments.find((comment) => comment.user === bot)?.body ?? f.writes.at(-1)?.body.body
  return f
}

test('creates one bot-owned comment, updates it and leaves an identical snapshot unchanged', async () => {
  const f = fixture()
  f.comments.push(...Array.from({ length: 100 }, (_, id) => ({ id: id + 1000, user: { login: 'human' }, body: marker })))
  assert.deepEqual(await f.execute(), [7])
  assert.equal(f.writes.length, 1)
  const body = f.body()
  for (const expected of ['Rule: js/command-line-injection', 'severity: high', 'src/sink.js:27', 'Tainted input reaches exec.', '1. src/source.js:3 - request input', '2. src/middle.js:19 - propagate', '3. src/sink.js:27 - exec', head, merge, 'Original source-to-sink thread']) assert.ok(body.includes(expected), expected)
  assert.ok(body.indexOf('src/source.js:3') < body.indexOf('src/middle.js:19'))
  assert.ok(f.calls.some((call) => call.path.includes('comments?per_page=100&page=2')))
  await f.execute()
  assert.equal(f.writes.length, 1)
  f.alerts[0].rule.security_severity_level = 'critical'
  f.propertyBag = true
  await f.execute()
  assert.equal(f.writes.length, 2)
  assert.equal(f.writes[1].method, 'PATCH')
  assert.match(f.body(), /severity: critical/)
})

test('paginates PRs, analyses and alerts without losing requested fields', async () => {
  const f = fixture()
  f.prs = [...Array.from({ length: 100 }, () => ({ ...f.pr, head: { sha: 'd'.repeat(40) } })), f.pr]
  f.analyses = [...Array.from({ length: 100 }, () => ({ ...f.analyses[0], commit_sha: 'e'.repeat(40) })), f.analyses[0]]
  f.alerts = Array(101).fill(f.alerts[0])
  f.kind = 'problem'
  delete f.result.codeFlows
  await f.execute()
  assert.match(f.body(), /Open CodeQL alerts: 101/)
  assert.equal((f.body().match(/### Alert 64/g) ?? []).length, 101)
  assert.match(f.body(), /Path not applicable/)
  for (const endpoint of ['/pulls?', '/analyses?', '/alerts?']) assert.ok(f.calls.some((call) => call.path.includes(endpoint) && call.path.endsWith('page=2')))
})

test('fork metadata cannot bind another repository, head, ref or stale completion', async () => {
  for (const change of [
    (f) => { f.run.head_repository.id = 3 },
    (f) => { f.run.head_sha = 'd'.repeat(40) },
    (f) => { f.pr.base.repo.full_name = 'other/repo' },
    (f) => { f.stale = true },
    (f) => { f.pr.merge_commit_sha = null },
  ]) {
    const f = fixture()
    change(f)
    assert.deepEqual(await f.execute(), [])
    assert.equal(f.writes.length, 0)
  }
  for (const field of ['event', 'path', 'status', 'head_sha']) {
    const f = fixture()
    f.run[field] = 'untrusted'
    await assert.rejects(f.execute(), /Not a completed/)
    assert.equal(f.writes.length, 0)
  }
})

test('empty alerts are distinct from failed, missing, mismatched and truncated evidence', async () => {
  const empty = fixture()
  empty.alerts = []
  await empty.execute()
  assert.match(empty.body(), /Open CodeQL alerts: 0/)
  for (const change of [
    (f) => { f.fail = '/code-scanning/' },
    (f) => { f.analyses = [] },
    (f) => { f.analyses[0].ref = 'refs/pull/8/merge' },
    (f) => { f.analyses[0].created_at = '2026-11-19T10:00:00Z' },
    (f) => { f.analyses[0].warning = 'partial scan' },
    (f) => { f.analyses[0].results_count = 2 },
    (f) => { f.jobs = [{ name: 'house-codeql / analyze (actions)' }] },
    (f) => { f.jobTotal = 2 },
    (f) => { f.run.conclusion = 'failure' },
    (f) => { f.alerts[0].most_recent_instance.commit_sha = 'e'.repeat(40) },
    (f) => { f.badPage = true },
    (f) => { f.sarif = {} },
    (f) => { f.sarif = { runs: [{}] } },
    (f) => { f.repeatPages = true },
  ]) {
    const f = fixture()
    change(f)
    await assert.rejects(f.execute(), /results unavailable/)
    assert.match(f.body(), /Results unavailable, not zero alerts/)
  }
})

test('retains alert fields but reports unavailable paths for missing or unsafe originals', async () => {
  for (const change of [
    (f) => { f.noArtifact = true },
    (f) => { f.artifactPatch.expired = true },
    (f) => { f.artifactPatch.workflow_run = { id: 8 } },
    (f) => { f.artifactPatch.digest = `sha256:${'0'.repeat(64)}` },
    (f) => { f.artifactFilename = '../escape.sarif' },
    (f) => { f.archive = Buffer.from('not a ZIP') },
    (f) => { f.result.codeFlows = [] },
    (f) => { f.result.codeFlows[0].threadFlows[0].locations[0].location = {} },
  ]) {
    const f = fixture()
    change(f)
    await assert.rejects(f.execute(), /results unavailable/)
    assert.match(f.body(), /Rule: js\/command-line-injection/)
    assert.match(f.body(), /Path unavailable/)
  }
  const partial = fixture()
  partial.analyses[0].results_count = 2
  partial.sarif = { runs: [{ results: [
    { ...partial.result, properties: { 'github/alertNumber': 64 } },
    { ...partial.result, message: { text: 'Unmatched original result' }, properties: { 'github/alertNumber': 64 } },
  ] }] }
  await assert.rejects(partial.execute(), /results unavailable/)
  assert.match(partial.body(), /Some paths unavailable/)
  assert.match(partial.body(), /src\/source.js:3/)
})

test('untrusted strings remain data and oversized reports never claim completeness', async () => {
  const f = fixture()
  f.alerts[0].most_recent_instance.message.text = '<script>@maintainer ${{ secrets.TOKEN }} $(touch /bad)</script>\n```'
  await f.execute()
  assert.ok(f.body().includes('&#60;script&#62;@\u200bmaintainer'))
  assert.ok(f.body().includes('${{ secrets.TOKEN }} $(touch /bad)'))
  f.alerts[0].most_recent_instance.message.text = 'x'.repeat(61000)
  await assert.rejects(f.execute(), /results unavailable/)
  assert.match(f.body(), /exceeds the safe comment size/)
  const duplicate = fixture()
  duplicate.comments = [1, 2].map((id) => ({ id, user: bot, body: marker }))
  await assert.rejects(duplicate.execute(), /Multiple bot-owned/)
  assert.equal(duplicate.writes.length, 0)
})

test('API transport scopes credentials to GitHub and bounds redirects and response bytes', async () => {
  const calls = []
  const request = githubRequest('synthetic-token', async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://example.blob.core.windows.net/artifact?signed=synthetic' } }) : new Response('zip-bytes')
  })
  assert.equal((await request('GET', '/repos/owner/repo/actions/artifacts/1/zip', undefined, 'application/zip')).toString(), 'zip-bytes')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-token')
  assert.equal(calls[1].options.headers, undefined)
  const json = githubRequest('synthetic-token', async (_url, options) => {
    assert.equal(options.body, '{"body":"literal"}')
    return Response.json({ id: 1 })
  })
  assert.deepEqual(await json('POST', '/repos/owner/repo/issues/7/comments', { body: 'literal' }), { id: 1 })
  for (const response of [new Response(null, { status: 403 }), new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/archive' } }), new Response(Buffer.alloc(16 * 1024 * 1024 + 1))]) {
    await assert.rejects(githubRequest('synthetic-token', async () => response)('GET', '/repos/owner/repo/actions/artifacts/1/zip', undefined, 'application/zip'), /HTTP 403|Unsafe artifact|safety limit/)
  }
  await assert.rejects(request('GET', '//attacker.invalid'), /Unsafe GitHub API path/)
  await assert.rejects(commentCodeQL({ repository: '../bad', runID: 0 }), /Invalid repository/)
})

test('workflow trust contract uses completion, trusted house code and only scoped Actions token', () => {
  const caller = readFileSync(new URL('../templates/.github/workflows/house-codeql-alert-comment.yml', import.meta.url), 'utf8')
  const workflow = readFileSync(new URL('../.github/workflows/codeql-alert-comment.yml', import.meta.url), 'utf8')
  assert.match(caller, /workflow_run:\n    workflows: \[House CodeQL\]\n    types: \[completed\]/)
  assert.match(caller, /uses: Resnovas\/\.github\/\.github\/workflows\/codeql-alert-comment.yml@[a-f0-9]{40} /)
  const pin = caller.match(/codeql-alert-comment.yml@([a-f0-9]{40}) /)[1]
  // A feature-branch SHA can disappear from GitHub's history after squash merge.
  // CI fetches full history; require the implementation to be published first.
  assert.doesNotThrow(() => execFileSync('git', ['merge-base', '--is-ancestor', pin, 'refs/remotes/origin/main'], {
    cwd: new URL('..', import.meta.url), stdio: 'pipe',
  }), 'The CodeQL commenter pin must be an ancestor of published origin/main')
  assert.match(workflow, /repository: Resnovas\/\.github\n          ref: main\n          persist-credentials: false/)
  assert.match(workflow, /GH_TOKEN: \$\{\{ github.token \}\}/)
  assert.deepEqual(workflow.split('\n').filter((line) => /^      [\w-]+: (read|write)$/.test(line)).map((line) => line.trim()), ['actions: read', 'contents: read', 'security-events: read', 'pull-requests: write'])
  const analyzer = readFileSync(new URL('../.github/workflows/codeql.yml', import.meta.url), 'utf8')
  assert.match(analyzer, /path: \$\{\{ steps.analyze.outputs.sarif-output \}\}\/\*.sarif/)
  assert.match(analyzer, /overwrite: true/)
  assert.match(analyzer, /retention-days: 7/)
})
