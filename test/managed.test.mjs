import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BEGIN, END, LOCAL, isMarker, managedConflicts, mergeManaged, splitManaged, syncFindings } from '../scripts/lib/managed.mjs'

const dependabot = [
  '# house:managed:begin - synced',
  'version: 2',
  'updates:',
  '  - package-ecosystem: npm',
  '    directory: /',
  '# house:managed:end',
  '# house:local - add further updates below.',
  '',
].join('\n')

const withLocal = (template, local) => template.replace('# house:local - add further updates below.\n', `# house:local - add further updates below.\n${local}\n`)

test('a file without markers is fully managed', () => {
  assert.equal(splitManaged('plain\ntext'), null)
  assert.equal(mergeManaged('new', 'old', 'SECURITY.md'), 'new')
})

test('a new file gets the whole template', () => {
  assert.equal(mergeManaged(dependabot, null, '.github/dependabot.yml'), dependabot)
})

test('the managed block is replaced and local additions are kept', () => {
  const current = withLocal(dependabot.replace('npm', 'yarn-was-edited'), '  - package-ecosystem: pip\n    directory: /api')
  const merged = mergeManaged(dependabot, current, '.github/dependabot.yml')
  assert.match(merged, /package-ecosystem: npm/)
  assert.doesNotMatch(merged, /yarn-was-edited/)
  assert.match(merged, /package-ecosystem: pip\n {4}directory: \/api/)
})

test('first adoption keeps the previous file, commented out at the local marker', () => {
  const merged = mergeManaged(dependabot, 'version: 2\nupdates: []\n', '.github/dependabot.yml')
  const parts = splitManaged(merged)
  assert.ok(parts)
  assert.deepEqual(parts.after.slice(1, 4), [
    '# Previous content of this file, kept when it was first synced. Re-add what is still needed as local rules, then delete this.',
    '# version: 2',
    '# updates: []',
  ])
})

test('first adoption of a Markdown file wraps the previous content in a comment', () => {
  const template = '<!-- house:managed:begin -->\n## Summary\n<!-- house:managed:end -->\n<!-- house:local -->\n'
  const merged = mergeManaged(template, 'Old --> text', '.github/PULL_REQUEST_TEMPLATE.md')
  assert.match(merged, /<!-- house:local -->\n<!-- Previous content[^\n]*-->\n<!--\nOld -- > text\n-->/)
})

test('first adoption without a local marker appends the previous content', () => {
  const template = '# house:managed:begin\na: 1\n# house:managed:end'
  assert.match(mergeManaged(template, 'b: 2', 'x.yml'), /# house:managed:end\n# Previous content[^\n]*\n# b: 2$/)
})

test('a local Dependabot update may not duplicate a synced one', () => {
  const clash = withLocal(dependabot, '  - package-ecosystem: npm\n    directory: "/"')
  assert.deepEqual(managedConflicts('.github/dependabot.yml', dependabot, clash), ['duplicates the synced Dependabot update for npm in /'])
  const other = withLocal(dependabot, '  - package-ecosystem: npm\n    directory: /web\n    target-branch: next')
  assert.deepEqual(managedConflicts('.github/dependabot.yml', dependabot, other), [])
})

test('local YAML may not redefine a synced top-level key', () => {
  const funding = '# house:managed:begin\ngithub: [TGTGamer]\n# house:managed:end\n# house:local\n'
  assert.deepEqual(managedConflicts('.github/FUNDING.yml', funding, `${funding}github: [someone]\n`), ['redefines the synced key "github"'])
  assert.deepEqual(managedConflicts('.github/FUNDING.yml', funding, `${funding}custom: ['https://x.io']\n`), [])
})

test('local issue form fields may not reuse a synced id', () => {
  const form = '# house:managed:begin\nbody:\n  - type: input\n    id: version\n# house:managed:end\n# house:local\n'
  assert.deepEqual(managedConflicts('.github/ISSUE_TEMPLATE/bug.yml', form, `${form}  - type: input\n    id: version\n`), ['reuses the synced field id "version"'])
})

test('local workflow jobs may not redefine a synced job', () => {
  const workflow = '# house:managed:begin\njobs:\n  house-policy:\n    uses: x\n# house:managed:end\n# house:local\n'
  assert.deepEqual(managedConflicts('.github/workflows/house-policy.yml', workflow, `${workflow}  house-policy:\n    uses: y\n`), ['redefines the synced job "house-policy"'])
  assert.deepEqual(managedConflicts('.github/workflows/house-policy.yml', workflow, `${workflow}  lint:\n    runs-on: x\n`), [])
})

test('nothing may follow a managed block that must come last', () => {
  const owners = '# house:local\n* @me\n# house:managed:begin\n/LICENSE @admin\n# house:managed:end\n'
  assert.deepEqual(managedConflicts('.github/CODEOWNERS', owners, `${owners}/LICENSE @someone\n`), [
    'local rules after the managed block would override it; move them above the block',
  ])
  assert.deepEqual(managedConflicts('.github/CODEOWNERS', owners, owners.replace('* @me', '* @me\n/api/ @api-team')), [])
})

test('conflict checks ignore files without markers on either side', () => {
  assert.deepEqual(managedConflicts('x.yml', 'a: 1', 'a: 2'), [])
  assert.deepEqual(managedConflicts('x.yml', dependabot, 'a: 2'), [])
})

test('sync findings: documents may not be edited, only synced', () => {
  const doc = { path: 'SECURITY.md', rendered: 'new', base: 'old' }
  assert.deepEqual(syncFindings([{ ...doc, head: 'old' }]), [])
  assert.deepEqual(syncFindings([{ ...doc, head: 'new' }]), [])
  assert.deepEqual(syncFindings([{ ...doc, head: 'mine' }]), [{ path: 'SECURITY.md', message: 'edits a synced file' }])
  assert.deepEqual(syncFindings([{ ...doc, head: null }]), [{ path: 'SECURITY.md', message: 'deletes a synced file' }])
  assert.deepEqual(syncFindings([{ ...doc, base: null, head: null }]), [])
})

test('sync findings: managed blocks may not be edited, local rules may be added', () => {
  const base = { path: '.github/dependabot.yml', rendered: dependabot, base: dependabot }
  assert.deepEqual(syncFindings([{ ...base, head: withLocal(dependabot, '  - package-ecosystem: pip\n    directory: /api') }]), [])
  assert.deepEqual(syncFindings([{ ...base, head: dependabot.replace('npm', 'bun') }]), [
    { path: '.github/dependabot.yml', message: 'edits the managed block; add local rules outside it' },
  ])
  assert.deepEqual(syncFindings([{ ...base, head: 'version: 2\n' }]), [{ path: '.github/dependabot.yml', message: 'removes the house:managed markers' }])
  assert.deepEqual(syncFindings([{ ...base, base: 'version: 2\n', head: 'version: 2\n' }]), [])
})

test('sync findings: a sync that brings the block up to date is allowed', () => {
  const stale = dependabot.replace('npm', 'yarn')
  assert.deepEqual(syncFindings([{ path: '.github/dependabot.yml', rendered: dependabot, base: stale, head: dependabot }]), [])
  assert.deepEqual(syncFindings([{ path: '.github/dependabot.yml', rendered: dependabot, base: null, head: dependabot }]), [])
})

test('markers only count on comment lines, so a document quoting them is synced whole', () => {
  const doc = [
    '= Governance',
    '',
    '* Configuration contains a block between `house:managed:begin` and `house:managed:end`.',
    'A repository adds its own rules at the `house:local` line.',
    '',
  ].join('\n')
  assert.equal(splitManaged(doc), null)
  assert.equal(mergeManaged(doc, 'the previous document\n', 'GOVERNANCE.md'), doc)
})

test('isMarker accepts YAML and Markdown comment markers and rejects look-alikes', () => {
  assert.ok(isMarker('# house:managed:begin - synced', BEGIN))
  assert.ok(isMarker('  <!-- house:managed:end -->', END))
  assert.ok(isMarker('# house:local - add rules below', LOCAL))
  assert.ok(!isMarker('Mentions `house:managed:begin` in prose', BEGIN))
  assert.ok(!isMarker('#house:managed:beginning', BEGIN))
  assert.ok(!isMarker('// house:managed:begin', BEGIN))
})
