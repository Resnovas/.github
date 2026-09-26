// Pure rule logic for the house pull request policy. No I/O lives here, so
// every rule can be exercised directly by the tests.
//
// Each finding carries the rule id from AI_POLICY.md or CONTRIBUTING.md so
// the check output links straight to the text being enforced.

export const LEVELS = ['none', 'autocomplete', 'chat', 'agent', 'autonomous']

import { syncFindings } from './managed.mjs'

const POLICY_URL = 'https://github.com/Resnovas/.github/blob/main'

const RULE_LINKS = {
  'AI-01': `${POLICY_URL}/AI_POLICY.md#ai-01`,
  'AI-02': `${POLICY_URL}/AI_POLICY.md#ai-02`,
  'AI-03': `${POLICY_URL}/AI_POLICY.md#ai-03`,
  'AI-20': `${POLICY_URL}/AI_POLICY.md#ai-20`,
  'AI-21': `${POLICY_URL}/AI_POLICY.md#ai-21`,
  DCO: `${POLICY_URL}/CONTRIBUTING.md#dco`,
  TITLE: `${POLICY_URL}/CONTRIBUTING.md#pr-title`,
  STYLE: `${POLICY_URL}/AI_POLICY.md#ai-09`,
  REVIEW: `${POLICY_URL}/GOVERNANCE.md#review`,
  SYNC: `${POLICY_URL}/GOVERNANCE.md#synced-files`,
}

// Findings that stay errors even on a maintainer's own pull request.
const NEVER_DOWNGRADED = new Set(['AI-03'])

// Identities that belong to an AI tool rather than a person. `.invalid` is the
// reserved domain the policy tells contributors to use for a tool that
// publishes no attribution address of its own.
const AI_EMAIL = /(@anthropic\.com|@openai\.com|@cursor\.(com|sh)|copilot|\.invalid)$/i
const AI_NAME = /\b(claude|codex|chatgpt|gpt-?\d|copilot|cursor|gemini|devin|aider|windsurf|jules|codeium|tabnine)\b/i

export function isAiIdentity({ name = '', email = '' }) {
  return AI_EMAIL.test(email) || AI_NAME.test(name)
}

const TRAILER = /^(Co-authored-by|Signed-off-by):\s*(.+?)\s*<([^>]+)>\s*$/gim

// Assisted-by follows the Linux kernel form: "Assisted-by: TOOL:MODEL [TOOL...]".
const ASSISTED = /^Assisted-by:[ \t]*(\S.*?)\s*$/gim

export function parseTrailers(message) {
  const coAuthors = []
  const signOffs = []
  for (const [, kind, name, email] of message.matchAll(TRAILER)) {
    const person = { name, email: email.toLowerCase() }
    if (kind.toLowerCase() === 'co-authored-by') coAuthors.push(person)
    else signOffs.push(person)
  }
  const assistedBy = [...message.matchAll(ASSISTED)].map(([, value]) => value)
  return { coAuthors, signOffs, assistedBy }
}

function field(body, label) {
  const match = new RegExp(`^\\s*${label}:[ \\t]*(.*)$`, 'im').exec(body)
  if (!match) return null
  const value = match[1].replace(/`/g, '').trim()
  return value === '' ? null : value
}

// Reads the "AI disclosure" block from a pull request body. HTML comments are
// removed first so the guidance inside the template is never read as an answer.
export function parseDisclosure(body = '') {
  const text = body.replace(/<!--[\s\S]*?-->/g, '')
  const level = field(text, 'AI level')
  return {
    level: level ? level.toLowerCase() : null,
    tools: field(text, 'AI tools'),
    accountable: field(text, 'Accountable human'),
    review: field(text, 'Human review'),
  }
}

const CONVENTIONAL_TITLE = /^(feat|fix|perf|refactor|test|docs|chore|build|ci|style|revert)(\([\w./-]+\))?!?: \S/

function sameLogin(a = '', b = '') {
  return a.replace(/^@/, '').toLowerCase() === b.replace(/^@/, '').toLowerCase()
}

export function authorRole(pr, config) {
  const login = pr.user.login
  if (config.trustedBots.some((bot) => sameLogin(bot, login))) return 'bot'
  if (config.maintainers.some((m) => sameLogin(m, login)) || pr.author_association === 'OWNER') {
    return 'maintainer'
  }
  return 'contributor'
}

function finding(rule, message, extra = {}) {
  return { rule, level: 'error', message, link: RULE_LINKS[rule], ...extra }
}

// Evaluates a pull request against the policy.
//   pr       GitHub pull request payload (title, body, draft, user, author_association)
//   commits  [{ sha, message, authorEmail, parents }]
//   config   { maintainers: [], trustedBots: [] }
//   action   the pull_request event action, e.g. "opened"
//   synced   optional [{ path, rendered, base, head }] for the synced files
export function evaluatePullRequest({ pr, commits, config, action, synced = [] }) {
  const role = authorRole(pr, config)
  if (role === 'bot') return []

  const findings = []
  const disclosure = parseDisclosure(pr.body ?? '')
  const aiCoAuthored = commits.filter((c) => parseTrailers(c.message).coAuthors.some(isAiIdentity))
  const aiAttributed = commits.filter((c) => {
    const { coAuthors, assistedBy } = parseTrailers(c.message)
    return coAuthors.some(isAiIdentity) || assistedBy.length > 0
  })

  if (!CONVENTIONAL_TITLE.test(pr.title)) {
    findings.push(finding('TITLE', `Title "${pr.title}" is not a conventional commit, for example "fix(auth): reject expired tokens".`))
  }

  // AI-01: disclosure present, valid and internally consistent.
  if (!disclosure.level) {
    findings.push(finding('AI-01', 'The AI disclosure is missing. Fill in "AI level:" with one of: ' + LEVELS.join(', ') + '.'))
  } else if (!LEVELS.includes(disclosure.level)) {
    findings.push(finding('AI-01', `"AI level: ${disclosure.level}" is not a level. Use one of: ${LEVELS.join(', ')}.`))
  } else if (disclosure.level === 'none') {
    if (disclosure.tools && !/^none$/i.test(disclosure.tools)) {
      findings.push(finding('AI-01', `AI level is none but AI tools lists "${disclosure.tools}".`))
    }
    for (const commit of aiAttributed) {
      findings.push(finding('AI-01', 'AI level is none but this commit credits an AI tool.', { sha: commit.sha }))
    }
  } else {
    if (!disclosure.tools || /^none$/i.test(disclosure.tools)) {
      findings.push(finding('AI-01', `AI level is ${disclosure.level}; name every tool and model in "AI tools:".`))
    }
    // AI-02: an AI-assisted change must credit the tool on the commits it changed.
    if (aiCoAuthored.length === 0) {
      findings.push(finding('AI-02', `AI level is ${disclosure.level} but no commit has a Co-authored-by trailer for the AI tool.`))
    }
    // Both trailers travel together: Co-authored-by shows on GitHub,
    // Assisted-by records the exact tool and model.
    for (const commit of aiAttributed) {
      const { coAuthors, assistedBy } = parseTrailers(commit.message)
      if (!coAuthors.some(isAiIdentity)) {
        findings.push(finding('AI-02', 'This commit has Assisted-by but no Co-authored-by trailer for the AI tool.', { sha: commit.sha }))
      } else if (assistedBy.length === 0) {
        findings.push(finding('AI-02', 'This commit credits an AI co-author but has no "Assisted-by: TOOL:MODEL" trailer.', { sha: commit.sha }))
      }
    }
    // AI-20 / AI-21: AI-assisted pull requests start as drafts and only leave
    // draft once the accountable human has reviewed them.
    if (!pr.draft) {
      if (action === 'opened') {
        findings.push(finding('AI-20', 'AI-assisted pull requests must be opened as drafts. Convert this one to a draft.'))
      }
      if (!disclosure.accountable || !sameLogin(disclosure.accountable, pr.user.login)) {
        findings.push(finding('AI-21', `"Accountable human:" must be the pull request author, @${pr.user.login}.`))
      }
      if (!disclosure.review) {
        findings.push(finding('AI-21', '"Human review:" is empty. State what you personally reviewed and ran before marking this ready.'))
      }
    }
  }

  for (const commit of commits) {
    if (commit.parents > 1) continue
    const { signOffs } = parseTrailers(commit.message)
    // AI-03: only a person can certify the DCO.
    for (const signer of signOffs.filter(isAiIdentity)) {
      findings.push(finding('AI-03', `Signed-off-by "${signer.name} <${signer.email}>" is an AI tool. Only a human can sign off.`, { sha: commit.sha }))
    }
    const human = signOffs.filter((s) => !isAiIdentity(s))
    if (!human.some((s) => s.email === commit.authorEmail.toLowerCase())) {
      findings.push(finding('DCO', `No Signed-off-by matching the author <${commit.authorEmail}>. Commit with "git commit -s".`, { sha: commit.sha }))
    }
  }

  // Synced content is changed in Resnovas/.github, never in a repository.
  for (const { path, message } of syncFindings(synced)) {
    findings.push(finding('SYNC', `${path} ${message}. Change it in Resnovas/.github instead.`))
  }

  const prose = `${pr.title}\n${(pr.body ?? '').replace(/<!--[\s\S]*?-->/g, '')}`
  if (/\p{Extended_Pictographic}/u.test(prose)) {
    findings.push(finding('STYLE', 'Remove emoji from the title and description.', { level: 'warning' }))
  }
  if (/[\u2013\u2014]/.test(prose)) {
    findings.push(finding('STYLE', 'Replace em and en dashes with ordinary punctuation.', { level: 'warning' }))
  }
  if (/^\s*[-*] \[ \]/m.test(prose)) {
    findings.push(finding('STYLE', 'Remove unticked checklist items; state what was done instead.', { level: 'warning' }))
  }

  if (role === 'maintainer') {
    for (const f of findings) {
      if (f.level === 'error' && !NEVER_DOWNGRADED.has(f.rule)) f.level = 'warning'
    }
  }
  return findings
}

// Counts maintainer approvals against GOVERNANCE.md#review. With fewer than
// two maintainers the gate is open: the owner merges at their discretion.
//   reviews  [{ user: { login }, state }] in the order GitHub returns them (oldest first)
export function evaluateReviews({ pr, reviews, config }) {
  const role = authorRole(pr, config)
  if (config.maintainers.length < 2 || role === 'bot') {
    return { required: 0, approvedBy: [], findings: [] }
  }
  const required = role === 'maintainer' ? 1 : 2
  const latest = new Map()
  for (const review of reviews) {
    if (review.state === 'COMMENTED' || review.state === 'PENDING') continue
    latest.set(review.user.login.toLowerCase(), review.state)
  }
  const approvedBy = config.maintainers.filter(
    (m) => !sameLogin(m, pr.user.login) && latest.get(m.toLowerCase()) === 'APPROVED',
  )
  const findings =
    approvedBy.length >= required
      ? []
      : [finding('REVIEW', `Needs ${required} maintainer approval(s) from someone other than the author; has ${approvedBy.length}.`)]
  return { required, approvedBy, findings }
}
