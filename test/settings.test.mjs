import { test } from 'node:test'
import assert from 'node:assert/strict'
import { environmentBody, environmentsFor, isProtectedEnvironment, planSettings, rulesetBody, RULESET_NAME } from '../scripts/lib/settings.mjs'

const publicRepo = { full_name: 'Resnovas/example', node_id: 'R_1', private: false }
const privateRepo = { ...publicRepo, private: true }
const base = { MAINTAINERS: 'TGTGamer', PROJECT_TYPE: 'saas' }
const ids = (steps) => steps.map((s) => s.id)

test('project types choose their environments, and ENVIRONMENTS overrides them', () => {
  assert.deepEqual(environmentsFor({ PROJECT_TYPE: 'saas' }), ['Production', 'Staging', 'Development'])
  assert.deepEqual(environmentsFor({ PROJECT_TYPE: 'Desktop' }), ['Windows', 'Linux', 'macOS', 'Windows Beta', 'Linux Beta', 'macOS Beta'])
  assert.deepEqual(environmentsFor({ PROJECT_TYPE: 'library' }), ['Release'])
  assert.deepEqual(environmentsFor({}), [])
  assert.deepEqual(environmentsFor({ PROJECT_TYPE: 'saas', ENVIRONMENTS: 'Live, Preview' }), ['Live', 'Preview'])
  assert.throws(() => environmentsFor({ PROJECT_TYPE: 'game' }), /PROJECT_TYPE "game"/)
})

test('shipping environments deploy only from protected branches', () => {
  for (const name of ['Production', 'Windows', 'macOS', 'Release']) assert.ok(isProtectedEnvironment(name), name)
  for (const name of ['Staging', 'Development', 'Windows Beta', 'Preview']) assert.ok(!isProtectedEnvironment(name), name)
  assert.deepEqual(environmentBody('Production'), { deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } })
  assert.deepEqual(environmentBody('Staging'), { deployment_branch_policy: null })
})

test('the merge settings enforce squash or rebase, sign-off, and trailer-preserving squashes', () => {
  const merging = planSettings(base, publicRepo).find((s) => s.id === 'merging')
  assert.equal(merging.method, 'PATCH')
  assert.equal(merging.path, '/repos/Resnovas/example')
  assert.deepEqual(merging.body, {
    allow_merge_commit: false,
    allow_squash_merge: true,
    allow_rebase_merge: true,
    allow_auto_merge: true,
    allow_update_branch: true,
    delete_branch_on_merge: true,
    web_commit_signoff_required: true,
    has_wiki: false,
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'COMMIT_MESSAGES',
  })
})

test('a public repository gets every step, in order', () => {
  assert.deepEqual(ids(planSettings(base, publicRepo)), [
    'merging',
    'features',
    'immutable-releases',
    'private-vulnerability-reporting',
    'dependabot-alerts',
    'dependabot-security-updates',
    'code-scanning',
    'secret-scanning',
    'ruleset',
    'environment:Production',
    'environment:Staging',
    'environment:Development',
  ])
})

test('discussions and sponsorships go through GraphQL with the repository node id', () => {
  const features = planSettings(base, publicRepo).find((s) => s.id === 'features')
  assert.match(features.graphql, /hasDiscussionsEnabled: true, hasSponsorshipsEnabled: true, hasWikiEnabled: false/)
  assert.deepEqual(features.variables, { id: 'R_1' })
})

test('a private repository skips paid secret scanning and treats the ruleset as optional', () => {
  const steps = planSettings(base, privateRepo)
  assert.ok(!ids(steps).includes('secret-scanning'))
  assert.equal(steps.find((s) => s.id === 'ruleset').optional, true)
  assert.equal(planSettings(base, publicRepo).find((s) => s.id === 'ruleset').optional, false)
})

test('environment names are URL encoded', () => {
  const step = planSettings({ ...base, PROJECT_TYPE: 'desktop' }, publicRepo).find((s) => s.id === 'environment:Windows Beta')
  assert.equal(step.path, '/repos/Resnovas/example/environments/Windows%20Beta')
})

test('the ruleset targets the default branch with linear history and AI review', () => {
  const body = rulesetBody(base)
  assert.equal(body.name, RULESET_NAME)
  assert.deepEqual(body.conditions, { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } })
  const types = body.rules.map((r) => r.type)
  assert.deepEqual(types, ['deletion', 'non_fast_forward', 'required_linear_history', 'copilot_code_review', 'code_scanning'])
  assert.deepEqual(body.rules[3].parameters, { review_draft_pull_requests: true, review_on_push: true })
})

test('a sole maintainer can bypass and has no required checks', () => {
  const body = rulesetBody(base)
  assert.deepEqual(body.bypass_actors, [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }])
  assert.ok(!body.rules.some((r) => r.type === 'required_status_checks'))
})

test('two maintainers require the house checks, and the owner can still bypass', () => {
  const body = rulesetBody({ ...base, MAINTAINERS: 'TGTGamer, second' })
  assert.deepEqual(body.bypass_actors, [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }])
  const checks = body.rules.find((r) => r.type === 'required_status_checks')
  assert.deepEqual(checks.parameters.required_status_checks, [{ context: 'house-policy / policy' }, { context: 'house-policy / reviews' }])
})

test('the code scanning gate can be switched off for repositories CodeQL cannot analyse', () => {
  assert.ok(!rulesetBody({ ...base, CODE_SCANNING_GATE: 'false' }).rules.some((r) => r.type === 'code_scanning'))
  assert.ok(rulesetBody({ ...base, CODE_SCANNING_GATE: 'yes' }).rules.some((r) => r.type === 'code_scanning'))
})
