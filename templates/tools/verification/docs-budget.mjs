// Synced from Resnovas/.github templates/tools/verification/docs-budget.mjs. Edit it there.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Bound editable Markdown, not generated mirrors, vendor documentation or legal text. */
export function checkDocs(root) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0')
  const findings = []
  for (const path of new Set(files)) {
    if (!/^(?:AGENTS\.md|CONTRIBUTING\.md|README\.md|docs\/.*\.md|ai-docs\/src\/.*\.md)$/.test(path)) continue
    // Archives are immutable provenance, not current instructions. No caller-supplied exclusions.
    if (/^docs\/archive\//.test(path)) continue
    if (!existsSync(resolve(root, path))) continue
    const text = readFileSync(resolve(root, path), 'utf8')
    const managed = path === 'AGENTS.md' ? text.split('<!-- house:managed:end -->')[0] : text
    const lines = managed.trimEnd().split('\n').length
    const bytes = Buffer.byteLength(managed)
    const maxLines = path === 'AGENTS.md' ? 120 : 400
    const maxBytes = path === 'AGENTS.md' ? 16000 : 32000
    if (lines > maxLines || bytes > maxBytes) findings.push(`${path}: ${lines}/${maxLines} lines, ${bytes}/${maxBytes} bytes. Condense, split by task, or archive obsolete content and update links; do not raise the budget.`)
  }
  return findings
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = checkDocs(process.cwd())
  for (const finding of findings) console.error(finding)
  process.exitCode = findings.length ? 1 : 0
  if (!findings.length) console.log('Editable Markdown is within the house budgets.')
}
