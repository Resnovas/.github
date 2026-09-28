/**
 * @file test/release-tools.test.mjs
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
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const templates = fileURLToPath(new URL('../templates/', import.meta.url))
// An import specifier must be a URL: a Windows path such as D:\... reads as a d: scheme.
const config = pathToFileURL(join(templates, 'tools/release/config.ts')).href

// The tools run on Node's own TypeScript support; the flag is a no-op where stripping is on by default.
const node = (script) =>
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const load = (root) =>
  JSON.parse(
    node(
      `import { loadReleaseConfig } from ${JSON.stringify(config)}; console.log(JSON.stringify(loadReleaseConfig(${JSON.stringify(root)})))`,
    ),
  )

const repository = (release, manifest = { name: '@example/thing' }) => {
  const root = mkdtempSync(join(tmpdir(), 'release-config-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  writeFileSync(join(root, 'release.config.json'), JSON.stringify(release))
  return root
}

test('an empty config takes every default, with the release named after the package', () => {
  assert.deepEqual(load(repository({})), {
    name: 'thing',
    firstRelease: '1.0.0',
    majorTag: false,
    bundles: [],
    dropFromReleaseCommit: [],
    apps: [],
    versionGlobal: '__APP_VERSION__',
  })
})

test('a full config is kept, with the error tracking host defaulted', () => {
  const full = {
    name: 'smartcloud',
    firstRelease: '2.0.0',
    majorTag: true,
    bundles: [{ target: '@resnovas/action:bundle', output: 'dist/index.js', project: '@resnovas/action' }],
    dropFromReleaseCommit: ['externals'],
    apps: ['apps/action', 'apps/cli'],
    nightly: { major: 2 },
    posthog: { projectId: '285077' },
    npm: {
      prepare: 'node tools/release/prepare-cli.ts',
      directory: 'apps/cli/release',
      bundleTargets: ['@resnovas/smartcloud:bundle'],
      sbomProjects: ['@resnovas/smartcloud'],
    },
    versionGlobal: '__SMARTCLOUD_VERSION__',
  }
  assert.deepEqual(load(repository(full)), { ...full, posthog: { host: 'https://eu.posthog.com', projectId: '285077' } })
})

test('a wrong field is named in the error', () => {
  for (const [release, path] of [
    [{ majorTag: 'yes' }, 'majorTag'],
    [{ bundles: [{ target: 'x' }] }, 'bundles[0].output'],
    [{ nightly: { major: 'two' } }, 'nightly.major'],
    [{ npm: { prepare: 'x' } }, 'npm.directory'],
    [{ apps: 'apps/action' }, 'apps'],
  ]) {
    assert.throws(() => load(repository(release)), (error) => String(error.stderr).includes(`release.config.json: ${path} must be`))
  }
})

test('the SBOM file name follows pnpm sbom', () => {
  const out = node(`import { sbomFileName } from ${JSON.stringify(config)}; console.log(sbomFileName('@resnovas/action', '2.0.0'))`)
  assert.equal(out.trim(), 'resnovas-action-2.0.0.spdx.json')
})

test('every release tool starts with the sync marker, and the ones that act read the config, not a repository name', () => {
  for (const tool of ['bundle', 'sourcemaps', 'release', 'nightly', 'release-preview']) {
    const text = readFileSync(join(templates, `tools/release/${tool}.ts`), 'utf8')
    assert.match(text.split('\n').slice(0, 3).join('\n'), /Synced from Resnovas\/\.github/, tool)
    assert.match(text, /loadReleaseConfig\(/, tool)
    assert.doesNotMatch(text, /smartcloud/i, tool)
  }
})
