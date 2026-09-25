// Pure planning for the house repository settings. Given the house values and
// the repository as GitHub describes it, returns the API calls that bring the
// repository to the house defaults. scripts/apply-settings.mjs performs them.
//
// Every request shape here was checked against GitHub's published REST
// description (github/rest-api-description) and GraphQL schema.

import { list } from './values.mjs'

export const ENVIRONMENT_SETS = {
  saas: ['Production', 'Staging', 'Development'],
  desktop: ['Windows', 'Linux', 'macOS', 'Windows Beta', 'Linux Beta', 'macOS Beta'],
  library: ['Release'],
  none: [],
}

export const RULESET_NAME = 'house: default branch'

// Explicit ENVIRONMENTS win; otherwise PROJECT_TYPE picks a set.
export function environmentsFor(values) {
  const explicit = list(values.ENVIRONMENTS)
  if (explicit.length > 0) return explicit
  const type = (values.PROJECT_TYPE || 'none').toLowerCase()
  if (!(type in ENVIRONMENT_SETS)) {
    throw new Error(`PROJECT_TYPE "${values.PROJECT_TYPE}" is not one of: ${Object.keys(ENVIRONMENT_SETS).join(', ')}`)
  }
  return ENVIRONMENT_SETS[type]
}

// Anything that ships to users deploys only from protected branches. Staging,
// Development and Beta channels accept any branch so they stay useful for testing.
export function isProtectedEnvironment(name) {
  return !/^(staging|development|dev|preview)$/i.test(name) && !/\bbeta$/i.test(name)
}

export function environmentBody(name) {
  return {
    deployment_branch_policy: isProtectedEnvironment(name) ? { protected_branches: true, custom_branch_policies: false } : null,
  }
}

const flag = (value, fallback) => (value === undefined || value === '' ? fallback : /^(true|yes|1)$/i.test(value))

export function rulesetBody(values) {
  const maintainers = list(values.MAINTAINERS)
  const rules = [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'required_linear_history' },
    // AI review on every pull request, drafts included, so problems surface
    // before the accountable human marks it ready.
    { type: 'copilot_code_review', parameters: { review_draft_pull_requests: true, review_on_push: true } },
  ]
  if (flag(values.CODE_SCANNING_GATE, true)) {
    rules.push({
      type: 'code_scanning',
      parameters: { code_scanning_tools: [{ tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors' }] },
    })
  }
  // The review gate only binds once there are two maintainers
  // (GOVERNANCE.adoc#review); a sole maintainer is never blocked.
  if (maintainers.length >= 2) {
    rules.push({
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: 'house-policy / policy' }, { context: 'house-policy / reviews' }],
      },
    })
  }
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    // Actor 5 is the repository admin role. The owner can always override
    // the ruleset, including the review gate, whatever the maintainer count.
    bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
    rules,
  }
}

// Returns the ordered steps for one repository.
//   repo  GET /repos/{owner}/{repo} response (full_name, node_id, private)
// Each step is { id, description, method, path, body } for REST or
// { id, description, graphql, variables } for GraphQL. Steps marked optional
// may legitimately fail, for example code scanning on a repository with no
// supported language, and are reported as warnings.
export function planSettings(values, repo) {
  const r = `/repos/${repo.full_name}`
  const publicRepo = !repo.private
  const steps = [
    {
      id: 'merging',
      description: 'Merging, branches, sign-off and wiki',
      method: 'PATCH',
      path: r,
      body: {
        allow_merge_commit: false,
        allow_squash_merge: true,
        allow_rebase_merge: true,
        allow_auto_merge: true,
        allow_update_branch: true,
        delete_branch_on_merge: true,
        web_commit_signoff_required: true,
        has_wiki: false,
        // Keeping the commit messages preserves every Signed-off-by,
        // Co-authored-by and Assisted-by trailer through a squash.
        squash_merge_commit_title: 'PR_TITLE',
        squash_merge_commit_message: 'COMMIT_MESSAGES',
      },
    },
    {
      id: 'features',
      description: 'Discussions and sponsorships on, wiki off',
      graphql:
        'mutation($id: ID!) { updateRepository(input: { repositoryId: $id, hasDiscussionsEnabled: true, hasSponsorshipsEnabled: true, hasWikiEnabled: false }) { repository { id } } }',
      variables: { id: repo.node_id },
    },
    { id: 'immutable-releases', description: 'Release immutability', method: 'PUT', path: `${r}/immutable-releases` },
    { id: 'private-vulnerability-reporting', description: 'Private vulnerability reporting', method: 'PUT', path: `${r}/private-vulnerability-reporting` },
    { id: 'dependabot-alerts', description: 'Dependency graph and Dependabot alerts', method: 'PUT', path: `${r}/vulnerability-alerts` },
    { id: 'dependabot-security-updates', description: 'Dependabot security updates', method: 'PUT', path: `${r}/automated-security-fixes` },
    {
      id: 'code-scanning',
      description: 'CodeQL default setup, extended queries (Copilot Autofix follows automatically)',
      method: 'PATCH',
      path: `${r}/code-scanning/default-setup`,
      body: { state: 'configured', query_suite: 'extended' },
      optional: true,
    },
  ]
  // Secret scanning is free on public repositories; on private ones it needs
  // a paid Advanced Security licence, so it is left to the organisation.
  if (publicRepo) {
    steps.push({
      id: 'secret-scanning',
      description: 'Secret scanning, push protection, Copilot secret detection and non-provider patterns',
      method: 'PATCH',
      path: r,
      body: {
        security_and_analysis: {
          secret_scanning: { status: 'enabled' },
          secret_scanning_push_protection: { status: 'enabled' },
          secret_scanning_ai_detection: { status: 'enabled' },
          secret_scanning_non_provider_patterns: { status: 'enabled' },
        },
      },
      optional: true,
    })
  }
  steps.push({ id: 'ruleset', description: `Ruleset "${RULESET_NAME}"`, ruleset: rulesetBody(values), optional: !publicRepo })
  for (const name of environmentsFor(values)) {
    steps.push({
      id: `environment:${name}`,
      description: `Environment "${name}"${isProtectedEnvironment(name) ? ' (protected branches only)' : ''}`,
      method: 'PUT',
      path: `${r}/environments/${encodeURIComponent(name)}`,
      body: environmentBody(name),
    })
  }
  return steps
}
