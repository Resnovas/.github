// Synced from Resnovas/.github templates/tools/dev/pre-commit.mjs. Edit it there.
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const hook = '#!/bin/sh\n# house:pre-commit\nexec node "$(git rev-parse --show-toplevel)/tools/dev/pre-commit.mjs" run\n'

/** Install only into an empty hook slot; foreign hooks require explicit composition. */
export function installPreCommit(root, dryRun = false) {
  const hooks = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8' }).trim()
  const path = resolve(root, hooks, 'pre-commit')
  if (existsSync(path) && readFileSync(path, 'utf8') !== hook) {
    throw new Error('Preserve the existing pre-commit hook. Add node tools/dev/pre-commit.mjs run to it, or review and replace it explicitly; setup will not overwrite it.')
  }
  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, hook)
    chmodSync(path, 0o755)
  }
  return `Pre-commit hook: ${dryRun ? 'would install' : 'installed'}.`
}

/** Reject partial staging before running the same static and behavioral package gates as CI. */
export function runPreCommit(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const assertSnapshot = () => {
    if (git('diff', '--name-only').trim() || git('ls-files', '--others', '--exclude-standard').trim()) {
      throw new Error('Verification must match the commit. Stage or preserve unstaged/untracked work before committing; do not auto-stash or certify a different working tree.')
    }
  }
  assertSnapshot()
  const index = git('write-tree').trim()
  const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts
  for (const name of ['verify:static', 'verify']) {
    if (!scripts?.[name]) throw new Error(`Define package script ${name} with the repository gates; do not substitute an empty success.`)
    const result = spawnSync(process.execPath, ['--run', name], { cwd: root, stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${name} failed. Fix the reported path; do not skip checks or weaken coverage.`)
    assertSnapshot()
    if (git('write-tree').trim() !== index) throw new Error('The staged tree changed during verification. Review it and rerun the commit.')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'run') throw new Error('Usage: node tools/dev/pre-commit.mjs run')
    runPreCommit(process.cwd())
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
