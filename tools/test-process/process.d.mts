// Synced from Resnovas/.github templates/tools/test-process/process.d.mts.
/**
 * @file tools/test-process/process.d.mts
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

import type { ChildProcess } from 'node:child_process'

/** SIGTERM-to-SIGKILL allowance that every registered budget must reserve. */
export const terminationGraceMs: 100

/** Validate serial child lifetimes plus cleanup strictly below the enclosing test limit. */
export function childBudgetIssue(budgets: ReadonlyArray<number>, testMs: number): string | undefined

/** Closed phase and parent-relative monotonic duration, without command or stream payloads. */
export interface ChildTiming {
  readonly phase: string
  readonly elapsedMs: number
}

/** Completed process evidence, including failure exits and captured output without reinterpretation. */
export interface ChildResult {
  readonly pid: number
  readonly status: number | null
  readonly signal: NodeJS.Signals | null
  readonly error?: Error & { readonly code?: string }
  readonly stdout: string
  readonly stderr: string
  readonly output: ReadonlyArray<string | null>
  readonly spawnedAtMs: number
  readonly elapsedMs: number
  readonly timings: ReadonlyArray<ChildTiming>
}

/** Explicit child lifetime and stream policy; there is deliberately no timing-disable option. */
export interface ChildOptions {
  readonly budgetMs: number
  readonly ordinal?: number
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly input?: string | Uint8Array
  readonly ipc?: boolean
  readonly journal?: boolean
  readonly maxBuffer?: number
  readonly inheritOutput?: boolean
  readonly shell?: boolean
  readonly signal?: AbortSignal
}

/** One cancellable resource; completed/cancel both wait for actual stream and IPC close. */
export interface ChildOwner {
  readonly child: ChildProcess
  readonly completed: Promise<ChildResult>
  /** Terminate once and wait until the process is fully released, including after natural close. */
  readonly cancel: () => Promise<void>
}

/** Start one timed resource, retaining ownership until the caller awaits completed or cancel. */
export function startChild(command: string, args: ReadonlyArray<string>, options: ChildOptions): ChildOwner

/** Await one timed child, with optional AbortSignal cancellation through actual close. */
export function runChild(command: string, args: ReadonlyArray<string>, options: ChildOptions): Promise<ChildResult>
