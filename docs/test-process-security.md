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
