# Test-process shell and deadline contracts

Canonical source: `templates/tools/test-process/process.mjs` and `process.d.mts`.
Run `node templates/tools/test-process/build-windows.mjs` before
`node --test test/test-process.test.mjs`, then static-first full verification.

## Shell interpretation is forbidden

`startChild` and `runChild` pass an executable and separate argument array to
Node `spawn` with hard-coded `shell: false`. Callers cannot override it:
every own or inherited `shell` option throws before spawn, even `false` or
`undefined`. `ChildOptions.shell?: never` rejects shell values and structurally
assigned shell options; `exactOptionalPropertyTypes` also rejects explicit
`undefined` statically. Runtime rejection does not depend on compiler settings.

Use `runChild(process.execPath, [scriptPath, ...args], { budgetMs: 1000 })`.
Windows native roots require the explicit build prerequisite described below.
Linux/macOS retain native roots without that prerequisite.
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
is inferred from IPC disconnect. Native Windows acquisitions use the private Job below.

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
Six new contracts now pass locally: live grandchildren under outer deadline,
cancel and abort, normal command/IPC/stream completion, failed spawn and
synchronous acquisition rejection. A rejection without a real child settles
the proxy with empty timings, never a fabricated child-close event.
The producer deliberately lacks a disconnect self-kill handler. Positive
no-business-IPC tests exposed buffered private messages during development;
the owner now enables Node's message dispatch explicitly. All 27 process tests
pass on Linux; every matrix OS executes these tests without skips. Hosted
results, normal house merge and Eventiva adoption remain separate gates.
This is a correctness change; no optimization speedup is claimed.

## Windows-native acquisition

Jonathan selected the native option B after the earlier Node-only restriction.
Run `node tools/test-process/build-windows.mjs` after accepted house sync on
Windows. It compiles the checked-in C# source with the installed .NET Framework 4
`csc.exe` and `System.Web.Extensions.dll`; no download, NuGet or dependency is
added. Compilation has a 30000 ms build bound and is not hidden in a child budget.
It then performs one canonical-owner native no-op acquisition of system
`cmd.exe` with fixed separate arguments `/d /c exit 0` and hard-coded
`shell:false`. This owner-approved prerequisite has its own10000ms ceiling,
selected above the prior3353ms acquisition observation. It must report request
decode, status0, Job release, actual close and final ownership release before
timed tests begin; any failure stops setup. `test.child.setup` start/complete
records distinguish its budget and elapsed time from test timing. Mandatory
child phases remain visible. Other OS hosts do nothing. `npm test` builds and
warms the template helper first. Direct test invocations must run this same
explicit prerequisite first; test startup is never silently excluded.

The platform adapter uses an unnamed, noninherited Job with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and neither breakaway flag. It creates the
native root suspended, assigns the Job before resuming, and inherits only the
three duplicated stdio handles. A private named pipe carries PID, root-exit,
empty-Job and release messages, never business output. Literal CRT argv quoting
does not introduce a shell. IPC and fd3 remain Node-entrypoint-only contracts.

Deadline, cancel, abort, owner-pipe EOF and natural root exit terminate remaining
Job processes. `QueryInformationJobObject` must observe active-process-zero
before the release handshake, supervisor exit and actual stream close settle
the existing owner. The public PID is the native root, not the supervisor.
The Node core still owns every timer, output bound, result and numeric timing;
the helper is a platform acquisition boundary, not a second budget runner.
Existing Node roots retain their libuv behavior and its breakaway limitation.
See Microsoft's [nested Job contract](https://learn.microsoft.com/windows/win32/procthread/nested-jobs).

`release` is the final private control command after empty-Job or acquisition
failure evidence. Cancellation after release sends no further `stop`, even
while Node's socket still reports writable: the supervisor may already be
closing its pipe. The owner still awaits actual supervisor/stream close.
Pre-release transport errors, including EPIPE, remain result failures; none
are filtered. See the [repair timeline](test-process-timeline.md) for proof
and the separate hosted acceptance boundary.

Local Linux proof passes 33/33 process tests, including the six native lifecycle
cases with unchanged 1000 ms budgets, real Git byte/argv/status contracts and a
compiler-shaped renamed executable. That executable is a transport fixture,
not real Hermes or compiler performance evidence. PR78 head `3a8b48d` compiled
on Windows24/current but failed eight native tests and reached the 10-minute
job limit. Git produced output at64-97 ms but exit appeared only at its deadline.
Linux/macOS passed on both Node versions; this is not all-OS qualification.

The private client now requests `PipeOptions.Asynchronous`: a pending control
read must not serialize exit/empty writes on the same Windows pipe handle.
Microsoft documents [overlapped pipe I/O](https://learn.microsoft.com/windows/win32/ipc/synchronous-and-overlapped-input-and-output)
as the way to read and write simultaneously. This is a focused correction to
the observed deadlock hypothesis; only new Windows execution can confirm it.
The existing natural Git/compiler and lifecycle assertions remain its regression
controls, with no budget, readiness allowance or threshold increase.
The local corrected full gate passes153/153. Published correction head
`fbcf2708d52f9589efa5a21afc3da50e1b84eab6` completes Windows24 at151/153 and
Windows-current at147/153. Real Git, compiler-shaped transport and delegated
native PID/close pass both. Two/six early native scenarios still fail their
unchanged700ms readiness requirement; later native closes take100-140ms.
Delayed native spawn observations include915/2146/3353ms. Neither Defender or
SmartScreen scanning nor CLR cold start/JIT is established as the cause.

The next diagnostic records `native-supervisor-spawned`, OS process creation,
managed Main entry, private control connection and request decoding through the
same canonical numeric timing owner. A non-inlined Main wrapper captures entry
before compiling the serializer-bearing method. Creation/entry use Windows
FILETIME/UTC, translated to parent-relative milliseconds; connection/decoding
are parent receipt times. Their difference is not a CPU profile or proof of
which subsystem waited. Cancellation before a report leaves that interval
unknown, never zero. Existing ready/PID/death tests require the new phases too.
Diagnostic head9275d95 completes both Windows lanes at152/153: only the first
native deadline fixture misses unchanged700ms readiness. Windows24 first
creation/Main/connection/decode/root-spawn/close is3/29/509/929/1025/1037ms;
current is4/28/454/841ms through decode and894ms through close. Subsequent
Main entries take20-26ms, connections42-48ms and decode57-64ms. Thus this run
does not show a large creation-to-Main delay; most excess is after Main and
during decoding. Assembly/JIT/page-cache and post-entry scanning are not
independently attributed. Jonathan approved the explicit setup acquisition
above via Puck on2026-11-20 after these measurements; exact human time unknown.
All child budgets,700ms readiness, assertions and phase logging remain unchanged.
New exact-head Windows execution must qualify this correction; no speedup is
claimed from moving explicitly reported setup work outside tests.

On setup head9c99904 both Windows lanes pass; Ubuntu-current instead fails a
death-observation probe after actual child close at26ms. Opening a Linux procfs
status file, reaping the process, then reading the retained descriptor reproduces
`ESRCH`, not only `ENOENT`. The probe now permits either disappearing-entry
error and still requires its existing signal-zero/death check; a live process
cannot pass. No owner implementation, assertion, readiness or budget changes.
Local static-first full verification passes153/153 with lines/functions100%
and branches95.30%; new exact-head hosted verification remains required.

Jonathan's conditional decision permits false-positive dismissal of alerts70/71
only after the corrected exact head passes every OS and both flows are confirmed
unchanged: separate argv, `shell:false`, normalized prefixed test filter.
Different alerts return for review; no alert is dismissed by these partial runs.
New alert IDs72/73 on the diagnostic head were returned to Jonathan via Puck;
the70/71 authorization is not extended to them. No alert action is taken yet.
No speedup, downstream adoption or whole EVE-261 acceptance is claimed.
