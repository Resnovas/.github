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
