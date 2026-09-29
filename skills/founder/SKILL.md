---
name: founder
description: Startup founder workflows: validate ideas, product briefs, competitors, personas, MVP, pricing, GTM, landing pages, email sequences, pitch decks, fundraise prep, metrics. Load one references/*.md.
license: MIT
---
# Founder skills

Startup founder workflows from Emotix (`emotixco/claude-skills-founder`). Load **exactly one** reference for the task.

## When to use

Product briefs, idea validation, competitor matrices, personas, interviews, MVP scope, pricing, GTM, landing copy, email sequences, pitch decks, fundraise prep, or metrics dashboards.

## Commands

| Command | Purpose | Reference |
| --- | --- | --- |
| `competitor-matrix` | Research 5-8 real competitors and build a sourced feature comparison matrix, positioning gaps, threat ranking, and a niche to own. Use when a founder asks who else is in their market or how to posi... | `references/competitor-matrix.md` |
| `email-sequence` | Write a 5-7 email onboarding or re-engagement sequence with subject lines, A/B variants, send timing, and complete copy under 150 words per email. Use when a founder needs lifecycle emails for a pr... | `references/email-sequence.md` |
| `fundraise-prep` | Assess whether a startup is ready to raise, size the round and pick the instrument, build a 50-investor target list framework, and plan a 12-week raise. Use when a founder is thinking about raising... | `references/fundraise-prep.md` |
| `go-to-market` | Plan a product launch from pre-launch audience building to a 90-day growth plan, with named communities, platform-specific launch tactics, channel rankings, and a budget for $0-$500 a month. Use wh... | `references/go-to-market.md` |
| `landing-page` | Write landing page copy section by section, from hero to final call to action, including FAQ and SEO metadata. Use when a founder needs copy for a new or existing landing page. | `references/landing-page.md` |
| `metrics-dashboard` | Pick the 5 metrics that matter at a startup's current stage, with definitions, targets, actions when below target, a minimal tracking setup, and a weekly review template. Use when a founder asks wh... | `references/metrics-dashboard.md` |
| `mvp-scope` | Cut a feature wishlist down to the smallest MVP that delivers value. Triages features into must, should, and won't have, defines the critical user flow, recommends a simple stack, and estimates sol... | `references/mvp-scope.md` |
| `persona-gen` | Create 3 distinct user personas with a day in the life, quotable pain points, current workarounds, buying behavior, and a priority matrix showing who to build for first. Use when a founder needs to... | `references/persona-gen.md` |
| `pitch-deck` | Outline a 12-slide investor pitch deck with a takeaway headline, content, visual, and speaker notes for every slide, plus appendix slides for Q&A. Use when a founder is preparing a deck for a raise. | `references/pitch-deck.md` |
| `pricing-strategy` | Design pricing for a product. Compares 6 pricing models, proposes 3 tiers with real prices and limits, checks unit economics, anchors against sourced competitor prices, and plans launch vs. scale p... | `references/pricing-strategy.md` |
| `product-brief` | Turn a one-sentence startup idea into a structured product brief with problem, audience, value proposition, 5-7 MVP features, 90-day metrics, risks, and a go-to-market snapshot. Use when a founder ... | `references/product-brief.md` |
| `user-interviews` | Write a 25-minute customer discovery interview script that follows The Mom Test, with screening criteria, exact wording, red flags, and a framework for analyzing 5-8 interviews. Use when a founder ... | `references/user-interviews.md` |
| `validate-idea` | Stress-test a startup idea before any code is written. Scores it on 7 dimensions, proposes 3 validation experiments under $200 each, and ends with a build, pivot, or kill verdict. Use when a founde... | `references/validate-idea.md` |

## Rules

- Be specific and opinionated; avoid generic advice
- Use the user's natural-language input as the idea under discussion
- Do not invent library APIs here - use Context7 when coding