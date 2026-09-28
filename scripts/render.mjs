#!/usr/bin/env node
/**
 * @file scripts/render.mjs
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

// Renders templates/ into a repository.
//
//   node scripts/render.mjs                      render into this repository's root
//   node scripts/render.mjs --check              exit 1 if the root is out of date
//   node scripts/render.mjs --out <dir> --override <dir>/.github/house.yml --repository owner/name
//
// Values come from house.yml, then the optional override file, then
// --repository, each layer replacing keys from the one before.
//
// Files with a house:managed block keep everything the repository added
// outside the block (scripts/lib/managed.mjs); other files are replaced whole.
// A template with the owner execute bit, such as tools/graphify/graphify, is
// rendered executable.

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { list, loadValues } from './lib/values.mjs'
import { renderAll } from './lib/render.mjs'
import { managedConflicts, mergeManaged } from './lib/managed.mjs'

const houseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: houseRoot },
    override: { type: 'string' },
    repository: { type: 'string' },
    check: { type: 'boolean', default: false },
  },
})

const values = {
  ...loadValues(join(houseRoot, 'house.yml')),
  ...(args.override ? loadValues(args.override, { optional: true }) : {}),
  ...(args.repository ? { REPOSITORY: args.repository } : {}),
}

// HOUSE_EXCLUDE lets a repository keep its own copy of a file, for example a
// LICENSE its dependencies require.
const excluded = new Set(list(values.HOUSE_EXCLUDE))
const rendered = renderAll(join(houseRoot, 'templates'), values).filter(({ path }) => !excluded.has(path))
const stale = []

for (const { path, content: template } of rendered) {
  const target = join(args.out, path)
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null
  const content = mergeManaged(template, current, path)
  for (const problem of managedConflicts(path, template, content)) {
    console.log(`::warning file=${path},title=house sync::${problem}`)
  }
  const executable = (statSync(join(houseRoot, 'templates', path)).mode & 0o100) !== 0
  const modeStale = executable && existsSync(target) && (statSync(target).mode & 0o100) === 0
  if (current === content && !modeStale) continue
  stale.push(path)
  if (!args.check) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    if (executable) chmodSync(target, 0o755)
  }
}

if (args.check && stale.length > 0) {
  console.error(`Out of date with templates/ (run: node scripts/render.mjs):\n  ${stale.join('\n  ')}`)
  process.exit(1)
}
console.log(args.check ? 'Rendered files are up to date.' : `Rendered ${rendered.length} files, ${stale.length} changed.`)
