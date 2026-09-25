# Review notes (delete before pushing)

Working notes for Jonathan's manual review of the first version of this
repository. Nothing here has been pushed. Delete this file before the first push.

## Decisions already taken

| Topic | Decision |
| --- | --- |
| Scope | House standard for every project: Climb, Resnovas, Eventiva, personal. This repo is the single source of truth; repos sync from it. |
| Contributor agreement | DCO 1.1 only. The CLA wording in Eventiva's CONTRIBUTING is gone. Every commit signed off, no size exemption. |
| AI co-author | Public rule: every AI tool that materially changed a commit gets a `Co-authored-by` trailer. Agents never sign off. |
| Material change | Anything a linter or formatter could not have produced, except a pure rename. |
| Autonomy levels | none, autocomplete, chat, agent, autonomous, with examples. |
| Audiences | Separate sections for contributors, autonomous agents, and maintainers. |
| Drafts | AI-assisted PRs open as drafts; leaving draft is the human's signature. |
| Review | Sole maintainer: owner discretion, never blocked. Two or more: 2 approvals for outside PRs, 1 other maintainer for a maintainer's PR, enforced by the `house-policy / reviews` check. |
| Enforcement | Mapped onto the Code of Conduct ladder. Undisclosed AI is a Warning; deleting tests or faking evidence is a Permanent Ban. |
| Licence | Undisclosed AI found after merge is a licence breach, cured via the Cooperation Commitment's 30-day process. "The AI did it" is not a defence. |
| CI strictness | Errors for outside contributors, warnings for maintainers. An AI sign-off is an error for everyone. |
| Values | `house.yml` in this repo, per-repo `.github/house.yml` overrides. All resolve to Resnovas. |
| Format | AsciiDoc, one sentence per line, anchors on every section and rule. |

## Please check

1. **Legal wording.** `COOPERATION_COMMITMENT.adoc` is now version 1.2 with a new section,
   "Contributions made with AI tools". It is a public legal commitment, so it
   is worth a professional read before publishing. The GPL Cooperation
   Commitment link in its licence section should be checked too.
2. **Copyright holder.** `LEGAL_HOLDER` is "Jonathan Stevens trading as
   Resnovas". Eventiva's LICENSE said "Eventiva" and 2024; the year is now
   2026 by default and should be overridden per repo to its first publication.
3. **Conduct contact.** `CONDUCT_CONTACT` points at your GitHub profile. An
   email address would be better.
4. **DCO for maintainers.** Your own commits are not signed off today, so the
   DCO check reports them as warnings on your PRs, not failures. Agents must not
   sign off for you, so this stays a warning until you sign off yourself.
5. **Autocomplete needs a co-author trailer.** By the "material change" test,
   accepted AI autocomplete of logic is material, so it needs a trailer too.
6. **Dropped Eventiva specifics.** Not carried into the house files: the separate
   tests repository rule, Discord and Jira channels, the named review bots
   (CodeRabbit, SonarCloud, SweepAI), the CoC "Intended Use" section, and the
   CODEOWNERS roles. Eventiva can keep these in a repo-local file.
7. **Renamed file.** `Eventiva Cooperation Commitment.adoc` becomes
   `COOPERATION_COMMITMENT.adoc`. Eventiva's old copy needs deleting when it adopts
   the sync, as does the licence text duplicated inside its CODE_OF_CONDUCT.
8. **Checks can only do so much.** CI confirms that at least one commit carries
   an AI co-author when AI was used; it cannot tell which commits were AI
   changed. Coverage thresholds are stated, but each repo's own CI enforces them.

## Before the first push

- [ ] Delete this file.
- [ ] Make the repository public (agreed), so GitHub uses these files as org defaults.
- [ ] Push `main` as the default branch; workflows reference `@main`.
- [ ] Create the House sync GitHub App (Contents, Pull requests, Workflows: write),
      install it on each org/account, set `HOUSE_SYNC_APP_ID` and
      `HOUSE_SYNC_APP_PRIVATE_KEY` as org secrets, and add its bot login to `TRUSTED_BOTS`.
- [ ] Consider pinning actions to commit SHAs rather than major tags.
