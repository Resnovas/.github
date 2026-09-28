/**
 * @file scripts/lib/render.mjs
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

// Substitutes {{KEY}} placeholders in the house templates.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// A key, optionally followed by `:-` and a default used when the key has no
// value, as smartcloud's sync renders it. Linear time: no nested quantifiers.
const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)(?::-([^{}\n]*))?\}\}/g

// An unknown key without a default is an error rather than a blank, because a
// silently empty copyright holder or contact address is worse than a failed
// render. {{KEY:-default}} is for a value each repository may set but need not.
export function renderText(text, values, source = 'template') {
  return text.replace(PLACEHOLDER, (_, key, fallback) => {
    if (Object.hasOwn(values, key)) return values[key]
    if (fallback !== undefined) return fallback
    throw new Error(`${source}: no value for {{${key}}}`)
  })
}

export function listTemplates(root) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else files.push(relative(root, path))
    }
  }
  walk(root)
  return files.sort()
}

// Returns [{ path, content }] for every template, with paths relative to the
// output root.
export function renderAll(templatesRoot, values) {
  return listTemplates(templatesRoot).map((path) => ({
    path,
    content: renderText(readFileSync(join(templatesRoot, path), 'utf8'), values, path),
  }))
}
