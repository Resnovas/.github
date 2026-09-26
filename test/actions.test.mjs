import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const directories = ['.github/workflows', 'templates/.github/workflows']

// A third-party action is pinned to a full commit SHA, with its release as a
// comment so Dependabot can move both. First-party references, the local
// action and Resnovas repositories, may follow a branch or tag.
const pinned = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/
const firstParty = (ref) => ref.startsWith('./') || /^resnovas\//i.test(ref)

const lines = directories.flatMap((directory) =>
  readdirSync(join(root, directory))
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) => {
      const path = join(directory, name)
      return readFileSync(join(root, path), 'utf8')
        .split('\n')
        .map((line) => ({ path, line }))
    }),
)
const block = /^\s*(?:-\s+)?uses:\s*(.+?)\s*$/
const references = lines.flatMap(({ path, line }) => {
  const ref = line.match(block)?.[1]
  return ref ? [{ path, ref }] : []
})

// The pin checks read block-style lines only, so any other spelling of a uses
// key, such as a flow mapping (- { uses: owner/action@v1 }), fails here
// instead of slipping past them.
test('every uses key is a block-style line', () => {
  const other = lines.filter(({ line }) => /["']?\buses["']?\s*:/.test(line.replace(/#.*$/, '')) && !block.test(line))
  assert.deepEqual(other, [])
})

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
