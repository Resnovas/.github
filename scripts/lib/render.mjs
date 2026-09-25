// Substitutes {{KEY}} placeholders in the house templates.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g

// An unknown key is an error rather than a blank, because a silently empty
// copyright holder or contact address is worse than a failed render.
export function renderText(text, values, source = 'template') {
  return text.replace(PLACEHOLDER, (_, key) => {
    if (!(key in values)) throw new Error(`${source}: no value for {{${key}}}`)
    return values[key]
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
