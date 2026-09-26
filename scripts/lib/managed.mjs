// Managed blocks: how a synced config file stays extendable.
//
// A template containing a `house:managed:begin` ... `house:managed:end` pair
// is extendable. The sync only ever replaces the lines between the markers;
// everything a repository adds outside them is kept. A `house:local` line in
// the template marks where local additions belong, and is where a file's
// previous content is parked the first time it is adopted.
//
// A template without markers is fully managed: the whole file is synced.

export const BEGIN = 'house:managed:begin'
export const END = 'house:managed:end'
export const LOCAL = 'house:local'

// A marker only counts on a comment line: `# ...` in YAML, TOML and
// CODEOWNERS, `// ...` in JSON with comments (editor settings), or `<!-- ...`
// in Markdown. A document that merely mentions a marker in its prose, as
// GOVERNANCE does, stays a whole-file document.
export function isMarker(line, marker) {
  return new RegExp(`^\\s*(?:#|//|<!--)\\s*${marker}(?![\\w:-])`).test(line)
}

export function splitManaged(text) {
  const lines = text.split('\n')
  const begin = lines.findIndex((line) => isMarker(line, BEGIN))
  const end = lines.findIndex((line) => isMarker(line, END))
  if (begin === -1 || end === -1 || end < begin) return null
  return { before: lines.slice(0, begin), block: lines.slice(begin, end + 1), after: lines.slice(end + 1) }
}

const isMarkdown = (path) => path.endsWith('.md')
const isJson = (path) => /\.jsonc?$/.test(path)

// The line comment for a file's format; Markdown has none.
const lineComment = (path) => (isJson(path) ? '//' : '#')

function commentOut(lines, path) {
  if (isMarkdown(path)) return ['<!--', ...lines.map((line) => line.replace(/-->/g, '-- >')), '-->']
  const comment = lineComment(path)
  return lines.map((line) => (line === '' ? comment : `${comment} ${line}`))
}

function legacyNotice(path) {
  const text = 'Previous content of this file, kept when it was first synced. Re-add what is still needed as local rules, then delete this.'
  return isMarkdown(path) ? `<!-- ${text} -->` : `${lineComment(path)} ${text}`
}

// Combines the freshly rendered template with the repository's current file.
//   rendered  the template after placeholder substitution
//   existing  the file in the repository, or null if it does not exist
export function mergeManaged(rendered, existing, path) {
  const template = splitManaged(rendered)
  if (!template || existing === null) return rendered
  const current = splitManaged(existing)
  if (current) return [...current.before, ...template.block, ...current.after].join('\n')

  // First adoption of a file the repository already had: keep its content,
  // commented out, where local additions go, so nothing is lost silently.
  const lines = rendered.split('\n')
  const at = lines.findIndex((line) => isMarker(line, LOCAL))
  const legacy = [legacyNotice(path), ...commentOut(existing.replace(/\n+$/, '').split('\n'), path)]
  const insertAt = at === -1 ? lines.length : at + 1
  return [...lines.slice(0, insertAt), ...legacy, ...lines.slice(insertAt)].join('\n')
}

const meaningful = (lines) => lines.filter((line) => line.trim() !== '' && !/^\s*(#|\/\/|<!--|-->)/.test(line))
const strip = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2')

function topLevelKeys(lines) {
  return new Set(lines.map((line) => /^([A-Za-z_][\w-]*):/.exec(line)?.[1]).filter(Boolean))
}

// Dependabot identifies an update by ecosystem, directory and target branch;
// a duplicate is a configuration error.
function dependabotEntries(lines) {
  const entries = []
  let current = null
  for (const line of lines) {
    const start = /^\s*-\s+package-ecosystem:\s*(.+)$/.exec(line)
    if (start) {
      current = { ecosystem: strip(start[1]), directory: '/', branch: '' }
      entries.push(current)
      continue
    }
    if (!current) continue
    const directory = /^\s+director(?:y|ies):\s*(.+)$/.exec(line)
    if (directory) current.directory = strip(directory[1])
    const branch = /^\s+target-branch:\s*(.+)$/.exec(line)
    if (branch) current.branch = strip(branch[1])
  }
  return entries.map((e) => `${e.ecosystem} in ${e.directory}${e.branch ? ` on ${e.branch}` : ''}`)
}

// The names editors identify an entry by: task and debug `label`, VS Code
// `name`, and surfaces `id`. A local entry reusing one shadows the synced one.
const jsonNames = (lines) =>
  lines.map((line) => /^\s*\{?\s*"(?:label|name|id)"\s*:\s*"([^"]*)"/.exec(line)?.[1]).filter(Boolean)

const ids = (lines) => lines.map((line) => /^\s+id:\s*(\S+)/.exec(line)?.[1]).filter(Boolean)

// TOML table headers, `[name]`. Defining a table twice is a parse error, so a
// local table may not reuse a synced one; an array of tables, `[[name]]`, is
// meant to repeat.
const tomlTables = (lines) => lines.map((line) => /^\s*\[(?!\[)\s*([^\]]+?)\s*\](?:\s*#.*)?$/.exec(line)?.[1]).filter(Boolean)

// Workflow job ids are the two-space keys under `jobs:`.
function jobIds(lines) {
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line))
  if (start === -1) return []
  return lines.slice(start + 1).map((line) => /^ {2}([\w-]+):\s*$/.exec(line)?.[1]).filter(Boolean)
}

// Local additions that would change or break the synced rules. Returns
// human-readable problems for one file.
export function managedConflicts(path, rendered, current) {
  const template = splitManaged(rendered)
  const local = splitManaged(current)
  if (!template || !local) return []
  const problems = []
  const localLines = [...local.before, ...local.after]
  const templateLocalIsBefore = template.before.some((line) => isMarker(line, LOCAL))

  // Where the managed block must come last (CODEOWNERS: the last matching
  // rule wins), nothing may follow it.
  if (templateLocalIsBefore && meaningful(local.after).length > 0) {
    problems.push('local rules after the managed block would override it; move them above the block')
  }

  if (/\.ya?ml$/.test(path)) {
    const managed = topLevelKeys(template.block)
    for (const key of topLevelKeys(localLines)) {
      if (managed.has(key)) problems.push(`redefines the synced key "${key}"`)
    }
    const managedIds = new Set(ids(template.block))
    for (const id of ids(localLines)) {
      if (managedIds.has(id)) problems.push(`reuses the synced field id "${id}"`)
    }
    // A workflow's managed block ends inside `jobs:`, so local jobs follow it.
    const managedJobs = new Set(jobIds(template.block))
    for (const job of jobIds(['jobs:', ...local.after])) {
      if (managedJobs.has(job)) problems.push(`redefines the synced job "${job}"`)
    }
  }

  if (path.endsWith('.toml')) {
    const managed = new Set(tomlTables(template.block))
    for (const table of tomlTables(localLines)) {
      if (managed.has(table)) problems.push(`redefines the synced table "${table}"`)
    }
  }

  if (isJson(path)) {
    const managed = new Set(jsonNames(template.block))
    for (const name of jsonNames(localLines)) {
      if (managed.has(name)) problems.push(`reuses the synced name "${name}"`)
    }
  }

  if (path.endsWith('dependabot.yml')) {
    const managed = new Set(dependabotEntries(template.block))
    for (const entry of dependabotEntries(localLines)) {
      if (managed.has(entry)) problems.push(`duplicates the synced Dependabot update for ${entry}`)
    }
  }
  return problems
}

// Findings for a pull request that edits synced content.
//   files  [{ path, rendered, base, head }] where base and head are the file
//          on the base branch and in the pull request, or null if absent
// A change is allowed when it leaves synced content as it was on the base
// branch, or brings it in line with the latest templates (a sync).
export function syncFindings(files) {
  const findings = []
  for (const { path, rendered, base, head } of files) {
    const template = splitManaged(rendered)
    if (head === null) {
      if (base !== null) findings.push({ path, message: 'deletes a synced file' })
      continue
    }
    if (!template) {
      if (head !== base && head !== rendered) findings.push({ path, message: 'edits a synced file' })
      continue
    }
    const headParts = splitManaged(head)
    if (!headParts) {
      if (head !== base) findings.push({ path, message: 'removes the house:managed markers' })
      continue
    }
    const baseBlock = base === null ? null : splitManaged(base)?.block.join('\n')
    const headBlock = headParts.block.join('\n')
    if (headBlock !== baseBlock && headBlock !== template.block.join('\n')) {
      findings.push({ path, message: 'edits the managed block; add local rules outside it' })
    }
    for (const problem of managedConflicts(path, rendered, head)) findings.push({ path, message: problem })
  }
  return findings
}
