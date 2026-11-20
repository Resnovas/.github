# Commit identity proposal and signature evidence

**Proposal for review, not a live CI gate.** The local hook accepts author-matched provenance; the signature and human-certification evaluators await a trusted CI adapter. This is separate from native-self-build [PR #77](https://github.com/Resnovas/.github/pull/77).

Tracking: [RES-67](https://linear.app/resnovas/issue/RES-67) / [house #55](https://github.com/Resnovas/.github/issues/55), parent RES-66 / house #54. Source owner: [house funnel thread](https://ampcode.com/threads/T-01a1f637-2241-770e-aa29-22cf10bd727e).

## Approved intent and remaining decisions

Jonathan's latest 2026-11-20 decision, relayed in [Puck](https://ampcode.com/threads/T-01a1f613-a4ae-7780-b85a-74cc4a1c1727): commits authored by TGTGamer and signed by his verified account are his own commits. Apply the ordinary human path, without a platform classifier or special key mapping. His current author identity is `Jonathan Stevens <jonathan@resnovas.com>`; neither it nor the historical noreply address is hard-coded in checks. Agent-authored commits must be signed by their own agent account, not a human account.

The prior shared hook had no fixed Jonathan email, but rejected all AI authors and AI sign-offs. This change accepts author-matched provenance without claiming certification; `AI_POLICY.md`, `CONTRIBUTING.md` and the commit skills distinguish the two. The hook runs before a signed commit exists, so it cannot authenticate a platform. A trailer, environment variable, Git config value or PR author cannot supply that proof.

An agent's own sign-off is provenance only. Human DCO certification happens once per PR when the human reviews/merges it. This proposal uses the existing AI-21 accountable-human/review fields plus an authenticated approved review with explicit DCO wording. Text-only fields cannot establish who certified; a merge-commit-only path cannot gate certification before merge.

**Only PRs containing agent-authored commits need this review path.** Human-authored PRs keep ordinary sign-off and AI-21 fields, without impossible GitHub self-approval. Mixed PRs need certification too. **Every push after certification, even docs/generated-only, needs a fresh exact-head approval.** Jonathan accepted that extra step on 2026-11-20; activation still awaits merge and a reviewed downstream adapter.

## Account binding without per-tool keys

Require `signature.isValid: true`, `signature.state: VALID`, and the same positive stable GitHub account ID in `author.user.databaseId` and `signature.signer.databaseId`. Unsigned, mismatched or unresolvable agent commits fail with an instruction to sign with the agent's own identity. Account and bot identities use the same comparison; names, emails, trailers and environment variables cannot replace it. Key rotation within that account needs no per-tool allowlist update.

The pure `checkAuthorSignature(commit)` evaluator implements that comparison using authenticated GitHub data. It treats every account identically and does not discover agent accounts. A trusted adapter must establish human, agent and trusted-bot classifications; unknown is not an exemption. No signature or certification evaluator is called from CI in this proposal.

No allowlist is needed for the observed accounts. The following keys are historical evidence only, not policy inputs:

| GitHub signer | Database ID | Observed SSH SHA-256 fingerprint |
| --- | --- | --- |
| `TGTGamer` | `11413796` | `SHA256:9xIVrQMyY/M/nHJP46kRUQnvGiFAdruy9G372eBY58Q` |
| `cursoragent` | `199161495` | `SHA256:/ZGdxqU+YWGLYEplYKh2c36jVXjB1wQzjGRo7qwO46I` |

A fresh GraphQL lookup resolves the Cursor author to `cursoragent`/`199161495` and the house sample's author to `TGTGamer`/`11413796`, matching each signature's signer. A verified key proves signing-key use, not human review or DCO consent. The `SHA256:` prefix is conventional; GitHub omits it. No tool is inferred from a key, model name or co-author trailer.

## Observed signatures

Queried GitHub on 2026-11-20 around 15:59 UTC. All five source samples return `SshSignature`, `isValid: true`, `state: VALID` and `wasSignedByGitHub: false`. Author and committer match within each sample.

| Source commit | Author and committer | Signer/key row | GitHub verification timestamp |
| --- | --- | --- | --- |
| [Eventiva 9e379bf](https://github.com/Resnovas/Eventiva/commit/9e379bf6a5c6629752d14e822dd673ae51894c81) | `Jonathan <11413796+TGTGamer@users.noreply.github.com>` | TGTGamer observation | 2026-11-20T02:48:01Z |
| [smartcloud 8179e54](https://github.com/Resnovas/smartcloud/commit/8179e540cd2823df900b2ffed5a07fdf6ae9f993) | `Jonathan Stevens <jonathan@resnovas.com>` | TGTGamer observation | 2026-11-20T13:21:38Z |
| [house 380805e](https://github.com/Resnovas/.github/commit/380805eb76323f63d0ec5b26c2a8fd46eff15564) | `Jonathan Stevens <jonathan@resnovas.com>` | TGTGamer observation | 2026-11-20T15:51:30Z |
| [Eventiva 24af644](https://github.com/Resnovas/Eventiva/commit/24af644797462d92ce37bee82b3dfa838bed15f7), [Cursor PR #682](https://github.com/Resnovas/Eventiva/pull/682) | `Cursor Agent <cursoragent@cursor.com>` | Cursor observation | 2026-03-15T20:31:44Z |
| [Eventiva a9bc8df](https://github.com/Resnovas/Eventiva/commit/a9bc8dfae5f4a6dc7e95cca39f9b2f926c1d25e7), [Cursor PR #736](https://github.com/Resnovas/Eventiva/pull/736) | `Cursor Agent <cursoragent@cursor.com>` | Cursor observation | 2026-05-13T03:17:50Z |

The first two human-authored samples were identified in the task; the third was produced in this thread. Cursor samples came from the latest 100 updated PRs in each product, filtered by agent author, after inspecting 50 recent default-branch commits per product. This is bounded sampling. The Cursor signatures are historical; current key custody and availability remain unverified. Their messages contain no DCO sign-off, so these samples prove signer observations, not policy compliance.

Control: smartcloud's [squash commit 077715b](https://github.com/Resnovas/smartcloud/commit/077715b781deb8394da4d77659f11248c6e98869) returns `GpgSignature`, valid, signer `web-flow` (ID `19864447`), `wasSignedByGitHub: true`, key ID `B5690EEEBB952194`. This is a key ID, not a full fingerprint. It authenticates GitHub's squash operation, not the originating agent platform. Do not map this shared GitHub key to an agent platform or classify a squash by its author name.

The public-key blobs embedded in the REST SSH signatures for house `380805e` and Cursor `24af644` were independently SHA-256 hashed; both match the GraphQL fingerprints. This cross-check does not replace GitHub's signature verification or establish platform custody.

## Reproduce a lookup

Use authenticated, read-only GitHub access. This command reads one immutable commit; substitute another repository and full SHA from the table without changing the selected fields.

```sh
gh api graphql \
  -f repo=Eventiva \
  -f ref=9e379bf6a5c6629752d14e822dd673ae51894c81 \
  -f query='query($repo:String!,$ref:String!){repository(owner:"Resnovas",name:$repo){object(expression:$ref){... on Commit{oid author{name email user{login databaseId}} committer{name email} signature{__typename isValid state wasSignedByGitHub verifiedAt signer{login databaseId} ... on SshSignature{keyFingerprint} ... on GpgSignature{keyId}}}}}}'
```

Expected signature: `SshSignature`, valid/`VALID`, not signed by GitHub, signer `TGTGamer`/`11413796`, fingerprint `9xIVrQMyY/M/nHJP46kRUQnvGiFAdruy9G372eBY58Q`. An API failure, null signature or missing fingerprint is missing evidence, not approval.

GitHub's [signature object reference](https://docs.github.com/en/graphql/reference/objects#sshsignature) defines these fields. Its fingerprint description says hex-encoded, while the observed values are unpadded base64 SHA-256 digests, confirmed above. Preserve the actual representation and algorithm explicitly; do not guess from a field name. `verification.verified` alone is insufficient for a platform mapping.

## Activation requires another reviewed change

After review of this proposal, implement signature-aware CI using trusted default-branch policy and immutable candidate commit IDs. Read candidate commits as data only; never execute their policy or code to establish trust. Require agent author/signer account binding. Keep ordinary human commits and trusted automation distinct; do not apply the agent gate to human GitHub squash commits merely because their signer is `web-flow`.

The pre-signature hook checks message structure and author-matched provenance. The exported `checkPullRequestCertification` is a pure policy evaluator, not wired to CI. A trusted adapter must provide `commitsComplete: true` and every author's classified kind (`agent`, `human`, `trusted-bot`); empty, incomplete or unknown classifications fail. PRs without an `agent` kind skip only this new certification requirement, not ordinary sign-off or AI-21 gates.

For agent-authored contributions, provide the existing `accountableHuman` and `humanReview` fields, `humanLogins` from trusted human-certifier configuration, the exact `headSha`, `reviewsComplete: true` and all GitHub reviews. The named human's highest-ID review must have type `User`, state `APPROVED`, matching `commit_id`, and this entire review body:

> DCO certification: I certify the Developer Certificate of Origin for all changes in this pull request.

The adapter must use complete authenticated GitHub data and trusted account classification, not candidate JSON. Configured human identities still depend on owner accountability; the evaluator cannot detect an agent misusing a human's account. Run `node --test test/commit-check.test.mjs` for provenance acceptance and certification rejection/acceptance, including human controls, mixed commits, incomplete inputs, stale/bot/dismissed/replaced reviews and unconfigured certifiers. The original blanket-rejection test was updated for Jonathan's explicit policy change; mismatched/missing trailer and AI-credit checks remain.

Coordinate the matching smartcloud adapter/gate: its current signed-commit condition retains only `verification.verified`, its commit feature rejects agent trailers, and AI-21 checks text/PR-author equality rather than review authorship. No existing signer-to-platform binding was found. This source proposal does not make downstream agent PRs pass those gates; no bypass is authorized.

Current fixtures cover same-account human/agent/bot signatures without registered keys, changed signer/author, invalid/absent signatures, human-signed agents, unresolved authors, GitHub squash signer mismatch and spoofed trailers. Adapter adoption must additionally test candidate-edited policy, full pagination, real response parsing and human/trusted-bot routing. No additional permission, secret, dependency or protection change is approved by this proposal.

Jonathan retains AI-21 completion and merge of PR #79. Downstream implementation must preserve the accepted exact-head ceremony, account distinction and trust boundary. Other tools need no inventory if GitHub proves their account binding.
