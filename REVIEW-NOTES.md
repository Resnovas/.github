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
| Trailers | `Co-authored-by` and `Assisted-by: TOOL:MODEL` together on every AI-changed commit, autocomplete included. |
| Sign-off | Names the accountable human; tooling they set up (their own agent) may add it for them. Jonathan's agents now sign off his commits. |
| Settings | Applied weekly by the sync's settings job; see GOVERNANCE.adoc#settings. |
| Extendable config | Synced config files have a `house:managed` block; repos add rules outside it and cannot change the block. See GOVERNANCE.adoc#synced-files. |
| Bypass | The owner (repository admin role) can always bypass the ruleset, including the review gate. |
| Dropped | Separate tests repository rule, Discord and Jira channels, CoC "Intended Use". |

## Please check

1. **Legal wording.** `COOPERATION_COMMITMENT.adoc` is now version 1.2 with a new section,
   "Contributions made with AI tools". It is a public legal commitment, so it
   is worth a professional read before publishing. The GPL Cooperation
   Commitment link in its licence section should be checked too.
2. **Copyright year.** `LEGAL_HOLDER` is confirmed as "Jonathan Stevens trading as
   Resnovas". Eventiva's LICENSE said "Eventiva" and 2024; the year is now
   2026 by default and should be overridden per repo to its first publication.
3. **AI-03 changed.** It now allows tooling the human set up (their own
   agent) to add the human's sign-off, because you asked your agents to sign off
   for you. Before, it banned any agent from adding a sign-off.
4. **CODEOWNERS is now generic.** Eventiva's used quoted role names such as
   "Project Admin", which GitHub does not accept as owners, so those lines never
   took effect. The house version maps the same roles to `OWNERS_*` values.
5. **Sponsors.** `SPONSORS` is TGTGamer only; Eventiva's FUNDING.yml also listed
   the Eventiva org. Each account must have GitHub Sponsors enabled.
6. **dependabot.yml assumes npm.** Repositories without a package.json need
   `HOUSE_EXCLUDE: .github/dependabot.yml` and their own copy.
7. **Copilot code review** is requested by the ruleset on drafts and on every
   push. It uses premium requests from the PR author's Copilot allowance, and
   is skipped for authors without access.
8. **Renamed file.** `Eventiva Cooperation Commitment.adoc` becomes
   `COOPERATION_COMMITMENT.adoc`. Eventiva's old copy needs deleting when it adopts
   the sync, as does the licence text duplicated inside its CODE_OF_CONDUCT.
9. **Checks can only do so much.** CI confirms that at least one commit carries
   an AI co-author when AI was used; it cannot tell which commits were AI
   changed. Coverage thresholds are stated, but each repo's own CI enforces them.

## Before the first push

- [ ] Delete this file.
- [ ] Make the repository public (agreed), so GitHub uses these files as org defaults.
- [ ] Push `main` as the default branch; workflows reference `@main`.
- [ ] Set the push limit to 5 by hand in each repository (no API exists).
- [ ] Create the House sync GitHub App (Administration, Contents, Pull requests, Workflows: write),
      install it on each org/account, set `HOUSE_SYNC_APP_ID` and
      `HOUSE_SYNC_APP_PRIVATE_KEY` as org secrets, and add its bot login to `TRUSTED_BOTS`.
- [ ] Consider pinning actions to commit SHAs rather than major tags.
