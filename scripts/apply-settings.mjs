#!/usr/bin/env node
// Applies the house repository settings (scripts/lib/settings.mjs) to one
// repository.
//
//   node scripts/apply-settings.mjs --repository owner/name --dry-run
//   node scripts/apply-settings.mjs --repository owner/name --override path/to/.github/house.yml
//
// Needs GITHUB_TOKEN with administration write access to the repository.
// Optional steps that fail are reported as warnings; any other failure makes
// the run exit 1 after every step has been attempted.

import { appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { loadValues } from './lib/values.mjs'
import { planSettings, RULESET_NAME } from './lib/settings.mjs'

const houseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values: args } = parseArgs({
  options: {
    repository: { type: 'string' },
    override: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})
if (!args.repository) throw new Error('--repository owner/name is required')
const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is not set')

const values = {
  ...loadValues(join(houseRoot, 'house.yml')),
  ...(args.override ? loadValues(args.override, { optional: true }) : {}),
}

async function call(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function graphql(query, variables) {
  const result = await call('POST', '/graphql', { query, variables })
  if (result.errors?.length) throw new Error(`GraphQL: ${result.errors.map((e) => e.message).join('; ')}`)
  return result.data
}

// Rulesets are matched by name, so re-running updates the house ruleset in
// place instead of stacking duplicates.
async function upsertRuleset(body) {
  const existing = (await call('GET', `/repos/${args.repository}/rulesets?per_page=100`)).find((r) => r.name === RULESET_NAME)
  if (existing) return call('PUT', `/repos/${args.repository}/rulesets/${existing.id}`, body)
  return call('POST', `/repos/${args.repository}/rulesets`, body)
}

const repo = await call('GET', `/repos/${args.repository}`)
const steps = planSettings(values, repo)
const results = []

for (const step of steps) {
  if (args['dry-run']) {
    const detail = step.ruleset ? JSON.stringify(step.ruleset) : step.graphql ? JSON.stringify(step.variables) : `${step.method} ${step.path} ${step.body ? JSON.stringify(step.body) : ''}`
    console.log(`would apply ${step.id}: ${step.description}\n  ${detail}`)
    continue
  }
  try {
    if (step.ruleset) await upsertRuleset(step.ruleset)
    else if (step.graphql) await graphql(step.graphql, step.variables)
    else await call(step.method, step.path, step.body)
    results.push({ step, outcome: 'applied' })
    console.log(`applied ${step.id}`)
  } catch (error) {
    const level = step.optional ? 'warning' : 'error'
    results.push({ step, outcome: level, error: error.message })
    console.log(`::${level} title=${step.id}::${error.message.replace(/\n/g, ' ')}`)
  }
}

if (!args['dry-run']) {
  const summary = [
    `### House settings: ${args.repository}`,
    '',
    '| Setting | Outcome |',
    '| --- | --- |',
    ...results.map(({ step, outcome, error }) => `| ${step.description} | ${outcome}${error ? `: ${error.slice(0, 160).replace(/\|/g, '\\|')}` : ''} |`),
    '',
    'Not settable through any API, so set by hand: Settings > General > Pushes > limit branch and tag updates per push to 5.',
  ].join('\n')
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
  console.log(summary)
}

process.exit(results.some((r) => r.outcome === 'error') ? 1 : 0)
