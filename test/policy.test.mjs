import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluatePullRequest,
  evaluateReviews,
  isAiIdentity,
  parseDisclosure,
  parseTrailers,
} from '../scripts/lib/policy.mjs'

const config = { maintainers: ['owner-one'], trustedBots: ['dependabot[bot]'] }
const twoMaintainers = { maintainers: ['owner-one', 'owner-two'], trustedBots: [] }

const body = ({ level = 'agent', tools = 'Claude Code (claude-opus-5-5)', accountable = '@contrib', review = 'Read every line; ran pnpm nx test auth, log attached.' } = {}) =>
  `## What changed and why\nFixes expiry.\n\n## AI disclosure\nAI level: ${level}\nAI tools: ${tools}\nAccountable human: ${accountable}\nHuman review: ${review}\n`

const pr = (overrides = {}) => ({
  title: 'fix(auth): reject expired tokens',
  body: body(),
  draft: false,
  user: { login: 'contrib' },
  author_association: 'CONTRIBUTOR',
  ...overrides,
})

const signed = 'Signed-off-by: A Contributor <contrib@example.com>'
const coAuthor = 'Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>'
const commit = (message, extra = {}) => ({ sha: 'a'.repeat(40), message, authorEmail: 'contrib@example.com', parents: 1, ...extra })

const rules = (findings, level) => findings.filter((f) => !level || f.level === level).map((f) => f.rule)

test('a compliant AI-assisted pull request passes', () => {
  const findings = evaluatePullRequest({ pr: pr(), commits: [commit(`fix: x\n\n${coAuthor}\n${signed}`)], config, action: 'ready_for_review' })
  assert.deepEqual(findings, [])
})

test('a compliant pull request with no AI passes', () => {
  const findings = evaluatePullRequest({
    pr: pr({ body: body({ level: 'none', tools: 'none', review: '' }) }),
    commits: [commit(`fix: x\n\n${signed}`)],
    config,
    action: 'opened',
  })
  assert.deepEqual(findings, [])
})

test('missing or invalid disclosure fails AI-01', () => {
  const missing = evaluatePullRequest({ pr: pr({ body: 'no disclosure' }), commits: [commit(`x\n\n${signed}`)], config, action: 'edited' })
  assert.deepEqual(rules(missing, 'error'), ['AI-01'])
  const invalid = evaluatePullRequest({ pr: pr({ body: body({ level: 'some' }) }), commits: [commit(`x\n\n${coAuthor}\n${signed}`)], config, action: 'edited' })
  assert.ok(rules(invalid, 'error').includes('AI-01'))
})

test('template guidance inside HTML comments is not read as an answer', () => {
  const disclosure = parseDisclosure('<!--\nAI level: agent\n-->\nAI level:\n')
  assert.equal(disclosure.level, null)
})

test('an AI level other than none must name tools and credit a co-author', () => {
  const findings = evaluatePullRequest({ pr: pr({ body: body({ tools: 'none' }) }), commits: [commit(`x\n\n${signed}`)], config, action: 'edited' })
  assert.deepEqual(rules(findings, 'error').sort(), ['AI-01', 'AI-02'])
})

test('claiming no AI while crediting an AI co-author is inconsistent', () => {
  const findings = evaluatePullRequest({
    pr: pr({ body: body({ level: 'none', tools: 'none' }) }),
    commits: [commit(`x\n\n${coAuthor}\n${signed}`)],
    config,
    action: 'edited',
  })
  assert.deepEqual(rules(findings, 'error'), ['AI-01'])
})

test('an AI tool can never sign off, even for a maintainer', () => {
  const findings = evaluatePullRequest({
    pr: pr({ user: { login: 'owner-one' }, author_association: 'OWNER', body: body({ accountable: '@owner-one' }) }),
    commits: [commit(`x\n\n${coAuthor}\nSigned-off-by: Claude <noreply@anthropic.com>\n${signed}`)],
    config,
    action: 'edited',
  })
  assert.deepEqual(rules(findings, 'error'), ['AI-03'])
})

test('every non-merge commit needs a sign-off matching its author', () => {
  const findings = evaluatePullRequest({
    pr: pr(),
    commits: [commit(`x\n\n${coAuthor}\nSigned-off-by: Someone Else <else@example.com>`), commit('Merge main', { parents: 2 })],
    config,
    action: 'edited',
  })
  assert.deepEqual(rules(findings, 'error'), ['DCO'])
})

test('AI-assisted pull requests must be opened as drafts', () => {
  const opened = evaluatePullRequest({ pr: pr(), commits: [commit(`x\n\n${coAuthor}\n${signed}`)], config, action: 'opened' })
  assert.deepEqual(rules(opened, 'error'), ['AI-20'])
  const asDraft = evaluatePullRequest({ pr: pr({ draft: true, body: body({ accountable: '', review: '' }) }), commits: [commit(`x\n\n${coAuthor}\n${signed}`)], config, action: 'opened' })
  assert.deepEqual(asDraft, [])
})

test('leaving draft requires the author as accountable human and a review statement', () => {
  const findings = evaluatePullRequest({
    pr: pr({ body: body({ accountable: '@someone-else', review: '' }) }),
    commits: [commit(`x\n\n${coAuthor}\n${signed}`)],
    config,
    action: 'ready_for_review',
  })
  assert.deepEqual(rules(findings, 'error'), ['AI-21', 'AI-21'])
})

test('maintainer pull requests report policy errors as warnings', () => {
  const findings = evaluatePullRequest({
    pr: pr({ user: { login: 'owner-one' }, author_association: 'OWNER', title: 'tidy things', body: 'nothing' }),
    commits: [commit('x', { authorEmail: 'owner@example.com' })],
    config,
    action: 'opened',
  })
  assert.ok(findings.length > 0)
  assert.deepEqual(rules(findings, 'error'), [])
})

test('trusted automation accounts are skipped', () => {
  const findings = evaluatePullRequest({ pr: pr({ user: { login: 'dependabot[bot]' }, body: '' }), commits: [commit('x')], config, action: 'opened' })
  assert.deepEqual(findings, [])
})

test('non-conventional titles fail', () => {
  const findings = evaluatePullRequest({ pr: pr({ title: 'Fixed the thing' }), commits: [commit(`x\n\n${coAuthor}\n${signed}`)], config, action: 'edited' })
  assert.deepEqual(rules(findings, 'error'), ['TITLE'])
})

test('emoji, dashes and unticked checklists are style warnings', () => {
  const findings = evaluatePullRequest({
    pr: pr({ body: `${body()}\nGreat \u{1F680} work \u2014 done\n- [ ] tested` }),
    commits: [commit(`x\n\n${coAuthor}\n${signed}`)],
    config,
    action: 'edited',
  })
  assert.deepEqual(rules(findings, 'warning'), ['STYLE', 'STYLE', 'STYLE'])
  assert.deepEqual(rules(findings, 'error'), [])
})

test('trailers are parsed case-insensitively', () => {
  const { coAuthors, signOffs } = parseTrailers('x\n\nco-authored-by: Bot <A@Anthropic.com>\nSIGNED-OFF-BY: Me <me@x.io>')
  assert.deepEqual(coAuthors, [{ name: 'Bot', email: 'a@anthropic.com' }])
  assert.deepEqual(signOffs, [{ name: 'Me', email: 'me@x.io' }])
})

test('AI identities are recognised by address or tool name', () => {
  assert.ok(isAiIdentity({ name: 'Claude', email: 'noreply@anthropic.com' }))
  assert.ok(isAiIdentity({ name: 'Aider (gpt-5)', email: 'aider@ai.invalid' }))
  assert.ok(isAiIdentity({ name: 'GitHub Copilot', email: 'x@users.noreply.github.com' }))
  assert.ok(!isAiIdentity({ name: 'Jane Doe', email: 'jane@example.com' }))
})

test('review gate is open with fewer than two maintainers', () => {
  const result = evaluateReviews({ pr: pr(), reviews: [], config })
  assert.equal(result.required, 0)
  assert.deepEqual(result.findings, [])
})

test('outside contributions need two maintainer approvals', () => {
  const one = evaluateReviews({ pr: pr(), reviews: [{ user: { login: 'owner-one' }, state: 'APPROVED' }], config: twoMaintainers })
  assert.equal(one.required, 2)
  assert.deepEqual(rules(one.findings), ['REVIEW'])
  const both = evaluateReviews({
    pr: pr(),
    reviews: [
      { user: { login: 'owner-one' }, state: 'APPROVED' },
      { user: { login: 'owner-two' }, state: 'APPROVED' },
    ],
    config: twoMaintainers,
  })
  assert.deepEqual(both.findings, [])
})

test('a maintainer needs one other maintainer, and cannot approve their own pull request', () => {
  const own = pr({ user: { login: 'owner-one' }, author_association: 'OWNER' })
  const self = evaluateReviews({ pr: own, reviews: [{ user: { login: 'owner-one' }, state: 'APPROVED' }], config: twoMaintainers })
  assert.deepEqual(rules(self.findings), ['REVIEW'])
  const other = evaluateReviews({ pr: own, reviews: [{ user: { login: 'owner-two' }, state: 'APPROVED' }], config: twoMaintainers })
  assert.equal(other.required, 1)
  assert.deepEqual(other.findings, [])
})

test('a later change request withdraws an earlier approval; comments do not', () => {
  const result = evaluateReviews({
    pr: pr({ user: { login: 'owner-one' }, author_association: 'OWNER' }),
    reviews: [
      { user: { login: 'owner-two' }, state: 'APPROVED' },
      { user: { login: 'owner-two' }, state: 'CHANGES_REQUESTED' },
      { user: { login: 'owner-two' }, state: 'COMMENTED' },
    ],
    config: twoMaintainers,
  })
  assert.deepEqual(rules(result.findings), ['REVIEW'])
})

test('claiming no AI while listing AI tools is inconsistent', () => {
  const findings = evaluatePullRequest({
    pr: pr({ body: body({ level: 'none', tools: 'Copilot' }) }),
    commits: [commit(`x\n\n${signed}`)],
    config,
    action: 'edited',
  })
  assert.deepEqual(rules(findings, 'error'), ['AI-01'])
})
