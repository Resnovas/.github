/**
 * @file scripts/lib/codeql-alert-comment.mjs
 *
 * Copyright 2026 Jonathan Stevens trading as Resnovas. All rights reserved.
 * Licensed under the Fair Core License, Version 1.0, MIT Future License
 * (FCL-1.0-MIT); see LICENSE. You may not move, change, disable or circumvent
 * the licence key functionality, or modify any part of the software that the
 * licence key protects.
 *
 * Contributions are made under the Developer Certificate of Origin (DCO.md) and
 * the Contributing Guidelines (CONTRIBUTING.md), subject to the Code of Conduct
 * (CODE_OF_CONDUCT.md) and the Cooperation Commitment (COOPERATION_COMMITMENT.md).
 *
 * DELETING THIS NOTICE AUTOMATICALLY VOIDS YOUR LICENSE.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const marker = '<!-- house-codeql-alerts:v1 -->'
const sha = /^[a-f0-9]{40}$/
// Render all external strings as literal text, including mentions and Markdown.
// Break mention tokens too: an entity alone can decode before GitHub's mention filter.
const literal = (value) => String(value ?? 'unavailable').replace(/@/g, '@\u200b').replace(/[&<>`*_[\]\\!#|\r\n]/g, (character) => `&#${character.charCodeAt(0)};`)

// Python's standard ZIP reader avoids a new dependency and never extracts to disk.
// Declared and actual expanded bytes, file count, paths and subprocess resources are bounded.
const archiveReader = `
import io, json, stat, sys, zipfile
archive = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
entries = archive.infolist()
if not 1 <= len(entries) <= 20: raise ValueError('Invalid SARIF archive entry count')
if sum(entry.file_size for entry in entries) > 32 * 1024 * 1024: raise ValueError('SARIF archive expansion limit')
values = []
for entry in entries:
    if entry.is_dir(): continue
    if '/' in entry.filename or '\\\\' in entry.filename or not entry.filename.endswith('.sarif') or stat.S_ISLNK(entry.external_attr >> 16): raise ValueError('Unsafe SARIF archive entry')
    with archive.open(entry) as stream:
        data = stream.read(32 * 1024 * 1024 + 1)
    if len(data) != entry.file_size: raise ValueError('Invalid SARIF archive size')
    values.append(json.loads(data))
if not values: raise ValueError('No original SARIF files')
print(json.dumps(values))
`

const originalSarif = (archive) => JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-c', archiveReader], { input: archive, timeout: 10000, maxBuffer: 40 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }))

/**
 * Publish a head-bound snapshot using only GitHub API data, never PR code.
 * Missing evidence is a visible unavailable report and a failing job.
 *
 * @param options - Repository, completed workflow run ID and authenticated API transport.
 * @returns Numbers of the pull requests updated by this run.
 * @example
 * await commentCodeQL({ repository: 'owner/repo', runID: 123, request })
 */
export async function commentCodeQL({ repository, runID, request }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !Number.isSafeInteger(runID) || runID < 1) throw new Error('Invalid repository or workflow run ID.')
  const root = `/repos/${repository}`
  const get = (path, accept) => request('GET', `${root}${path}`, undefined, accept)
  const pages = async (path, key) => {
    const values = []
    for (let page = 1; page <= 200; page++) {
      const response = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      const batch = key ? response[key] : response
      if (!Array.isArray(batch)) throw new Error('Invalid paginated API response; results unavailable.')
      values.push(...batch)
      if (batch.length < 100) {
        if (key && response.total_count !== values.length) throw new Error('Paginated API results are truncated.')
        return values
      }
    }
    throw new Error('Pagination limit reached; results are incomplete. Inspect code scanning in GitHub.')
  }
  const run = await get(`/actions/runs/${runID}`)
  if (run.event !== 'pull_request' || run.path !== '.github/workflows/house-codeql.yml' || run.status !== 'completed' || run.repository?.full_name?.toLowerCase() !== repository.toLowerCase() || !sha.test(run.head_sha)) throw new Error('Not a completed House CodeQL pull-request run in this repository.')
  // GitHub can omit workflow_run.pull_requests for forks. Resolve through live PR metadata instead.
  const candidates = (await pages('/pulls?state=open')).filter((pr) => pr.head?.sha === run.head_sha && pr.head?.repo?.id === run.head_repository?.id)
  const updated = []
  const failures = []
  for (const candidate of candidates) {
    const number = candidate.number
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid PR number from API.')
    const ref = `refs/pull/${number}/merge`
    const fresh = async () => {
      const pr = await get(`/pulls/${number}`)
      return pr.state === 'open' && pr.base?.repo?.full_name?.toLowerCase() === repository.toLowerCase() && pr.head?.sha === run.head_sha && pr.head?.repo?.id === run.head_repository.id && sha.test(pr.merge_commit_sha) && pr.merge_commit_sha === candidate.merge_commit_sha
    }
    if (!await fresh()) continue
    let details
    try {
      if (run.conclusion !== 'success') throw new Error('House CodeQL did not succeed. Inspect and rerun the analysis.')
      const analyses = await pages(`/code-scanning/analyses?tool_name=CodeQL&ref=${encodeURIComponent(ref)}`)
      const matching = analyses.filter((analysis) => analysis.ref === ref && analysis.commit_sha === candidate.merge_commit_sha && analysis.tool?.name === 'CodeQL' && Date.parse(analysis.created_at) >= Date.parse(run.run_started_at) && Date.parse(analysis.created_at) <= Date.parse(run.updated_at))
      if (!matching.length) throw new Error('No matching processed CodeQL analysis for this PR merge commit. Wait for processing and rerun the commenter.')
      if (matching.some((analysis) => analysis.error || analysis.warning)) throw new Error('CodeQL analysis reports an error or warning. Inspect code scanning before treating results as complete.')
      const jobs = await pages(`/actions/runs/${runID}/jobs?filter=latest`, 'jobs')
      const languages = jobs.flatMap((job) => job.name?.match(/^house-codeql \/ analyze \(([a-z-]+)\)$/)?.[1] ?? [])
      if (!languages.length || languages.some((language) => matching.filter((analysis) => analysis.category === `/language:${language}`).length !== 1)) throw new Error('Not every language job has exactly one processed analysis. Wait for processing and rerun.')
      const alerts = await pages(`/code-scanning/alerts?tool_name=CodeQL&state=open&ref=${encodeURIComponent(ref)}`)
      if (alerts.some((alert) => alert.most_recent_instance?.ref !== ref || alert.most_recent_instance?.commit_sha !== candidate.merge_commit_sha || alert.tool?.name !== 'CodeQL')) throw new Error('Alert snapshot does not match the current PR merge commit. Rerun after processing completes.')
      // Artifact metadata binds the data to this repository/run/head, not an artifact-supplied manifest.
      const artifacts = await pages(`/actions/runs/${runID}/artifacts`, 'artifacts')
      const results = new Map()
      for (const analysis of matching) {
        if (!Number.isSafeInteger(analysis.id)) throw new Error('Invalid analysis ID.')
        let originals = []
        let unavailable = 'Original SARIF artifact missing or expired. Rerun House CodeQL after the artifact-capture workflow is on the default branch.'
        const language = analysis.category?.match(/^\/language:([a-z-]+)$/)?.[1]
        const artifact = artifacts.filter((item) => item.name === `house-codeql-sarif-${language}`)
        if (artifact.length === 1 && !artifact[0].expired) {
          const item = artifact[0]
          try {
            if (!Number.isSafeInteger(item.id) || item.workflow_run?.id !== runID || item.workflow_run?.head_sha !== run.head_sha || item.workflow_run?.repository_id !== run.repository.id || item.workflow_run?.head_repository_id !== run.head_repository.id || item.size_in_bytes > 16 * 1024 * 1024) throw new Error('Original SARIF artifact provenance or size mismatch.')
            const archive = await get(`/actions/artifacts/${item.id}/zip`, 'application/zip')
            if (!/^sha256:[a-f0-9]{64}$/.test(item.digest) || `sha256:${createHash('sha256').update(archive).digest('hex')}` !== item.digest) throw new Error('Original SARIF artifact digest mismatch.')
            originals = originalSarif(archive).flatMap((document) => document.runs).filter((sarifRun) => sarifRun.tool?.driver?.name === 'CodeQL' && sarifRun.automationDetails?.id?.replace(/\/$/, '') === analysis.category)
            if (!originals.length) throw new Error('Original SARIF category does not match the processed analysis.')
          } catch {
            unavailable = 'Original SARIF artifact could not be validated or read within safety limits. Inspect the artifact and rerun House CodeQL.'
            originals = []
          }
        }
        const sarif = await get(`/code-scanning/analyses/${analysis.id}`, 'application/sarif+json')
        if (!Array.isArray(sarif.runs)) throw new Error('Analysis SARIF unavailable.')
        if (!Number.isSafeInteger(analysis.results_count) || sarif.runs.reduce((count, sarifRun) => count + (sarifRun.results?.length ?? 0), 0) !== analysis.results_count) throw new Error('Analysis SARIF result count is missing or truncated.')
        for (const sarifRun of sarif.runs) {
          if (!Array.isArray(sarifRun.results)) throw new Error('Analysis results unavailable.')
          for (const result of sarifRun.results) {
            // The documented API example uses an array of property bags; accept a SARIF bag too.
            const properties = Array.isArray(result.properties) ? Object.assign(Object.create(null), ...result.properties) : result.properties
            const alertNumber = properties?.['github/alertNumber']
            if (!results.has(alertNumber)) results.set(alertNumber, [])
            const physical = result.locations?.[0]?.physicalLocation
            // Match the API's alert identity to original results, not text pretending to be a trace.
            const bound = originals.flatMap((original) => (original.results ?? []).filter((entry) => entry.ruleId === result.ruleId && entry.message?.text === result.message?.text && entry.locations?.[0]?.physicalLocation?.artifactLocation?.uri === physical?.artifactLocation?.uri && ['startLine', 'endLine', 'startColumn', 'endColumn'].every((field) => entry.locations?.[0]?.physicalLocation?.region?.[field] === physical?.region?.[field])).map((entry) => ({ ...entry, kind: [original.tool.driver, ...(original.tool.extensions ?? [])].flatMap((component) => component.rules ?? []).find((rule) => rule.id === entry.ruleId)?.properties?.kind })))
            results.get(alertNumber).push(...(bound.length ? bound : [{ ruleId: result.ruleId, unavailable }]))
          }
        }
      }
      details = [`Open CodeQL alerts: ${alerts.length}.`, 'Paths are the ordered codeFlows in the retained original CodeQL SARIF, matched to processed GitHub alert identities. They are static-analysis paths, not runtime traces.']
      for (const alert of alerts) {
        const instance = alert.most_recent_instance
        const location = instance.location
        details.push(`\n### Alert ${literal(alert.number)}`, `Rule: ${literal(alert.rule?.id)}; severity: ${literal(alert.rule?.security_severity_level ?? alert.rule?.severity)}.`, `Location: ${literal(location?.path)}:${literal(location?.start_line)}.`, `Message: ${literal(instance.message?.text)}.`, `Inspect: https://github.com/${repository}/security/code-scanning/${Number(alert.number)}`)
        const bound = (results.get(alert.number) ?? []).filter((result) => result.ruleId === alert.rule?.id)
        const flows = bound.flatMap((result) => result.codeFlows ?? []).flatMap((flow) => flow.threadFlows ?? [])
        if (flows.length && bound.some((result) => result.unavailable || result.codeFlows?.some((flow) => !Array.isArray(flow.threadFlows) || !flow.threadFlows.length))) {
          details.push('Some paths unavailable: original results or thread flows are incomplete. The paths below are not a complete report; inspect the analysis and rerun.')
          failures.push(number)
        }
        if (!flows.length) {
          if (bound.length && bound.every((result) => result.kind === 'problem')) {
            details.push('Path not applicable: CodeQL classifies this rule as problem, not path-problem; the original result supplies no codeFlows.')
          } else {
            details.push(`Path unavailable: ${literal(bound.find((result) => result.unavailable)?.unavailable ?? 'No complete original codeFlows matched this alert. Inspect Show paths and rerun the analysis.')}`)
            failures.push(number)
          }
          continue
        }
        for (const [index, flow] of flows.entries()) {
          const locations = flow.locations
          if (!Array.isArray(locations) || locations.length < 2 || locations.some((step) => !step.location?.physicalLocation?.artifactLocation?.uri || !Number.isInteger(step.location?.physicalLocation?.region?.startLine))) {
            details.push('Path unavailable: returned flow has missing locations or endpoints. Inspect Show paths in the alert UI.')
            failures.push(number)
            continue
          }
          details.push(`\nOriginal source-to-sink thread ${index + 1}:`)
          for (const [stepIndex, step] of locations.entries()) {
            const physical = step.location.physicalLocation
            details.push(`${stepIndex + 1}. ${literal(physical.artifactLocation.uri)}:${physical.region.startLine} - ${literal(step.location.message?.text ?? '')}`)
          }
        }
      }
    } catch (error) {
      details = ['Results unavailable, not zero alerts.', literal(error.message), 'Check this Actions run and code scanning permissions/processing, then rerun the commenter. Required workflow-token permission: security-events: read.']
      failures.push(number)
    }
    let body = [marker, '## House CodeQL alerts', `PR #${number}; head ${run.head_sha}; merge ${candidate.merge_commit_sha}; analysis run ${runID}.`, ...details].join('\n\n')
    if (Buffer.byteLength(body, 'utf8') > 60000) {
      body = [marker, '## House CodeQL alerts', `PR #${number}; head ${run.head_sha}; analysis run ${runID}.`, 'Results unavailable in one comment: the full report exceeds the safe comment size. No zero-alert or complete-trace claim is made. Inspect all alerts and Show paths in the code scanning UI.'].join('\n\n')
      failures.push(number)
    }
    const comments = await pages(`/issues/${number}/comments`)
    const owned = comments.filter((comment) => comment.user?.login === 'github-actions[bot]' && comment.user?.type === 'Bot' && comment.body?.startsWith(marker))
    if (owned.length > 1) throw new Error('Multiple bot-owned CodeQL comments exist; reconcile them manually before retrying.')
    // The final live check rejects stale completions, including a changed merge base.
    // GitHub has no conditional comment-write API; the SHA in the body makes a last-instant race visible.
    if (!await fresh()) continue
    if (owned.length) {
      if (owned[0].body !== body) await request('PATCH', `${root}/issues/comments/${owned[0].id}`, { body })
    } else {
      await request('POST', `${root}/issues/${number}/comments`, { body })
    }
    updated.push(number)
  }
  if (failures.length) throw new Error(`CodeQL results unavailable for PRs ${failures.join(', ')}; see the bot comment.`)
  return updated
}

/**
 * Restrict the Actions token to GitHub's fixed API origin without redirects.
 *
 * @param token - Ephemeral GITHUB_TOKEN with the workflow's explicit scopes.
 * @param fetcher - Fetch transport, replaceable for offline contract tests.
 * @returns Authenticated JSON API transport with bounded response size and timeout.
 * @example
 * const request = githubRequest(process.env.GH_TOKEN)
 */
export function githubRequest(token, fetcher = fetch) {
  return async (method, path, body, accept = 'application/vnd.github+json') => {
    if (!path.startsWith('/repos/') || path.includes('..') || path.includes('\\')) throw new Error('Unsafe GitHub API path.')
    let response = await fetcher(`https://api.github.com${path}`, {
      method, redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (accept === 'application/zip' && response.status === 302) {
      const location = new URL(response.headers.get('location'))
      if (location.protocol !== 'https:' || location.username || location.password || !location.hostname.endsWith('.blob.core.windows.net')) throw new Error('Unsafe artifact download redirect.')
      // Signed artifact-storage URL gets no GitHub token, even across a redirect.
      response = await fetcher(location.href, { redirect: 'error', signal: AbortSignal.timeout(30000) })
    }
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}; results unavailable.`)
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 16 * 1024 * 1024) throw new Error('API response exceeds safety limit; results incomplete.')
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    return accept === 'application/zip' ? bytes : JSON.parse(bytes.toString('utf8'))
  }
}
