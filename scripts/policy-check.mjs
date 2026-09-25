#!/usr/bin/env node
// Runs the house policy against the pull request in the current GitHub Actions
// event and reports findings as annotations and a job summary.
//
//   node policy-check.mjs --mode policy     disclosure, co-authors, DCO, title, style
//   node policy-check.mjs --mode reviews    maintainer approvals (GOVERNANCE.adoc#review)
//
// Needs GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_EVENT_PATH. House values are
// read from --values, then the repository's own override from --override.

import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { list, loadValues } from './lib/values.mjs'
import { evaluatePullRequest, evaluateReviews } from './lib/policy.mjs'

const { values: args } = parseArgs({
  options: {
    mode: { type: 'string', default: 'policy' },
    values: { type: 'string', default: 'house.yml' },
    override: { type: 'string', default: '.github/house.yml' },
  },
})

const env = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const event = JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8'))
const pr = event.pull_request
if (!pr) {
  console.log('Not a pull request event; nothing to check.')
  process.exit(0)
}

const house = { ...loadValues(args.values), ...loadValues(args.override, { optional: true }) }
const config = { maintainers: list(house.MAINTAINERS), trustedBots: list(house.TRUSTED_BOTS) }

async function getAll(path) {
  const items = []
  for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/${env('GITHUB_REPOSITORY')}/${path}?per_page=100&page=${page}`, {
      headers: {
        authorization: `Bearer ${env('GITHUB_TOKEN')}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${await response.text()}`)
    const batch = await response.json()
    items.push(...batch)
    if (batch.length < 100) return items
  }
}

let findings
let summary
if (args.mode === 'reviews') {
  const result = evaluateReviews({ pr, reviews: await getAll(`pulls/${pr.number}/reviews`), config })
  findings = result.findings
  summary =
    result.required === 0
      ? 'Review gate open: fewer than two maintainers, or an automation account.'
      : `Maintainer approvals: ${result.approvedBy.length} of ${result.required} (${result.approvedBy.join(', ') || 'none'}).`
} else {
  const commits = (await getAll(`pulls/${pr.number}/commits`)).map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    authorEmail: c.commit.author?.email ?? '',
    parents: c.parents.length,
  }))
  findings = evaluatePullRequest({ pr, commits, config, action: event.action })
  summary = `Checked ${commits.length} commit(s).`
}

const escape = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
for (const f of findings) {
  const where = f.sha ? ` (commit ${f.sha.slice(0, 12)})` : ''
  console.log(`::${f.level} title=${f.rule}::${escape(`${f.message}${where} See ${f.link}`)}`)
}

const rows = findings.map((f) => `| ${f.level} | [${f.rule}](${f.link}) | ${f.sha ? f.sha.slice(0, 12) : ''} | ${f.message.replace(/\|/g, '\\|')} |`)
const report = [`### House policy: ${args.mode}`, '', summary, '']
if (rows.length > 0) report.push('| Level | Rule | Commit | Finding |', '| --- | --- | --- | --- |', ...rows)
else report.push('No findings.')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.join('\n') + '\n')
console.log(report.join('\n'))

process.exit(findings.some((f) => f.level === 'error') ? 1 : 0)
