import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const directories = ['.github/workflows', 'templates/.github/workflows']

// A third-party action is pinned to a full commit SHA, with its release as a
// comment so Dependabot can move both. First-party references, the local
// action and Resnovas repositories, may follow a branch or tag.
const pinned = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/
const firstParty = (ref) => ref.startsWith('./') || /^resnovas\//i.test(ref)

const references = directories.flatMap((directory) =>
  readdirSync(join(root, directory))
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) => {
      const path = join(directory, name)
      return readFileSync(join(root, path), 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*(?:-\s+)?uses:\s*(.+?)\s*$/)?.[1])
        .filter(Boolean)
        .map((ref) => ({ path, ref }))
    }),
)

test('the workflows reference actions', () => {
  assert.ok(references.some(({ ref }) => !firstParty(ref)))
})

test('every third-party action is pinned to a commit SHA with its release', () => {
  const unpinned = references.filter(({ ref }) => !firstParty(ref) && !pinned.test(ref))
  assert.deepEqual(unpinned, [])
})

test('every pin of one action uses the same commit', () => {
  const shas = new Map()
  for (const { ref } of references.filter(({ ref }) => pinned.test(ref))) {
    const [action, rest] = ref.split('@')
    const repository = action.split('/').slice(0, 2).join('/')
    shas.set(repository, new Set([...(shas.get(repository) ?? []), rest]))
  }
  for (const [repository, pins] of shas) assert.equal(pins.size, 1, `${repository} is pinned to ${[...pins].join(', ')}`)
})
