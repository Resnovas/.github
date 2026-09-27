# AI docs

Every Resnovas repository documents itself twice: once for people, in plain words, and once for AI agents, in `ai-docs/`.
This page explains the agent half: what it is, why it is worth having, and how to set it up and write it.
[Back to the README](../README.md)

## <a id="what"></a>What it is

An AI agent (Claude Code, Codex, Cursor and the like) works best when it can read, in one go, how a codebase is meant to be used: the rules that matter, the traps, and real examples in the codebase's own style.
`LLMS.md`, at the root of the repository, is that file.

You do not write `LLMS.md` by hand.
You write short sections under `ai-docs/src`, each a folder with an `index.md` and, where it helps, example `.ts` files.
A small tool, `tools/ai-docs/docgen.mjs`, joins them into `LLMS.md`.

Why generate it: the examples are real TypeScript files the repository's type check compiles, so an example that stops working fails the build instead of teaching an agent something that is no longer true.
And CI checks that `LLMS.md` matches its sources, so it never goes stale.

## <a id="synced"></a>What the house gives you

The sync brings three files into every repository:

| File | What it is |
| --- | --- |
| `tools/ai-docs/docgen.mjs` | The generator. Plain Node 24, no dependencies, nothing to install. |
| `ai-docs/README.md` | The conventions, for whoever writes a section. |
| `ai-docs/src/05_house-standards/index.md` | The house standards every agent must follow: Effect-TS v3, strict TypeScript, typed errors, secrets, feature flags, tests and coverage, licence headers, commits and pull requests, and documenting everything twice. |

The two Markdown files have a managed block, so a repository can add to them after the `house:local` line.
Everything else under `ai-docs/src`, and `LLMS.md`, belongs to the repository.

## <a id="setup"></a>Setting it up in a repository

1. Wait for (or run) the sync, so the three files above arrive.
2. Add two package scripts, and run the check from `check`:

   ```json
   {
     "scripts": {
       "ai-docs": "node tools/ai-docs/docgen.mjs",
       "ai-docs:check": "node tools/ai-docs/docgen.mjs --check",
       "check": "... && node tools/ai-docs/docgen.mjs --check"
     }
   }
   ```

3. Include `ai-docs/src` in the type check, for example with a `tsconfig.json` in `ai-docs/` that your `typecheck` covers, so the examples keep compiling.
4. Write the repository's own sections (below).
5. Run `npm run ai-docs` (or `pnpm ai-docs`) and commit `LLMS.md` with the sources.

## <a id="writing"></a>Writing a section

A section is a folder under `ai-docs/src` whose name starts with a number: the number sets the order.
`00` to `09` belong to the house; number your own from `10`.

```
ai-docs/src/
  05_house-standards/index.md        synced
  10_overview/index.md               what the repository is, its layout, its commands
  20_secrets/
    index.md                         the rules that matter, and why
    10_decode-a-map.ts               an example
    fixtures/                        code the examples import; never shown
```

Start `index.md` with a `##` heading.
An example starts with a JSDoc block whose `@title` becomes its heading and whose other lines become the text above the code:

```ts
/**
 * @title Decode input before using it
 *
 * Input from outside the process is decoded, never cast, so a bad value
 * fails here with a typed error instead of somewhere deep inside.
 */
import { Schema } from "effect"

export const decodePort = Schema.decodeUnknown(Schema.NumberFromString)
```

A licence header comment before the JSDoc block is left out of `LLMS.md`.
Comment the why, not the what, and import from the packages' public paths, as real code would.

A good first set of sections: an overview (what it is, layout, commands, the rules that explain most of the code), then one section per area an agent is likely to change.

## <a id="running"></a>What you will see

```shell
$ node tools/ai-docs/docgen.mjs
LLMS.md written from 4 section(s) and 3 example(s).

$ node tools/ai-docs/docgen.mjs --check
LLMS.md is up to date.
```

When a source changed and `LLMS.md` was not rebuilt, `--check` prints `ai-docs: LLMS.md is out of date: run node tools/ai-docs/docgen.mjs and commit the result` and fails, and so does CI.
The title of `LLMS.md` is the `name` in `package.json`, or the folder name when there is none.

## <a id="problems"></a>Common problems

| Message | Fix |
| --- | --- |
| `LLMS.md is out of date` | Run `node tools/ai-docs/docgen.mjs` and commit `LLMS.md`. |
| `LLMS.md is missing` | Same: generate it once and commit it. |
| `ai-docs/src/<name> has no index.md` | Every section folder needs an `index.md`. Put supporting code in a `fixtures/` folder instead. |
| `no ai-docs/src directory` or `no sections under ai-docs/src` | The sync has not run yet, or the repository excluded the ai-docs files. |
| Prettier rewrote `LLMS.md` | It should not: the synced `.prettierignore` lists it. Make sure your `.prettierignore` still has its managed block. |
| An example's heading is its file name | The file has no JSDoc block with `@title` at the top (after any licence header). |
