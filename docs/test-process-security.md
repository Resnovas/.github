# Test-process shell and deadline contracts

Canonical source: `templates/tools/test-process/process.mjs` and `process.d.mts`.
Run `node --test test/test-process.test.mjs`, then static-first full verification.

## Shell interpretation is forbidden

`startChild` and `runChild` pass an executable and separate argument array to
Node `spawn` with hard-coded `shell: false`. Callers cannot override it:
every own or inherited `shell` option throws before spawn, even `false` or
`undefined`. `ChildOptions.shell?: never` rejects shell values and structurally
assigned shell options; `exactOptionalPropertyTypes` also rejects explicit
`undefined` statically. Runtime rejection does not depend on compiler settings.

Use `runChild(process.execPath, [scriptPath, ...args], { budgetMs: 1000 })`.
Windows accepts only that current Node executable; other roots throw typed
`UnsupportedChildRootError` before spawn. Linux/macOS retain native roots.
This is an argument-transport contract, not a sandbox: executing an explicitly
selected interpreter, Node `--eval`, or a trusted script still executes code.

The real-child matrix test compares complete argv values, including spaces,
quotes, semicolon, literal `$VAR`, `&&`, pipe and backslash. It uses both a script
path and cwd containing spaces and an environment variable that must not expand.
The same test runs on all six OS/Node lanes, with no platform skip. Runtime
rejection tests assert zero spawn calls. Local strict TypeScript validation of
the declaration accepts ordinary options and rejects true/false/undefined shell
properties and structural assignment; it uses Eventiva's already installed
compiler without adding a house dependency.

## Caller audit and adoption boundary

House production consumers are `templates/tools/typecheck/tests.ts` and
`templates/tools/test/file.ts`, plus their generated mirrors. Both select
`process.execPath`, resolve installed package Node entry points and construct
argument arrays. Neither concatenates an executable and arguments into a shell
command. Test-only POSIX native-root scenarios deliberately run `/bin/sh` with a
trusted fixture script path, not an uncontrolled command string.

Eventiva's published telemetry adapter also launches `process.execPath` with an
argument array. Its legacy editor launcher still sets `shell: true` on Windows
before PR59 adoption; the house replacement removes that shell and runs the
package's Node entry point. Do not describe the downstream source as fixed until
normal merged-house sync and Eventiva verification execute. No unpublished house
source is adopted early.

Alerts [64](https://github.com/Resnovas/.github/security/code-scanning/64) and
[65](https://github.com/Resnovas/.github/security/code-scanning/65) report shell
interpretation flows at the generic spawn boundary. The contract and literal
transport tests support a human false-positive review, not an automatic dismissal
or a claim that arbitrary chosen executables are safe. Merge requires resolved
alerts and the full green matrix, not merely a successful CodeQL job.

## Separate deadline from bootstrap readiness

The 150 ms test always asserts expiry and actual close below its existing
1000 ms scheduling tolerance. It cannot also promise Node initialization and a
descendant PID before expiry. Its PID prerequisite moved, with owner approval,
to the six existing 1000 ms scenarios in the same test file and six-lane matrix:
deadline, cancel, abort, natural exit, ignored pipes and ignored-pipe abort.
Each requires IPC readiness, a positive integer PID and descendant death.
No deadline, cleanup allowance, coverage threshold or OS coverage is increased.

Linux Node24.22.3 on two CPUs, two finite CPU loops, 24 instrumented probes:
serial and four-child cohorts each emitted24/24 PID markers; eight-child cohorts
emitted3/24. In the latter, first child JS appeared in11/24 at71-179 ms and the
post-child_process-load phase in9/24 at75-188 ms;13/24 never reached first JS.
All24 expired and closed in254-325 ms. Those same records fail the old PID
assumption21 times but satisfy the deadline/close assertions24 times. A fresh
loaded execution of the corrected150 ms test and all six1000 ms scenarios passes
7/7, retaining ready/PID/death coverage. This establishes the test's incorrect
startup guarantee, not a harness speedup or an exact reconstruction of the
original scheduler. An earlier diagnostic with a malformed eval newline is
excluded; corrected fixture status/stderr and phase records were inspected.

## Explicit descriptor-close evidence

Every child emits `close` from the actual Node `close` callback, whether or not
fd3 is enabled. `exit` records leader exit; `close` records drained descriptors;
`total` records ownership release, which may additionally await descendant
escalation. None substitutes for another. Nested safe timing forwarding accepts
`close` without exposing stream payloads. There is no new option or timing opt-out.

The existing ordinary/no-fd3, journal, IPC cancellation and deadline contracts
require this phase on all six matrix lanes. Before the correction, the three
focused ordinary/cancel/deadline cases failed with `exit,total` instead of
`close,total`; afterward the full local process suite passes21/21. All existing
budgets, signals, assertions, output bounds and resource-release rules remain.
This adds evidence, not a runtime optimization or downstream acceptance claim.

## Nested ownership survives an intermediate process

`nested: true` (default false) opens a private IPC control channel for Node
roots. A canonical acquisition inside that root delegates to the surviving
outer observer, which calls the same `startChild`, retains its real handle,
and awaits its actual `close` before outer `total`. `result.children` contains
the recursive completed evidence, including actual close timings. No close
is inferred from IPC disconnect. Windows remains Node-root only, option B.

Joining the intermediate's POSIX group alone would kill its observer before
it could report grandchildren closing. Delegation keeps observation outside
that failure domain without a second process launcher or polling supervisor.
Outer deadline, cancellation, AbortSignal and natural leader exit cancel the
delegated descendants, including those with their own canonical groups.
The existing 100 ms grace, output bounds and budgets are unchanged.

Business IPC is distinct from the reserved `__house_child_owner_v1` envelope;
`HOUSE_CHILD_OWNER=1` identifies the inherited private channel, not a timing
toggle. Do not use that envelope or disconnect ownership IPC while awaiting a
nested result. Private control works even with business `ipc: false` and no
fd3. Arguments, selected cwd/env, byte input, output, error code, send callback
and exit status survive transport. The declared `ChildHandle` is intentionally
limited to streams, events, PID/status, send and kill; raw stdin, descriptors,
ref/unref and IPC handle passing are not delegated. Supply stdin with `input`.
Await `spawn` or readiness before using a delegated PID.

Three regressions first fail descendant-death assertions on accepted PR74.
Five new contracts now pass locally: live grandchildren under outer deadline,
cancel and abort, normal command/IPC/stream completion, and failed acquisition.
The producer deliberately lacks a disconnect self-kill handler. Positive
no-business-IPC tests exposed buffered private messages during development;
the owner now enables Node's message dispatch explicitly. All 26 process tests
pass on Linux; every matrix OS executes these tests without skips. Hosted
results, normal house merge and Eventiva adoption remain separate gates.
This is a correctness change; no optimization speedup is claimed.
