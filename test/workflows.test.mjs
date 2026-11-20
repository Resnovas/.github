/**
 * @file test/workflows.test.mjs
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
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../', import.meta.url))
const directories = ['.github/workflows', 'templates/.github/workflows']

const workflows = directories.flatMap((directory) =>
  readdirSync(join(root, directory))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => {
      const path = join(directory, name)
      return { path, lines: readFileSync(join(root, path), 'utf8').split('\n') }
    }),
)

// Each job under jobs:, as the lines from its key to the next job or the end.
const jobs = ({ path, lines }) => {
  const start = lines.indexOf('jobs:')
  const found = []
  for (const line of lines.slice(start + 1)) {
    const name = line.match(/^ {2}([\w-]+):\s*$/)?.[1]
    if (name) found.push({ path, name, lines: [] })
    else if (/^\S/.test(line) && !line.startsWith('#')) break
    else found.at(-1)?.lines.push(line)
  }
  return found
}

test('the workflows define jobs', () => {
  assert.ok(workflows.every((workflow) => jobs(workflow).length > 0))
})

// The workflow grants the token nothing, so a job added later starts with no
// access; each job asks for the scopes it uses.
test('every workflow grants the token no permissions at the top level', () => {
  const broad = workflows.filter(({ lines }) => !lines.includes('permissions: {}')).map(({ path }) => path)
  assert.deepEqual(broad, [])
})

test('every job declares its own permissions', () => {
  const undeclared = workflows
    .flatMap(jobs)
    .filter(({ lines }) => !lines.some((line) => /^ {4}permissions:/.test(line)))
    .map(({ path, name }) => `${path} ${name}`)
  assert.deepEqual(undeclared, [])
})

test('no workflow grants read-all or write-all', () => {
  const blanket = workflows
    .filter(({ lines }) => lines.some((line) => /permissions:\s*(read|write)-all/.test(line)))
    .map(({ path }) => path)
  assert.deepEqual(blanket, [])
})

// A hung step would otherwise hold a runner for GitHub's six-hour default.
// A job that calls a reusable workflow cannot set a timeout; the called
// workflow's jobs set theirs.
test('every job that runs steps sets timeout-minutes', () => {
  const unbounded = workflows
    .flatMap(jobs)
    .filter(({ lines }) => !lines.some((line) => /^ {4}uses:/.test(line)))
    .filter(({ lines }) => !lines.some((line) => /^ {4}timeout-minutes: \d+\s*$/.test(line)))
    .map(({ path, name }) => `${path} ${name}`)
  assert.deepEqual(unbounded, [])
})

// Nx replays tasks whose inputs did not change from .nx/cache, which starts
// empty on every runner unless the job restores it. A release job runs Nx with
// --skip-nx-cache instead, so nothing it publishes comes from a cache entry.
test('every job that runs Nx caches .nx/cache', () => {
  const uncached = workflows
    .flatMap(jobs)
    .filter(({ lines }) =>
      lines.some((line) => /\bnx\s/.test(line) && !/^\s*#/.test(line) && !line.includes('--skip-nx-cache')),
    )
    .filter(({ lines }) => {
      const cache = lines.findIndex((line) => /uses: actions\/cache@/.test(line))
      return cache === -1 || !lines.slice(cache).some((line) => /^\s+path:.*\.nx\/cache/.test(line))
    })
    .map(({ path, name }) => `${path} ${name}`)
  assert.deepEqual(uncached, [])
})

// A workflow filtered by path never starts for a change outside the filter, so
// a required check it reports waits forever. Skip jobs a change cannot affect
// with `if:` on a classifying job's outputs instead, and let the aggregate job
// accept those skips.
test('no workflow filters pull requests or the merge queue by path', () => {
  const filtered = workflows
    .filter(({ lines }) => {
      const on = lines.findIndex((line) => /^on:/.test(line))
      const end = lines.findIndex((line, index) => index > on && /^\S/.test(line) && !line.startsWith('#'))
      const triggers = lines.slice(on + 1, end === -1 ? undefined : end)
      let event = ''
      return triggers.some((line) => {
        event = line.match(/^ {2}([\w-]+):/)?.[1] ?? event
        return (event === 'pull_request' || event === 'merge_group') && /^ {4}paths(-ignore)?:/.test(line)
      })
    })
    .map(({ path }) => path)
  assert.deepEqual(filtered, [])
})

// The default branch merges through a merge queue, which waits for the
// required checks on every queued group, so a workflow that checks pull
// requests also runs on merge_group. Graphify only reports a notice on pull
// requests and gates nothing, so the queue does not need it.
const ungated = new Set(['house-graphify.yml', 'house-release-preview.yml'])

test('every workflow that checks pull requests also runs in the merge queue', () => {
  const missing = workflows
    // The file name, whichever separator the platform uses.
    .filter(({ path }) => !ungated.has(path.split(/[\\/]/).at(-1)))
    .filter(({ lines }) => {
      const on = lines.findIndex((line) => /^on:/.test(line))
      const end = lines.findIndex((line, index) => index > on && /^\S/.test(line) && !line.startsWith('#'))
      const triggers = lines.slice(on + 1, end === -1 ? undefined : end)
      const has = (event) => triggers.some((line) => new RegExp(`^ {2}${event}:`).test(line))
      return has('pull_request') && !has('merge_group')
    })
    .map(({ path }) => path)
  assert.deepEqual(missing, [])
})

test('the synced queue contract rejects skipped required jobs and retains conditional token steps', () => {
  const caller = workflows.find(({ path }) => path === join('templates/.github/workflows', 'house-workflow-lint.yml'))
  const job = jobs(caller).find(({ name }) => name === 'merge-group-contract')
  assert.ok(job, 'house sync must carry the queue contract to consumers')
  const start = job.lines.indexOf('        run: |')
  assert.ok(start >= 0)
  const script = job.lines.slice(start + 1).filter((line) => line.startsWith('          ')).map((line) => line.slice(10)).join('\n')
  const run = (workflow, repository = 'Resnovas/.github') => {
    const output = []
    runInNewContext(script, {
      process: { cwd: () => '/fixture', env: { GITHUB_REPOSITORY: repository } },
      require: (name) => {
        if (name === '/fixture/tools/ci/smartcloud-native-contract.cjs') return createRequire(import.meta.url)('../templates/tools/ci/smartcloud-native-contract.cjs')
        assert.equal(name, 'node:fs')
        return { readFileSync: (path, encoding) => {
          assert.equal(path, '.github/workflows/smartcloud.yml')
          assert.equal(encoding, 'utf8')
          return workflow
        } }
      },
      console: { log: (message) => output.push(message) },
    })
    return output
  }
  const native = readFileSync(join(root, 'templates/tools/ci/smartcloud-native.yml'), 'utf8')
  assert.deepEqual(run(native, 'Resnovas/smartcloud'), ['Trusted smartcloud native-self-build recipe accepted.'])
  assert.deepEqual(run(native.replaceAll('\n', '\r\n'), 'Resnovas/smartcloud'), run(native, 'Resnovas/smartcloud'))
  for (const repository of ['Resnovas/.github', 'Resnovas/Eventiva', 'fork/smartcloud', '']) {
    assert.throws(() => run(native, repository), /Required queue checks must execute/)
  }
  // Each changed input must be rejected through the workflow's actual public check.
  const mutations = [
    ['  merge_group:', '  merge_group:\n    branches: [main]'],
    ["github.event_name != 'issue_comment' ||", "github.event_name != 'merge_group' && github.event_name != 'issue_comment' ||"],
    ['    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    continue-on-error: true'],
    ['    timeout-minutes: 75', '    timeout-minutes: 5'],
    ['          ref: refs/heads/main', '          ref: ${{ github.sha }}'],
    ['          repository: Resnovas/smartcloud', '          repository: ${{ github.event.pull_request.head.repo.full_name }}'],
    ['          persist-credentials: false', '          persist-credentials: true'],
    ['          configRef: refs/heads/main', '          configRef: ${{ github.sha }}'],
    ['          configRef: refs/heads/main', '          configJson: ${{ github.event.pull_request.body }}'],
    ['--frozen-lockfile --ignore-scripts', '--frozen-lockfile'],
    ['          run_install: false', '          run_install: true'],
    [' --skip-nx-cache', ''],
    ['        uses: ./', "        uses: ./\n        if: github.event_name != 'merge_group'"],
    ['          checkRunId: ${{ job.check_run_id }}', '          checkRunId: ""'],
    ['          CHECK_RUN_ID: ${{ job.check_run_id }}', '          CHECK_RUN_ID: 123'],
    ["group.head_sha !== process.env.GITHUB_SHA", 'false'],
    ['          permission-contents: read', '          permission-contents: write'],
    ['          repositories: smartcloud', '          repositories: smartcloud, .github'],
    ['["push", "schedule", "workflow_dispatch"]', '["push", "schedule", "workflow_dispatch", "merge_group"]'],
    ['      contents: read', '      contents: write'],
    ['          GITHUB_TOKEN: ${{ steps.app.outputs.token || github.token }}', '          GITHUB_TOKEN: ${{ secrets.ACCESS_TOKEN }}'],
    ['      - name: Bundle the trusted action', '      - run: echo ${{ secrets.RESNOVAS_BOT_PRIVATE_KEY }}\n\n      - name: Bundle the trusted action'],
  ]
  for (const [before, after] of mutations) {
    assert.ok(native.includes(before), `fixture must exercise ${before}`)
    const changed = native.replace(before, after)
    assert.notEqual(changed, native)
    assert.throws(() => run(changed, 'Resnovas/smartcloud'), /Required queue checks must execute/)
  }
  const build = '      - name: Bundle the trusted action\n        run: pnpm exec nx run @resnovas/action:bundle --skip-nx-cache\n'
  assert.ok(native.includes(build))
  const earlyTokens = native.replace(build, '').replace('      - name: Run smartcloud', `${build}\n      - name: Run smartcloud`)
  assert.throws(() => run(earlyTokens, 'Resnovas/smartcloud'), /Required queue checks must execute/)
  for (const directory of directories) {
    const workflow = workflows.find(({ path }) => path === join(directory, 'smartcloud.yml')).lines.join('\n')
    assert.throws(() => run(workflow, 'Resnovas/smartcloud'), /Required queue checks must execute/)
    assert.deepEqual(run(workflow), ['Required smartcloud job and action are unconditional on merge_group.'])
    assert.deepEqual(run(workflow.replaceAll('\n', '\r\n')), run(workflow))
    for (const condition of ["if: github.event_name != 'merge_group'", "if: github.event_name == 'pull_request'", 'if: false', "'if': false", 'needs: optional', 'continue-on-error: true', '<<: *conditional']) {
      assert.throws(() => run(workflow.replace('    name: smartcloud', `    ${condition}\n    name: smartcloud`)), /Required queue checks must execute/)
    }
    for (const changed of [
      workflow.replace('  merge_group:', '  merge_group:\n    branches: [main]'),
      workflow.replace('  merge_group:', '  workflow_run:'),
      workflow.replace('    name: smartcloud', '    name: other'),
      workflow.replace('- uses: resnovas/smartcloud@v2', "- uses: resnovas/smartcloud@v2\n        if: github.event_name != 'merge_group'"),
      workflow.replace('- uses: resnovas/smartcloud@v2', '- uses: resnovas/smartcloud@v2\n        continue-on-error: true'),
    ]) assert.throws(() => run(changed), /Required queue checks must execute/)
  }
})

test('native recipe executes fail-closed queue guards and preserves event-specific token boundaries', () => {
  const recipe = readFileSync(join(root, 'templates/tools/ci/smartcloud-native.yml'), 'utf8')
  const script = recipe.split('        run: |\n')[1].split('\n\n')[0].split('\n').map((line) => line.slice(10)).join('\n')
  const head = 'a'.repeat(40)
  const base = 'b'.repeat(40)
  const ref = 'refs/heads/gh-readonly-queue/main/pr-42-synthetic'
  const event = { action: 'checks_requested', repository: { default_branch: 'main' }, merge_group: { head_ref: ref, base_ref: 'refs/heads/main', base_sha: base, head_sha: head } }
  const env = { GITHUB_REPOSITORY: 'Resnovas/smartcloud', GITHUB_EVENT_NAME: 'merge_group', GITHUB_REF: ref, GITHUB_SHA: head, CHECK_RUN_ID: '42', GITHUB_EVENT_PATH: '/synthetic/event.json' }
  const guard = (payload, variables = env) => runInNewContext(script, {
    process: { env: variables },
    require: (name) => {
      assert.equal(name, 'node:fs')
      return { readFileSync: (path) => { assert.equal(path, '/synthetic/event.json'); return JSON.stringify(payload) } }
    },
  })
  assert.doesNotThrow(() => guard(event))
  for (const payload of [
    {}, { ...event, merge_group: undefined }, { ...event, repository: {} }, { ...event, action: undefined },
    ...[{ head_ref: '' }, { head_ref: 'refs/pull/42/merge' }, { base_ref: 'refs/heads/feature' }, { base_sha: '' }, { head_sha: '' }, { head_sha: base }].map((change) => ({ ...event, merge_group: { ...event.merge_group, ...change } })),
  ]) assert.throws(() => guard(payload), /Require smartcloud repository/)
  for (const change of [{ CHECK_RUN_ID: '' }, { CHECK_RUN_ID: '0' }, { CHECK_RUN_ID: 'abc' }, { GITHUB_REPOSITORY: 'fork/smartcloud' }, { GITHUB_SHA: '' }, { GITHUB_REF: '' }]) {
    assert.throws(() => guard(event, { ...env, ...change }), /Require smartcloud repository/)
  }
  assert.doesNotThrow(() => guard({}, { ...env, GITHUB_EVENT_NAME: 'schedule' }))
  assert.throws(() => guard({}, { ...env, GITHUB_EVENT_NAME: 'push', CHECK_RUN_ID: '' }), /checkRunId/)

  // Evaluate this recipe's GitHub expression subset with GitHub's missing-property empty strings.
  const conditions = [...recipe.matchAll(/^\s+if: >-\n((?: +[^\n]+\n)+?)(?= {4}\w| {8}continue-on-error)/gm)].map((match) => match[1].trim())
  assert.equal(conditions.length, 3)
  const evaluate = (expression, context) => {
    const expanded = expression.replace(/\b(?:github|env)(?:\.[A-Za-z_][\w]*)+/g, (path) => JSON.stringify(path.split('.').reduce((value, key) => value?.[key], context) ?? ''))
    return runInNewContext(expanded, { fromJSON: JSON.parse, contains: (value, item) => value.includes(item) })
  }
  const context = (name, extra = {}) => ({ env: { HAS_APP_KEY: 'true' }, github: { event_name: name, repository: 'Resnovas/smartcloud', actor: 'maintainer', ref_name: 'main', event: { repository: { default_branch: 'main' } }, ...extra } })
  for (const name of ['merge_group', 'push', 'schedule', 'workflow_dispatch', 'pull_request']) {
    assert.equal(evaluate(conditions[0], context(name)), true)
    assert.equal(evaluate(conditions[1], context(name)), true)
    assert.equal(evaluate(conditions[2], context(name)), ['push', 'schedule', 'workflow_dispatch'].includes(name))
  }
  for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR', 'CONTRIBUTOR', 'NONE']) {
    const comment = context('issue_comment', { event: { comment: { body: '/check', author_association: role } } })
    assert.equal(evaluate(conditions[0], comment), ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(role))
    assert.equal(evaluate(conditions[2], comment), false)
  }
  assert.equal(evaluate(conditions[0], context('issue_comment', { event: { comment: { body: 'hello', author_association: 'OWNER' } } })), false)
  assert.equal(evaluate(conditions[2], context('workflow_dispatch', { ref_name: 'feature' })), false)
  for (const repository of ['Resnovas/smartcloud', 'fork/smartcloud', '']) {
    const closed = context('pull_request', { event: { action: 'closed', pull_request: { merged: true, head: { repo: { full_name: repository } }, user: { login: 'maintainer' } } } })
    assert.equal(evaluate(conditions[1], closed), repository === 'Resnovas/smartcloud')
    assert.equal(evaluate(conditions[2], closed), repository === 'Resnovas/smartcloud')
    closed.github.event.pull_request.merged = false
    assert.equal(evaluate(conditions[2], closed), false)
  }
  for (const token of conditions.slice(1)) {
    assert.equal(evaluate(token, context('push', { actor: 'dependabot[bot]' })), false)
    const missingKey = context('push'); missingKey.env.HAS_APP_KEY = 'false'
    assert.equal(evaluate(token, missingKey), false)
  }
})

// A matrix cancels its other combinations when one fails unless fail-fast is
// off, so a failure on one OS or Node version would hide the state of the
// rest, and the aggregate check would report them as cancelled.
test('every matrix job runs every combination', () => {
  const failFast = workflows
    .flatMap(jobs)
    .filter(({ lines }) => lines.some((line) => /^ {4}strategy:/.test(line)))
    .filter(({ lines }) => !lines.some((line) => /^ {6}fail-fast: false\s*$/.test(line)))
    .map(({ path, name }) => `${path} ${name}`)
  assert.deepEqual(failFast, [])
})

// Releases are automatic: the synced house release runs on every push to the
// default branch and releases for real there, and the reusable workflow skips
// a repository that ships no releases instead of failing its pushes.
test('the house release runs on push to the default branch, not only by hand', () => {
  const caller = readFileSync(join(root, 'templates/.github/workflows/house-release.yml'), 'utf8')
  assert.match(caller, /^on:\n {2}push:\n {4}branches: \[main\]\n {2}workflow_dispatch:/m)
  assert.match(caller, /dry-run: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry-run \}\}/)
  const reusable = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8')
  assert.match(reusable, /if \[ "\$EVENT" = push \]; then[\s\S]*?enabled=false/)
  assert.match(reusable, /needs\.config\.outputs\.enabled == 'true'/)
  assert.match(reusable, /jq -r '\.firstRelease \/\/ empty' release\.config\.json/)
})

// A full checkout over a sparse one in the same job left the working tree
// without package.json, so pnpm/action-setup found no pnpm version and every
// nightly failed. A job checks out the repository once, or sparsely only when
// it never checks out again.
test('no job checks out sparsely and then checks out again', () => {
  const mixed = workflows
    .flatMap(jobs)
    .filter(({ lines }) => {
      const checkouts = lines.filter((line) => line.includes('actions/checkout@')).length
      return checkouts > 1 && lines.some((line) => line.trim().startsWith('sparse-checkout:'))
    })
    .map(({ path, name }) => `${path} ${name}`)
  assert.deepEqual(mixed, [])
})

// A glob that leaves out only the root node_modules still walks every
// workspace package's node_modules, which pnpm links into the store: the
// release's changelog upload never finished. Exclusions reach every depth.
test('upload globs leave out node_modules and externals at every depth', () => {
  const shallow = workflows
    .filter(({ lines }) => lines.some((line) => /^\s*!(node_modules|externals)\//.test(line)))
    .map(({ path }) => path)
  assert.deepEqual(shallow, [])
})

// smartcloud's first v2.0.0 publish failed with ENEEDAUTH: trusted publishing
// needs the package to exist on npm. The release explains that, and a re-run
// after a version reached npm skips the publish so the rest of the release
// can finish.
test('the release checks npm before it publishes', () => {
  const lines = workflows.find(({ path }) => path === join('.github/workflows', 'release.yml')).lines
  const publish = lines.findIndex((line) => line.includes('npm publish --provenance'))
  const before = lines.slice(0, publish).join('\n')
  assert.match(before, /npm view "\$name@\$VERSION" version/)
  assert.match(before, /is not on npm yet/)
})

test('the funnel workflow preserves static-first gates and reviewed seven-day publication', () => {
  const workflow = workflows.find(({ path }) => path === join('templates/.github/workflows', 'house-funnel.yml'))
  const [job] = jobs(workflow)
  const text = job.lines.join('\n')
  const commands = job.lines.flatMap((line) => line.match(/^\s+run: node --run (.+)$/)?.[1] ?? [])
  assert.deepEqual(commands, ['verify:static', 'verify', 'verify:evidence', 'verify:evidence:check'])
  assert.match(text, /runs-on: ubuntu-latest/)
  assert.match(text, /contents: read/)
  assert.match(text, /persist-credentials: false/)
  assert.match(text, /steps\.static\.outcome == 'success'/)
  assert.match(text, /steps\.publish\.outcome == 'success'/)
  assert.match(text, /path: \.verification\/publish\//)
  assert.match(text, /retention-days: 7\n/)
  assert.match(text, /if-no-files-found: error/)
  assert.match(text, /include-hidden-files: false/)
  // Missing continue-on-error means false; introducing it must never turn failed verification green.
  const failureModes = job.lines.filter((line) => /^\s+continue-on-error:/.test(line)).map((line) => line.trim().split(':')[1].trim())
  assert.ok(failureModes.every((value) => value === 'false'))
  const ci = workflows.find(({ path }) => path === join('.github/workflows', 'ci.yml'))
  assert.match(jobs(ci).find((candidate) => candidate.name === 'test').lines.join('\n'), /needs: rendered/)
})
