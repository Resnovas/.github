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
