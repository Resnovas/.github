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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { SourceMap } from 'node:module'
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

test('release tools retain sync provenance and release configuration follows the consuming repository', () => {
  for (const tool of ['bundle', 'sourcemaps', 'release', 'nightly', 'release-preview']) {
    const text = readFileSync(join(templates, `tools/release/${tool}.ts`), 'utf8')
    assert.match(text.split('\n').slice(0, 3).join('\n'), /Synced from Resnovas\/\.github/, tool)
    assert.match(text, /loadReleaseConfig\(/, tool)
  }
  // Exercise configuration with distinct consumers instead of banning a product's name in source text.
  assert.equal(load(repository({}, { name: '@synthetic/second-product' })).name, 'second-product')
  assert.equal(load(repository({ name: 'custom-release' }, { name: '@synthetic/third-product' })).name, 'custom-release')
})

test('source-map processing preserves executable headers and uploaded source positions', (t) => {
  const root = repository({ posthog: { projectId: 'test', host: 'https://invalid.example' } })
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'tools', 'release'), { recursive: true })
  for (const tool of ['config', 'sourcemaps']) {
    cpSync(join(templates, `tools/release/${tool}.ts`), join(root, `tools/release/${tool}.ts`))
  }

  // Model the pinned vendor's text prepend at the process boundary. Capture what
  // would be uploaded without credentials, downloads or an external write.
  const vendor = join(root, 'vendor.mjs')
  writeFileSync(vendor, `
    import childProcess from 'node:child_process'
    import { syncBuiltinESMExports } from 'node:module'
    import { copyFileSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
    import { join } from 'node:path'
    const original = childProcess.execFileSync
    childProcess.execFileSync = (command, args, options) => {
      if (command !== 'npx') return original(command, args, options)
      const bundle = join(args[args.indexOf('--directory') + 1], 'bundle.mjs')
      if (args.includes('inject')) {
        writeFileSync(bundle, 'globalThis.injected = true;' + readFileSync(bundle, 'utf8'))
      } else {
        copyFileSync(bundle, ${JSON.stringify(join(root, 'uploaded.mjs'))})
        copyFileSync(bundle + '.map', ${JSON.stringify(join(root, 'uploaded.map'))})
        unlinkSync(bundle + '.map')
      }
    }
    syncBuiltinESMExports()
  `)

  const bundle = join(root, 'bundle.mjs')
  for (const header of ['#!/usr/bin/env node', '#!/usr/bin/env -S node --no-warnings\r', '']) {
    for (const upload of [true, false]) {
      writeFileSync(bundle, `${header}\nconsole.log('release smoke')\nthrow new Error('mapped failure')\n//# sourceMappingURL=bundle.mjs.map\n`)
      writeFileSync(`${bundle}.map`, JSON.stringify({
        version: 3, sources: ['entry.ts'], names: [], mappings: ';AAAA;AACA',
      }))
      execFileSync(process.execPath, ['--import', pathToFileURL(vendor).href, join(root, 'tools/release/sourcemaps.ts'), '1.2.3', bundle], {
        env: { ...process.env, POSTHOG_CLI_API_KEY: upload ? 'not-a-credential' : '' },
        stdio: 'pipe',
      })
      execFileSync(process.execPath, ['--check', bundle], { stdio: 'pipe' })
      const output = readFileSync(bundle, 'utf8')
      if (header) assert.ok(output.startsWith(`${header}\n`))
      else assert.ok(!output.startsWith('#!'))
      assert.equal(existsSync(`${bundle}.map`), false)
      assert.doesNotMatch(output, /sourceMappingURL/)
      if (!upload) continue
      const uploaded = readFileSync(join(root, 'uploaded.mjs'), 'utf8')
      assert.match(uploaded, /globalThis.injected = true;/)
      const sourceMap = new SourceMap(JSON.parse(readFileSync(join(root, 'uploaded.map'), 'utf8')))
      const lines = uploaded.split('\n')
      for (const [sourceLine, statement] of ["console.log('release smoke')", "throw new Error('mapped failure')"].entries()) {
        const generatedLine = lines.findIndex((line) => line === statement)
        const mapped = sourceMap.findEntry(generatedLine, 0)
        assert.equal(mapped.originalLine, sourceLine)
        assert.equal(mapped.originalColumn, 0)
        assert.equal(mapped.originalSource, 'entry.ts')
      }
    }
  }
})
