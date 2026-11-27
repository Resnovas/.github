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
Graphify lane reports PR88's unchanged-process heade592795 now green, including
Windows/current run46056167914; an intermittent race is not disproved by a pass.
Protected fix PR delivery and its own exact-head matrix/CodeQL remain pending.
PR88 may merge independently; approved Eventiva adoption follows published
canonical merge. No bypass, Graphify-file edit or whole-issue closure.
