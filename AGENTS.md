<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cognisaarthi — working notes

Read `README.md` first for the architecture and the Phase 1 scope.

## Environment

- PostgreSQL runs on **port 5433**, not 5432 (see the note in the README).
- Prisma is pinned to the 6.x line. npm's `latest` tag currently points at an
  8.0 release candidate — do not let `npm install prisma` unpin it.
- The project directory name has capitals, which npm rejects as a package
  name. The package is named `cognisaarthi` in `package.json`; do not re-run
  `create-next-app` in place.

## Rules this codebase holds itself to

1. **Never present something as working when it is not.** A feature that is not
   built is either absent or plainly labelled "Coming soon". No placeholder
   data that could be mistaken for real data. No rule described as AI.
2. **Accessibility is not a pass at the end.** Every state needs an icon or
   word as well as a colour. Every size is in `rem` so the text-size preference
   scales the whole interface. Elder touch targets clear 64px.
3. **Game logic lives in `lib/game-engine`, never in a page.** Pages stay thin.
4. **Scoring goes through `summarise()`** so a score means the same thing
   everywhere, and the server recomputes it rather than trusting the client.
5. **Elder and caregiver sessions use separate cookies.** A caregiver signing
   in must not sign out an elder who has no password.
6. **Randomised game content is built in a lazy `useState` initialiser**, not
   `useMemo` — a dropped memo cache would change the board mid-activity.
7. Keep the dependency list short. Current runtime deps: `next`, `react`,
   `@prisma/client`, `jose`, `zod`, `lucide-react`.

## Before saying something is done

```bash
npm run typecheck && npm run lint && npm run build
```

React Compiler is enabled, so `react-hooks/purity` and
`react-hooks/set-state-in-effect` are errors. They usually point at a real
problem — fix the code rather than disabling the rule, and if you must waive
one, say why in a comment at the call site.
