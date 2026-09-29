/**
 * @file scripts/lib/values.mjs
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

// Reads the flat `KEY: value` files used for house values (house.yml).
// Deliberately not a YAML parser: the format is restricted to one key per line
// so the renderer has no dependencies and cannot be surprised by YAML features.

import { readFileSync, existsSync } from 'node:fs'

const LINE = /^([A-Z][A-Z0-9_]*):\s*(.*?)\s*$/

export function parseValues(text, source = 'values') {
  const values = {}
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/\s+#.*$/, '').trim()
    if (line === '' || line.startsWith('#')) return
    const match = LINE.exec(line)
    if (!match) {
      throw new Error(`${source}:${index + 1}: expected "KEY: value", got "${raw}"`)
    }
    const [, key, rawValue] = match
    // Quotes are optional; strip one matching pair so values may contain '#'.
    values[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  })
  return values
}

export function loadValues(path, { optional = false } = {}) {
  if (!existsSync(path)) {
    if (optional) return {}
    throw new Error(`values file not found: ${path}`)
  }
  return parseValues(readFileSync(path, 'utf8'), path)
}

// Comma-separated values become trimmed, non-empty lists.
export function list(value) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}
