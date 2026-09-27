# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands
```bash
npm run dev      # dev server — binds 0.0.0.0, not localhost-only (intentional for containers)
npm run build    # production build → dist/
npm run preview  # serve dist/ — also binds 0.0.0.0
```
**No lint, no test, no single-test command** — none of these exist in this project.

## Architecture — critical non-obvious facts

- **Everything lives in `App.jsx`** — all views, all sub-components (`Stat`, `NavButton`, `EmptyState`, `CourseOverview`, `MetaRow`, `TaskModal`, `TaskEditor`), and all state. There is no `src/` or `components/` directory.
- **Routing is hash-based, hand-rolled** — `readRoute()` parses `window.location.hash`; no router library installed. Navigate via `window.location.hash = \`/${route}\``. Add views by extending the `if/else` chain at `App.jsx:132`.
- **Date comparisons use `YYYY-MM-DD` string lexicography** via `dateKey()` (`App.jsx:12`). Never use `Date` objects for comparisons anywhere in the codebase.
- **Two versioned localStorage keys**: `'studywell.tasks.v1'` (task array) and `'studywell.profile.v1'` (name string). Bump `.v1` suffix on any breaking schema change.
- **Task IDs** use `crypto.randomUUID()` — no uuid package needed or used.
- **Starter tasks are seeded only when localStorage is empty or unparseable** (`loadTasks()` at `App.jsx:23`). The README states the app **intentionally contains seeded logic defects** for hackathon bug-detection testing — apparent bugs may be by design.

## Non-runnable reference files
`Dashboard.jsx`, `Tasks.jsx`, `login.jsx`, `register.jsx`, `taskdetail.jsx`, `OAuthConsent.jsx`, `Resetpass.jsx`, `forpass.jsx` are **non-runnable design references** — they import from `@/components/`, `@/lib/AuthContext`, and `@/hooks/` which do not exist in this repo. Do not import or run them.

## Repo layout gotcha
`IBM-BOB-2.0-Hackathon/` is a **mirror subdirectory** of the workspace root (same files, separate `.git`). The runnable app lives at the root. Target only root files for changes.

## Code style
- `"type": "module"` in `package.json` — ESM only; `import`/`export` everywhere, never `require()`.
- Plain `.jsx`, no TypeScript, no ESLint, no Prettier — no formatter is enforced.
- Lucide icons imported individually by name: `import { Plus, Trash2 } from 'lucide-react'` with `size` prop inline.
- All styles in one minified `styles.css` — no CSS modules, no Tailwind, no CSS-in-JS.
