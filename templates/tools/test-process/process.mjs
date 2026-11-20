// Synced from Resnovas/.github templates/tools/test-process/process.mjs.
/**
 * @file tools/test-process/process.mjs
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

// One dependency-free process owner for Node tools and test-runner adapters.
import { spawn } from 'node:child_process'

/** Per-child cleanup allowance reserved by both registration and execution. */
export const terminationGraceMs = 100

/**
 * Reject inconsistent serial child lifetimes before registering or executing a scenario.
 * Optimization evidence: Node 24.22.3 admission proof took 2.08 ms for invalid/boundary/valid controls; no speedup is claimed.
 */
export function childBudgetIssue(budgets, testMs) {
  if (!Number.isSafeInteger(testMs) || testMs <= 0 || budgets.length === 0 ||
      budgets.some((value) => !Number.isSafeInteger(value) || value <= 0))
    return 'Declare positive integer child budgets and a finite test timeout.'
  if (budgets.reduce((sum, value) => sum + value + terminationGraceMs, 0) >= testMs)
    return 'Child budgets and termination grace must fit below the test timeout; measure and shorten the children, not raise the test limit.'
  return undefined
}

const journalPhase = /^(?:child-start|module-first|module-64|module-256|module-1024|entry-source-loaded|effect-source-loaded|root-start|bootstrap-failure-logged|process-before-exit|process-exit-success|process-exit-failure|(?:main-use-exit|main-services-released|main-telemetry-released|bootstrap-use-exit|root-exit):(?:success|failure|interrupted))(?![\s\S])/
const ownedPhase = /^(?:spawn-request|spawned|output-first|diagnostic-output|registration-output|ipc-output|ready|deadline|output-limit|cancel|exit|total)(?![\s\S])/

/**
 * Accept only bounded numeric phase evidence, never commands, IPC payloads or arbitrary child text.
 * Optimization evidence: the real-child journal/privacy proof took 37.87 ms including startup; per-record cost is not isolated.
 */
function timingRow(value) {
  return value !== null && typeof value === 'object' && value.code === 'test.child.timing' &&
    typeof value.phase === 'string' && (ownedPhase.test(value.phase) || journalPhase.test(value.phase)) &&
    ['child', 'startedAtMs', 'budgetMs', 'elapsedMs'].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0)
}

/**
 * Emit a closed record to stderr so a Node fixture's JSON stdout remains its business result.
 * Optimization evidence: the output/mandatory-timing proof took 73.52 ms including startup; no producer-only speedup is claimed.
 */
function emit(row) {
  process.stderr.write(`${JSON.stringify({ code: 'test.child.timing', child: row.child,
    startedAtMs: row.startedAtMs, budgetMs: row.budgetMs, phase: row.phase, elapsedMs: row.elapsedMs })}\n`)
}

/**
 * Start one bounded child with mandatory timing, bounded streams and optional IPC/journal descriptors.
 * The returned owner retains cancellation until actual close; callers must await completed or cancel().
 * POSIX signals target the owned group; Windows Node children also use libuv's existing Job cleanup.
 * Descendants that deliberately create another POSIX session/group are outside this ownership boundary.
 * No option disables timing. Command, environment, stream and IPC payloads are never logged as timing.
 * Optimization evidence: real-child output/IPC/abort proofs took 73.52/42.95/45.11 ms; one owner avoids a second polling runner.
 */
export function startChild(command, args, options) {
  if (options.signal?.aborted) throw new Error('Child launch aborted before spawn.')
  const { budgetMs, ordinal = 1, cwd, env = process.env, input, ipc = false,
    journal = false, maxBuffer = 65536, inheritOutput = false } = options
  if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0 || !Number.isSafeInteger(ordinal) || ordinal <= 0 ||
      !Number.isSafeInteger(maxBuffer) || maxBuffer <= 0)
    throw new TypeError('Declare a positive integer child budget, ordinal and output bound before spawning.')
  const started = performance.now()
  const spawnedAtMs = Math.round(performance.timeOrigin + started)
  const timings = []
  const seen = new Set()
  /**
   * Deduplicate first observations so a noisy child cannot flood timing diagnostics.
   * Optimization evidence: the 37.87 ms journal proof includes duplicate/privacy filtering; no independent callback benchmark is claimed.
   */
  const phase = (name, elapsedMs = Math.round(performance.now() - started)) => {
    if (seen.has(name)) return
    seen.add(name)
    const row = { phase: name, elapsedMs: Math.max(0, elapsedMs) }
    timings.push(row)
    emit({ child: ordinal, startedAtMs: spawnedAtMs, budgetMs, ...row })
  }
  phase('spawn-request')
  const stdio = ['pipe', 'pipe', 'pipe', ...(journal ? ['pipe'] : []), ...(ipc ? ['ipc'] : [])]
  // POSIX descendants inherit this owned group, even after its leader exits.
  const grouped = process.platform !== 'win32'
  const child = spawn(command, args, { cwd, env, stdio, detached: grouped })
  let stdout = ''
  let stderr = ''
  let diagnostic = ''
  let pendingJournal = ''
  let pendingTiming = ''
  let bytes = 0
  let error
  let forced
  let closed = false
  let terminating = false
  let release
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  /** Signal the owned POSIX group without reinterpreting the direct child's exit result. */
  const signalTree = (signal) => {
    if (!grouped) return child.kill(signal)
    if (!child.pid) return false
    try {
      process.kill(-child.pid, signal)
      return true
    } catch (failure) {
      if (failure.code !== 'ESRCH') error ??= failure
      return false
    }
  }
  /** Finish escalation even if the group leader and its own descriptors have already closed. */
  const force = () => {
    clearTimeout(forced)
    forced = undefined
    signalTree('SIGKILL')
    release?.()
  }
  /**
   * Signal a bounded failure once, retaining a forced-kill allowance for non-cooperating children.
   * Optimization evidence: the resistant child hit its 400 ms deadline at 408 ms and closed at 511 ms with unchanged 100 ms grace.
   */
  const terminate = (code) => {
    if (terminating || closed) return
    terminating = true
    error ??= Object.assign(new Error('Bounded child did not complete normally.'), { code })
    phase(code === 'ETIMEDOUT' ? 'deadline' : 'output-limit')
    signalTree('SIGTERM')
    forced = setTimeout(force, terminationGraceMs)
  }
  const deadline = setTimeout(() => terminate('ETIMEDOUT'), budgetMs)
  /**
   * Bound all retained descriptors together; changing stream cannot bypass the limit.
   * Optimization evidence: the real output-flood child closed in 46 ms with ENOBUFS; admission retains one shared byte counter.
   */
  const admit = (chunk) => {
    bytes += Buffer.byteLength(chunk)
    if (bytes <= maxBuffer) return true
    terminate('ENOBUFS')
    return false
  }
  child.once('spawn', () => phase('spawned'))
  child.stdout.on('data', (chunk) => {
    if (!admit(chunk)) return
    stdout += chunk
    phase('output-first')
    if (/\b(?:bootstrap\.failure|diagnostic\.(?:startup|registered|unavailable))\b/.test(stdout)) phase('diagnostic-output')
    if (/Eventiva modules registered/.test(stdout)) phase('registration-output')
    if (inheritOutput) process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    if (!admit(chunk)) return
    stderr += chunk
    phase('output-first')
    if (inheritOutput) process.stderr.write(chunk)
    else {
      // Forward only validated nested-owner timing, preserving the captured business stream byte-for-byte.
      pendingTiming += chunk
      const lines = pendingTiming.split('\n')
      pendingTiming = lines.pop() ?? ''
      for (const line of lines) {
        let row
        try { row = JSON.parse(line) } catch { continue }
        if (timingRow(row)) emit(row)
      }
    }
  })
  if (journal) child.stdio[3].on('data', (chunk) => {
    if (!admit(chunk)) return
    diagnostic += chunk.toString('utf8')
    pendingJournal += chunk.toString('utf8')
    const lines = pendingJournal.split('\n')
    pendingJournal = lines.pop() ?? ''
    for (const line of lines) {
      let row
      try { row = JSON.parse(line) } catch { continue }
      if (Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && journalPhase.test(row[0]) &&
          Number.isSafeInteger(row[1]) && row[1] >= 0) phase(row[0], row[1] - spawnedAtMs)
    }
  })
  if (ipc) child.on('message', (value) => {
    phase('ipc-output')
    if (value !== null && typeof value === 'object' && (value.ready === true || value.boundary === 'ready')) phase('ready')
  })
  child.once('error', (failure) => { error ??= failure })
  // EPIPE is a launch/result failure, not an unhandled parent exception.
  child.stdin.on('error', (failure) => { error ??= failure })
  child.stdin.end(input)
  child.once('exit', () => {
    phase('exit')
    // A normally exited leader must not leave descendants holding pipes or doing background work.
    if (grouped && !terminating && signalTree('SIGTERM')) {
      terminating = true
      forced = setTimeout(force, terminationGraceMs)
    }
  })
  const completed = new Promise((resolve) => {
    child.once('close', (status, signal) => {
      closed = true
      clearTimeout(deadline)
      release = () => {
        options.signal?.removeEventListener('abort', abort)
        phase('total')
        resolve({ pid: child.pid ?? 0, status, signal, ...(error ? { error } : {}), stdout, stderr,
          output: journal ? [null, stdout, stderr, diagnostic] : [null, stdout, stderr],
          spawnedAtMs, elapsedMs: Math.round(performance.now() - started), timings })
      }
      // Closing the leader's pipes cannot cancel escalation of a resistant descendant.
      if (!forced) release()
    })
  })
  /**
   * Cancellation awaits actual pipes/IPC close and sends SIGKILL to the owned group on POSIX.
   * Windows Node-parent cleanup does not establish ownership for arbitrary native-root trees.
   * Linux descendant cancel/abort contracts completed in 66/66 ms; this is correctness evidence, not a speedup.
   */
  const cancel = async () => {
    clearTimeout(deadline)
    if (!closed || forced) {
      phase('cancel')
      terminating = true
      force()
    }
    await completed
  }
  const abort = () => { void cancel() }
  options.signal?.addEventListener('abort', abort, { once: true })
  return { child, completed, cancel }
}

/**
 * Run one noninteractive child to actual close; an AbortSignal cancels and awaits that same owner.
 * Optimization evidence: exact fake-executable compiler/editor consumer proofs took 221.89/138.38 ms; these are not real compiler budgets.
 */
export function runChild(command, args, options) {
  return startChild(command, args, options).completed
}
