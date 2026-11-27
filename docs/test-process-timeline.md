# Native control release repair

Owner: [EVE-261](https://linear.app/resnovas/issue/EVE-261) /
[Resnovas/Eventiva#1035](https://github.com/Resnovas/Eventiva/issues/1035).
This is a partial canonical process-owner repair, not whole-issue acceptance.
[Process lane](https://ampcode.com/threads/T-5dcbf3b4-41e4-4df0-906d-93629eebe199).

## Started and reproduced

2026-11-27T19:22:51Z: resumed from house main0fc2f92 after coordinating separate
process-file ownership with the Graphify lane. Its PR88 remains separate under
RES-74 / Resnovas/.github#87. No Graphify source or early Eventiva adoption.
[Run45978239438](https://github.com/Resnovas/.github/actions/runs/45978239438),
Windows/current job140435450624, fails unchanged native-root no-pipes-abort
with EPIPE at test line363. A closing-peer transport regression reproduces
post-release cancellation writes; pre-release EPIPE remains observable.

## Local correction and remaining gates

The adapter now treats release as terminal for writes, never as actual close.
The regression fails before the correction and passes afterward, retaining
root status23 and requiring actual child close. Original real-child scenarios,
assertions,1000ms budgets,700ms readiness and3000ms test limits remain intact.
Static-first full local verification passes157/157, with instrumented lines
and functions100%, branches95.30%. This is not Windows execution evidence.
PR88's unchanged-process heade592795 passed, including Windows/current
run46056167914, but its queued groupd354299f was removed after
[run46056625582](https://github.com/Resnovas/.github/actions/runs/46056625582).
Windows24 job140700644754 reproduces native no-pipes-abort EPIPE; Windows/current
passes. Ubuntu24 job140700644759 times out the compiler-shaped fixture at6226ms
against3000ms; its child subsequently closes112ms after acquisition. This
establishes pre-spawn delay, not exact hosted filesystem attribution.

The existing [PR81](https://github.com/Resnovas/.github/pull/81) fixture repair
was verified still open at5d211e7, absent from main. Reconcile that pending
bounded asynchronous setup repair with this terminal-release fix in PR81;
do not duplicate it or requeue PR88 to chase a pass. Setup retains its own
3000ms ceiling and fail-before-spawn behavior; transport remains1000ms inside
the unchanged3000ms test. Fresh controlled2500ms setup plus600ms child work
times out the old test; combined repair passes with2743ms setup and642ms
child. Controlled3200ms setup times out before any spawn-request record.
These are timing-boundary probes, not hosted filesystem attribution or speedups.
Combined static-first full verification passes157/157, lines/functions100%,
branches95.30%. Exact-head matrix/CodeQL, protected landing and
PR88 published-main revalidation remain pending. Approved Eventiva adoption
follows canonical merge. No bypass, Graphify-file edit or whole-issue closure.
