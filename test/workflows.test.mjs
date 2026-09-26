import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
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
