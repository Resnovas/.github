/**
 * @file test/test-process.test.mjs
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

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { childBudgetIssue, runChild, startChild, terminationGraceMs } from '../templates/tools/test-process/process.mjs'

test('serial admission rejects the original pair and accepts measured and nearby valid plans', () => {
  assert.match(childBudgetIssue([10000, 10000], 5000), /shorten.*not raise/)
  assert.match(childBudgetIssue([2400, 2400], 5000), /fit below/)
  assert.equal(childBudgetIssue([2300, 2300], 5000), undefined)
  assert.equal(childBudgetIssue([60000], 65000), undefined)
  for (const value of [0, -1, 1.5, NaN, Infinity]) assert.match(childBudgetIssue([value], 5000), /positive integer/)
  assert.match(childBudgetIssue([], 5000), /positive integer/)
  assert.equal(terminationGraceMs, 100)
  assert.throws(() => startChild(process.execPath, [], { budgetMs: 0 }), /positive integer child budget/)
})

test('the dependency-free consumer preserves UTF-8, output, exit and mandatory closed timing', { timeout: 3000 }, async (t) => {
  const records = []
  t.mock.method(process.stderr, 'write', (chunk) => { records.push(JSON.parse(String(chunk))); return true })
  const result = await runChild(process.execPath, ['--eval',
    'process.stdout.write(Buffer.from([195])); setTimeout(() => { process.stdout.write(Buffer.from([169])); process.stderr.write("SECRET_ERROR"); process.exitCode = 7; }, 20)'],
    { budgetMs: 1000 })
  assert.equal(result.status, 7)
  assert.equal(result.signal, null)
  assert.equal(result.error, undefined)
  assert.equal(result.stdout, '\u00e9')
  assert.equal(result.stderr, 'SECRET_ERROR')
  assert.deepEqual(result.output, [null, '\u00e9', 'SECRET_ERROR'])
  assert.ok(result.timings.some((row) => row.phase === 'spawned'))
  assert.ok(result.timings.some((row) => row.phase === 'output-first'))
  assert.equal(result.timings.at(-1).phase, 'total')
  assert.ok(records.every((row) => row.code === 'test.child.timing' && Number.isSafeInteger(row.elapsedMs) && row.elapsedMs >= 0))
  assert.doesNotMatch(JSON.stringify(records), /SECRET_ERROR|--eval/)
  assert.deepEqual(Object.keys(result).sort(), ['elapsedMs', 'output', 'pid', 'signal', 'spawnedAtMs', 'status', 'stderr', 'stdout', 'timings'].sort())
})

test('IPC readiness, messages and cancellation retain one owner through actual close', { timeout: 3000 }, async (t) => {
  const records = []
  t.mock.method(process.stderr, 'write', (chunk) => { records.push(JSON.parse(String(chunk))); return true })
  const owner = startChild(process.execPath, ['--eval',
    'process.send({ready:true}); process.on("message", value => process.send(value)); setInterval(() => {}, 1000)'],
    { budgetMs: 2000, ipc: true })
  t.after(() => owner.cancel())
  assert.deepEqual((await once(owner.child, 'message'))[0], { ready: true })
  const reply = once(owner.child, 'message')
  owner.child.send({ canary: 'SECRET_IPC' })
  assert.deepEqual((await reply)[0], { canary: 'SECRET_IPC' })
  await owner.cancel()
  const result = await owner.completed
  assert.equal(result.signal, 'SIGKILL')
  assert.equal(result.timings.at(-1).phase, 'total')
  assert.ok(result.timings.some((row) => row.phase === 'ready'))
  assert.ok(records.some((row) => row.phase === 'cancel'))
  assert.doesNotMatch(JSON.stringify(records), /SECRET_IPC/)
  assert.throws(() => process.kill(result.pid, 0), { code: 'ESRCH' })
})

test('an abort rejects before spawn or awaits actual close without a timing-disable escape', { timeout: 3000 }, async (t) => {
  const records = []
  t.mock.method(process.stderr, 'write', (chunk) => { records.push(JSON.parse(String(chunk))); return true })
  const before = new AbortController()
  before.abort()
  assert.throws(() => runChild(process.execPath, [], { budgetMs: 1000, signal: before.signal }), /before spawn/)
  assert.equal(records.length, 0)
  const during = new AbortController()
  const owner = startChild(process.execPath, ['--eval', 'process.send({ready:true}); setInterval(() => {}, 1000)'],
    { budgetMs: 1000, ipc: true, signal: during.signal, timing: false })
  await once(owner.child, 'message')
  during.abort()
  const result = await owner.completed
  assert.equal(result.signal, 'SIGKILL')
  assert.equal(result.timings.at(-1).phase, 'total')
  assert.ok(records.some((row) => row.phase === 'cancel'))
  assert.ok(!records.some((row) => row.phase === 'deadline'))
})

test('deadline and output limits terminate real children instead of stranding the parent', { timeout: 3000 }, async () => {
  const stuck = startChild(process.execPath, ['--eval',
    'process.on("SIGTERM", () => {}); process.send({ready:true}); setInterval(() => {}, 1000)'],
    { budgetMs: 400, ipc: true })
  await once(stuck.child, 'message')
  const expired = await stuck.completed
  assert.equal(expired.error.code, 'ETIMEDOUT')
  // Windows terminates on SIGTERM rather than delivering a catchable POSIX signal.
  assert.equal(expired.signal, process.platform === 'win32' ? 'SIGTERM' : 'SIGKILL')
  assert.ok(expired.timings.some((row) => row.phase === 'deadline'))
  assert.equal(expired.timings.at(-1).phase, 'total')
  const noisy = await runChild(process.execPath, ['--eval', 'process.stdout.write("x".repeat(4096)); setInterval(() => {}, 1000)'],
    { budgetMs: 1000, maxBuffer: 32 })
  assert.equal(noisy.error.code, 'ENOBUFS')
  assert.equal(noisy.stdout, '')
  const missing = await runChild('eventiva-test-intentionally-missing-executable', [], { budgetMs: 1000 })
  assert.equal(missing.error.code, 'ENOENT')
})

test('a descendant holding output cannot extend the 150 ms child deadline', { timeout: 3000 }, async () => {
  const result = await runChild(process.execPath, ['--eval', `
    const { spawn } = require('node:child_process');
    const descendant = spawn(process.execPath, ['--eval', 'setTimeout(() => {}, 1800)'], {
      stdio: ['ignore', 1, 2],
    });
    console.log('descendant:' + descendant.pid);
    setInterval(() => {}, 1000);
  `], { budgetMs: 150 })
  assert.match(result.stdout, /descendant:\d+/)
  assert.equal(result.error.code, 'ETIMEDOUT')
  assert.equal(result.timings.at(-1).phase, 'total')
  // A generous scheduling tolerance still rejects waiting for the descendant's 1800 ms timer.
  assert.ok(result.elapsedMs < 1000, `Descendant delayed actual close to ${result.elapsedMs} ms`)
})

/** Bound regression failure independently of the owner under test, clearing the watchdog on success. */
async function within(promise, ms) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Process ownership did not finish within ${ms} ms`)), ms)
    })])
  } finally {
    clearTimeout(timer)
  }
}

/** Allow bounded OS signal delivery; a Linux zombie cannot hold descriptors or execute. */
async function assertStopped(pid) {
  for (let remaining = 10; remaining > 0; remaining--) {
    if (process.platform === 'linux') {
      try {
        if (/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'))) return
      } catch (failure) {
        if (failure.code !== 'ENOENT') throw failure
      }
    }
    try {
      process.kill(pid, 0)
    } catch (failure) {
      if (failure.code === 'ESRCH') return
      throw failure
    }
    await delay(5)
  }
  assert.fail('Descendant is still running after bounded signal delivery')
}

for (const mode of ['deadline', 'cancel', 'abort', 'exit-first', 'no-pipes', 'no-pipes-abort']) {
  test(`descendant ownership: ${mode} releases resistant descendants and actual descriptors`, { timeout: 3000 }, async (t) => {
    const noPipes = mode.startsWith('no-pipes')
    const exitFirst = mode === 'exit-first' || noPipes
    const controller = new AbortController()
    const owner = startChild(process.execPath, ['--eval', `
      const { spawn } = require('node:child_process');
      const descendant = spawn(process.execPath, ['--eval', ${JSON.stringify(`
        process.on('SIGTERM', () => {});
        process.stdout.write('DESCENDANT_OUT');
        process.stderr.write('DESCENDANT_ERR');
        if (${!noPipes}) require('node:fs').writeSync(3, 'journal-canary');
        process.send({ready: true, pid: process.pid});
        setInterval(() => {}, 1000);
        setTimeout(() => process.exit(99), 10000);
      `)}], {stdio: ${JSON.stringify(noPipes ? ['ignore', 'ignore', 'ignore', 'ipc'] : ['ignore', 1, 2, 3, 'ipc'])}});
      descendant.once('message', value => process.send(value, () => {
        if (${exitFirst}) process.exit(23);
      }));
      setInterval(() => {}, 1000);
    `], { budgetMs: 1000, ipc: true, journal: true, signal: controller.signal })
    let completed = false
    void owner.completed.then(() => { completed = true })
    let abortedAfterCompletion = false
    let descendantPid
    const ready = once(owner.child, 'message').then(([value]) => {
      descendantPid = value.pid
      return value
    })
    // Failed assertions must not rely on the broken owner to clean up a persistent descendant.
    t.after(async () => {
      if (process.platform === 'win32' && mode === 'exit-first' && owner.child.exitCode !== null) {
        const probe = spawnSync('taskkill.exe', ['/PID', String(owner.child.pid), '/T', '/F'], { encoding: 'utf8', timeout: 500 })
        t.diagnostic(`Exited-root taskkill: status=${probe.status}; error=${probe.error?.code}; ${probe.stdout.trim()} ${probe.stderr.trim()}`)
      }
      for (const pid of [descendantPid, owner.child.pid]) {
        if (!pid) continue
        try { process.kill(pid, 'SIGKILL') } catch (failure) { if (failure.code !== 'ESRCH') throw failure }
      }
      await within(owner.cancel(), 500)
    })
    assert.equal((await within(ready, 700)).ready, true)
    const close = once(owner.child, 'close')
    if (mode === 'cancel') await within(owner.cancel(), 700)
    if (mode === 'abort') controller.abort()
    if (mode === 'no-pipes-abort') {
      await within(close, 700)
      abortedAfterCompletion = completed
      if (completed) await assertStopped(descendantPid)
      controller.abort()
    }
    const result = await within(owner.completed, mode === 'deadline' ? 1500 : 700)
    const [status, signal] = await within(close, 100)
    assert.equal(result.status, status)
    assert.equal(result.signal, signal)
    if (exitFirst) {
      assert.equal(result.status, 23)
      assert.equal(result.signal, null)
      assert.equal(result.error, undefined)
      if (mode === 'no-pipes-abort')
        assert.equal(result.timings.some((row) => row.phase === 'cancel'), !abortedAfterCompletion)
    } else if (mode === 'deadline') {
      assert.equal(result.error.code, 'ETIMEDOUT')
      assert.ok(result.timings.some((row) => row.phase === 'deadline'))
    } else {
      assert.equal(result.error, undefined)
      assert.ok(result.timings.some((row) => row.phase === 'cancel'))
      assert.ok(!result.timings.some((row) => row.phase === 'deadline'))
    }
    if (!noPipes) {
      assert.equal(result.stdout, 'DESCENDANT_OUT')
      assert.equal(result.stderr, 'DESCENDANT_ERR')
      assert.equal(result.output[3], 'journal-canary')
    }
    assert.ok(result.elapsedMs < 1600, `Actual close took ${result.elapsedMs} ms`)
    assert.equal(result.timings.at(-1).phase, 'total')
    await assertStopped(descendantPid)
    t.diagnostic(`${process.platform}/${process.version} ${mode}: status=${status}, signal=${signal}, total=${result.elapsedMs} ms; descendant stopped; abortedAfterCompletion=${abortedAfterCompletion}`)
  })
}

for (const mode of ['deadline', 'cancel', 'exit-first']) {
  test(`native-root descendant ownership: ${mode} retains actual close and descendant lifetime`, { timeout: 3000 }, async (t) => {
    const backup = resolve('.amp/in/orb-backup')
    mkdirSync(backup, { recursive: true })
    const root = mkdtempSync(join(backup, 'native-descendant-'))
    const leaf = join(root, 'leaf.cjs')
    writeFileSync(leaf, `
      process.on('SIGTERM', () => {});
      process.stderr.write('NATIVE_DESCENDANT', () => {
        process.stdout.write(JSON.stringify({pid: process.pid}) + '\\n', () => {
          require('node:fs').writeFileSync(process.env.PROBE_READY, 'ready');
        });
      });
      setInterval(() => {}, 1000);
      setTimeout(() => process.exit(99), 10000);
    `)
    const windows = process.platform === 'win32'
    const command = windows ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh'
    const invocation = windows ? '"%PROBE_NODE%" "%PROBE_FILE%"' : '"$PROBE_NODE" "$PROBE_FILE"'
    const script = join(root, windows ? 'root.cmd' : 'root.sh')
    writeFileSync(script, windows
      ? (mode === 'exit-first'
        ? `@echo off\r\nstart "" /b ${invocation}\r\n:wait\r\nif not exist "%PROBE_READY%" goto wait\r\nexit /b 23\r\n`
        : `@echo off\r\n${invocation}\r\n`)
      : (mode === 'exit-first'
        ? `${invocation} &\nwhile [ ! -f "$PROBE_READY" ]; do sleep 0.01; done\nexit 23\n`
        : `${invocation} & wait\n`))
    const owner = startChild(command, windows ? ['/d', '/c', script] : [script], {
      budgetMs: 1000,
      env: { ...process.env, PROBE_NODE: process.execPath, PROBE_FILE: leaf, PROBE_READY: join(root, 'ready') },
    })
    let descendantPid
    const ready = new Promise((resolveReady) => {
      let output = ''
      owner.child.stdout.on('data', (chunk) => {
        output += chunk
        if (!descendantPid && output.includes('\n')) {
          descendantPid = JSON.parse(output.trim()).pid
          resolveReady()
        }
      })
    })
    t.after(async () => {
      if (windows && mode === 'exit-first' && owner.child.exitCode !== null) {
        const probe = spawnSync('taskkill.exe', ['/PID', String(owner.child.pid), '/T', '/F'], { encoding: 'utf8', timeout: 500 })
        t.diagnostic(`Native exited-root taskkill: status=${probe.status}; error=${probe.error?.code}; ${probe.stdout.trim()} ${probe.stderr.trim()}`)
      }
      for (const pid of [descendantPid, owner.child.pid]) {
        if (!pid) continue
        try { process.kill(pid, 'SIGKILL') } catch (failure) { if (failure.code !== 'ESRCH') throw failure }
      }
      await within(owner.cancel(), 500)
      rmSync(root, { recursive: true, force: true })
    })
    await within(ready, 700)
    assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0)
    if (mode === 'cancel') await within(owner.cancel(), 700)
    const result = await within(owner.completed, mode === 'deadline' ? 1500 : 700)
    if (mode === 'exit-first') {
      assert.equal(result.status, 23)
      assert.equal(result.signal, null)
      assert.equal(result.error, undefined)
    } else if (mode === 'deadline') assert.equal(result.error.code, 'ETIMEDOUT')
    else assert.equal(result.error, undefined)
    assert.equal(result.stderr, 'NATIVE_DESCENDANT')
    assert.equal(result.timings.at(-1).phase, 'total')
    await assertStopped(descendantPid)
    t.diagnostic(`${process.platform}/${process.version} native ${mode}: status=${result.status}, signal=${result.signal}, total=${result.elapsedMs} ms; descendant stopped`)
  })
}

test('journal and nested timing accept only closed numeric records without payload forwarding', { timeout: 3000 }, async (t) => {
  const records = []
  t.mock.method(process.stderr, 'write', (chunk) => { records.push(JSON.parse(String(chunk))); return true })
  const result = await runChild(process.execPath, ['--input-type=module', '--eval', `
    import { writeSync } from 'node:fs';
    writeSync(3, JSON.stringify(['root-start', Date.now()])+'\\n');
    writeSync(3, JSON.stringify(['SECRET_PHASE', Date.now()])+'\\n');
    process.stderr.write(JSON.stringify({code:'test.child.timing',child:7,startedAtMs:1,budgetMs:100,phase:'ready',elapsedMs:3,payload:'SECRET_PAYLOAD'})+'\\n');
    process.stderr.write(JSON.stringify({code:'test.child.timing',child:8,startedAtMs:1,budgetMs:100,phase:'SECRET_PHASE',elapsedMs:3})+'\\n');`],
    { budgetMs: 1000, journal: true })
  assert.equal(result.status, 0)
  assert.ok(result.timings.some((row) => row.phase === 'root-start'))
  assert.ok(records.some((row) => row.child === 7 && row.phase === 'ready'))
  assert.ok(!records.some((row) => row.child === 8))
  assert.doesNotMatch(JSON.stringify(records), /SECRET_/)
  assert.match(result.stderr, /SECRET_PAYLOAD/)
})

/** Exercise exact canonical runner files against tiny real executables, not mocked process APIs. */
function runnerFixture(t) {
  const backup = resolve('.amp/in/orb-backup')
  mkdirSync(backup, { recursive: true })
  const root = mkdtempSync(join(backup, 'test-process-consumer-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  put('package.json', '{"type":"module"}')
  for (const name of ['a', 'b']) {
    put(`tests/${name}/tsconfig.json`, '{}')
    put(`tests/${name}/vitest.config.mts`, 'export default {}')
  }
  put('tests/a/src/probe.spec.ts', '')
  for (const path of ['typecheck/tests.ts', 'test/file.ts', 'test-process/process.mjs']) {
    const destination = join(root, 'tools', path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(fileURLToPath(new URL(`../templates/tools/${path}`, import.meta.url)), destination)
  }
  const log = join(root, 'calls.jsonl')
  for (const [name, packageName] of [['nx', 'nx'], ['tsc', 'typescript'], ['vitest', 'vitest']]) {
    put(`node_modules/${packageName}/package.json`, JSON.stringify({ bin: { [name]: './fixture.mjs' } }))
    put(`node_modules/${packageName}/fixture.mjs`, `
import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(log)}, JSON.stringify({name:${JSON.stringify(name)},args:process.argv.slice(2)})+'\\n');
console.log(${JSON.stringify(name)}+' completed');
if (${JSON.stringify(name)} === 'nx') process.exitCode=Number(process.env.FIXTURE_BUILD_EXIT ?? 0);
if (${JSON.stringify(name)} === 'tsc' && process.argv.includes(process.env.FIXTURE_FAIL_PROJECT)) process.exitCode=1;
`)
  }
  return { root, log, calls: () => readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) }
}

test('typecheck consumer builds once, checks every project and reports a real compiler failure', { timeout: 245000 }, async (t) => {
  const fixture = runnerFixture(t)
  const result = await runChild(process.execPath, [join(fixture.root, 'tools/typecheck/tests.ts')], {
    budgetMs: 244000, cwd: fixture.root,
    env: { ...process.env, FIXTURE_FAIL_PROJECT: 'tests/a/tsconfig.json' },
  })
  assert.equal(result.status, 1)
  assert.deepEqual(fixture.calls().map((row) => row.name), ['nx', 'tsc', 'tsc'])
  assert.ok(fixture.calls().slice(1).every((row) => row.args.includes('--noEmit') && row.args.includes('--declarationMap')))
  assert.match(result.stderr, /Type errors in: tests\/a/)
  assert.doesNotMatch(result.stdout, /nx completed|All .*type-check/)
  assert.match(result.stdout, /tsc completed/)
  const records = result.stderr.split('\n').filter((line) => line.startsWith('{"code":"test.child.timing"')).map((line) => JSON.parse(line))
  assert.deepEqual(records.filter((row) => row.phase === 'total').map((row) => row.child), [1, 2, 3])
})

test('typecheck consumer refuses compilers after a failed build', { timeout: 245000 }, async (t) => {
  const fixture = runnerFixture(t)
  const result = await runChild(process.execPath, [join(fixture.root, 'tools/typecheck/tests.ts')], {
    budgetMs: 244000, cwd: fixture.root, env: { ...process.env, FIXTURE_BUILD_EXIT: '1' },
  })
  assert.equal(result.status, 1)
  assert.deepEqual(fixture.calls().map((row) => row.name), ['nx'])
  assert.match(result.stderr, /build failed.*cannot be type-checked/)
})

test('editor test consumer preserves the selected spec, coverage policy and timing', { timeout: 603000 }, async (t) => {
  const fixture = runnerFixture(t)
  const result = await runChild(process.execPath, [join(fixture.root, 'tools/test/file.ts'), 'tests/a/src/probe.spec.ts'], {
    budgetMs: 602000, cwd: fixture.root,
  })
  assert.equal(result.status, 0)
  assert.deepEqual(fixture.calls(), [{ name: 'vitest', args: ['run', '--coverage.enabled=false', 'src/probe.spec.ts'] }])
  assert.match(result.stdout, /vitest completed/)
  assert.match(result.stderr, /test.child.timing/)
  assert.match(result.stderr, /"phase":"total"/)
})
