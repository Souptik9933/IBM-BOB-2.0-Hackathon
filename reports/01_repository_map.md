# DeepTrace Report 01 — Repository Map

**Stage:** DIVE (read-only investigation)
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Repository:** IBM-BOB-2.0-Hackathon / Studywell

---

## 1. Repository Overview

| Property | Value |
|---|---|
| Project name | `bob-study-planner` |
| Description | Student task planner — hackathon bug-detection target |
| Language | JavaScript (JSX), no TypeScript |
| Framework | React 18 |
| Build tool | Vite 6 |
| Package manager | npm |
| Node requirement | 18+ |
| Branch (root repo) | `main` |
| Branch (subdir repo) | `main`, `agent-lead` |

### Dual-Repo Structure (Critical)

The workspace root and `IBM-BOB-2.0-Hackathon/` are **two separate git repositories containing identical files**. The root repo is the runnable application. The `IBM-BOB-2.0-Hackathon/` subdirectory is a cloned mirror with its own `.git/`. Both repos share the same commit pack — same SHAs.

```
/                               ← runnable app (git: main)
├── App.jsx                     ← ENTIRE application
├── main.jsx                    ← React entry point
├── index.html                  ← Vite HTML template
├── styles.css                  ← all CSS (minified, single file)
├── vite.config.js              ← Vite config (minimal)
├── package.json                ← deps + scripts
├── package-lock.json
├── .gitignore
├── README.md
├── AGENTS.md                   ← agent guidance (created this session)
├── .bob/                       ← Bob AI mode rules (created this session)
│   ├── rules-agent/AGENTS.md
│   ├── rules-ask/AGENTS.md
│   └── rules-plan/AGENTS.md
├── reports/                    ← DeepTrace reports (created this session)
│   └── 01_repository_map.md
│
├── [NON-RUNNABLE REFERENCE FILES — Base44 platform, missing @/ modules]
│   ├── Dashboard.jsx
│   ├── Tasks.jsx
│   ├── taskdetail.jsx
│   ├── login.jsx
│   ├── register.jsx
│   ├── forpass.jsx
│   ├── Resetpass.jsx
│   └── OAuthConsent.jsx
│
└── IBM-BOB-2.0-Hackathon/      ← git mirror (separate .git, same commits)
    └── [identical file tree]
```

---

## 2. Stack Inventory

### Runtime Dependencies (`package.json`)

| Package | Version | Role |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM renderer |
| `lucide-react` | ^0.468.0 | Icon library |

### Dev Dependencies

| Package | Version | Role |
|---|---|---|
| `vite` | ^6.1.0 | Build/dev server |
| `@vitejs/plugin-react` | ^4.3.4 | Vite React/JSX transform |

**Absent (notable):** No TypeScript, no ESLint, no Prettier, no test framework (Vitest/Jest), no React Router, no state management library (Redux/Zustand), no CSS framework (Tailwind), no backend, no API client.

---

## 3. Architecture

### 3a. Runnable Application Flow

```
index.html  →  main.jsx  →  App.jsx (entire app)
                               │
                ┌──────────────┼──────────────────────┐
                │              │                       │
           localStorage    hash-based router      lucide-react
        (tasks + profile)  (window.location.hash)   (icons only)
```

**There is no frontend → API → backend → database flow.** The entire data layer is `localStorage`.

### 3b. Data Layer

| Concern | Implementation |
|---|---|
| Persistence | `window.localStorage` |
| Tasks key | `'studywell.tasks.v1'` |
| Profile key | `'studywell.profile.v1'` |
| Task ID generation | `crypto.randomUUID()` |
| Seed data | `starterTasks` array (6 items, `App.jsx:14–21`) |
| Load strategy | Parse JSON on mount; fall back to seeds if empty/corrupt |

### 3c. Routing

No router library. Routing is fully hand-rolled via `window.location.hash`:

| Route | View rendered |
|---|---|
| `#/overview` (default) | `renderOverview()` — `App.jsx:100` |
| `#/tasks` | `renderTasks()` — `App.jsx:112` |
| `#/insights` | `renderInsights()` — `App.jsx:123` |
| `#/task/<id>` | `renderDetail()` — `App.jsx:117` |

Route parsing: `readRoute()` at `App.jsx:27`. Navigation: `navigate(route)` at `App.jsx:58`.
The `isDetail` flag at `App.jsx:130` determines which view renders; the `if/else` chain is at `App.jsx:139`.

### 3d. State (all in `App` component)

| State | Type | Description |
|---|---|---|
| `tasks` | `Task[]` | Full task list, synced to localStorage |
| `route` | `string` | Current hash route |
| `profile` | `string` | Display name, synced to localStorage |
| `search` | `string` | Search query (tasks view) |
| `statusFilter` | `'all'|'open'|'completed'` | Status filter |
| `priorityFilter` | `'all'|'high'|'medium'|'low'` | Priority filter |
| `sortBy` | `'dueDate'|'priority'|'title'` | Sort key |
| `modal` | `null|{type,task?}` | Open modal descriptor |

### 3e. Task Data Shape

```js
{
  id: string,           // crypto.randomUUID() or 'task-N' for seeds
  title: string,        // max 120 chars
  course: string,       // max 60 chars
  dueDate: string,      // 'YYYY-MM-DD' | null
  priority: 'high'|'medium'|'low',
  completed: boolean,
  description: string   // max 500 chars
}
```

---

## 4. Component Inventory (`App.jsx`)

All components are defined in a single file. None are exported except `App`.

| Component / Function | Line | Type | Purpose |
|---|---|---|---|
| `dateKey(date)` | 12 | utility | Formats `Date` → `'YYYY-MM-DD'` string |
| `shiftDate(days)` | 13 | utility | Returns `YYYY-MM-DD` N days from today |
| `starterTasks` | 14–21 | constant | Seed data (6 tasks) |
| `loadTasks()` | 23–26 | utility | Load from localStorage or return seeds |
| `readRoute()` | 27 | utility | Parse hash to route string |
| `formatDate(value, opts)` | 28–31 | utility | Format `YYYY-MM-DD` → human string |
| `dueLabel(value)` | 32–38 | utility | Produce overdue/today/tomorrow/date label |
| `App` | 40–143 | component | Root — owns all state, all views |
| `renderTaskRow(task, compact)` | 88–96 | render fn | Single task row (used in list + overview) |
| `pageHeading(...)` | 98 | render fn | Reusable section header |
| `renderOverview()` | 100–110 | render fn | Overview/dashboard view |
| `renderTasks()` | 112–115 | render fn | Full task list view |
| `renderDetail()` | 117–121 | render fn | Task detail view |
| `renderInsights()` | 123–128 | render fn | Progress/insights view |
| `Stat` | 145 | component | Stats card |
| `NavButton` | 146 | component | Sidebar nav item |
| `EmptyState` | 147 | component | Empty list placeholder |
| `CourseOverview` | 148–152 | component | Subject progress list |
| `MetaRow` | 153 | component | Detail page metadata row |
| `TaskModal` | 154–157 | component | Modal dispatcher (delete vs edit/create) |
| `TaskEditor` | 158–167 | component | Create/edit form modal |

---

## 5. Authentication

### Runnable App
**None.** No login, no sessions, no tokens. The app is fully open; profile is a free-text name stored in `localStorage`.

### Reference Files (Non-Runnable)
The Base44-platform reference files implement a full auth system — present in code but **completely absent from the runnable build**:

| File | Auth mechanism |
|---|---|
| `login.jsx` | Email/password via `base44.auth.loginViaEmailPassword()` + Google OAuth via `base44.auth.loginWithProvider("google", returnTo)` |
| `register.jsx` | Email registration + OTP email verification via `base44.auth.register()` + `base44.auth.verifyOtp()` |
| `forpass.jsx` | Password reset request via `base44.auth.resetPasswordRequest()` — always shows success (intentional) |
| `Resetpass.jsx` | Token-based password reset via `base44.auth.resetPassword()` |
| `OAuthConsent.jsx` | MCP OAuth consent flow — approves/denies AI client access to app tools via `/api/apps/:appId/mcp/` endpoints |
| `Dashboard.jsx` | Auth context `useAuth()` from `@/lib/AuthContext` |

**Missing modules** (not present in repo): `@/api/base44Client`, `@/lib/AuthContext`, `@/lib/authReturnTo`, `@/lib/app-params`, `@/components/AuthLayout`, `@/components/GoogleIcon`, `@/components/ui/*`, `@/components/common/*`, `@/components/dashboard/*`, `@/components/tasks/*`, `@/hooks/*`

---

## 6. API Routes

**None in the runnable app.** No server, no API.

The `OAuthConsent.jsx` reference file shows two platform API endpoints that existed in the original Base44 app:
- `GET /api/apps/:appId/mcp/consent-info?handle=<ctx>`
- `POST /api/apps/:appId/mcp/authorize-grant` — body `{ ctx, action: 'approve'|'deny' }`

These are platform-managed, not developer-defined, and cannot be called from the runnable app.

---

## 7. Tests

**None.** There is no test framework, no test files, no `test` script in `package.json`. Zero test coverage.

---

## 8. Configuration Files

| File | Purpose |
|---|---|
| `vite.config.js` | Minimal: `plugins: [react()]` only, no aliases, no proxy |
| `package.json` | Deps + 3 scripts: `dev`, `build`, `preview` |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `.env`, `.env.*` (allows `.env.example`) |
| `index.html` | Vite entry; mounts `#root`; loads `/main.jsx` as module |

No `.env` files, no environment variables, no TypeScript config, no ESLint config, no Prettier config, no Babel config.

---

## 9. Git History Summary

| Commit | SHA | Description |
|---|---|---|
| HEAD | `1405373` | **Seed intentional bugs for hackathon AI testing** |
| HEAD~1 | `d0834b2` | Build runnable Studywell task planner |
| HEAD~2 | `7ae2af2` | Add Tasks component |
| HEAD~3 | `268610f` | Add TaskDetail component |
| HEAD~4 | `d0f69f1` | Add ResetPassword component |
| HEAD~5 | `022f974` | Create register.jsx |
| HEAD~6 | `991ed9d` | Create OAuthConsent.jsx |
| HEAD~7 | `ec08e46` | Add login component |
| HEAD~8 | `dae6f40` | Implement Forgot Password feature |
| HEAD~9 | `99cbedb` | Create Dashboard component |
| HEAD~10 | `fb86715` | Initial commit |

---

## 10. Confirmed Defects (Seeded — commit `1405373`)

The diff between `HEAD` and `HEAD~1` reveals exactly **three deliberate mutations** to `App.jsx`:

### BUG-01 · `overdue` counter double-counts due-today tasks
**File:** `App.jsx:63`
**Operator changed:** `<` → `<=`

```js
// BUGGY (HEAD):
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate <= dateKey(new Date())).length;
// CORRECT (HEAD~1):
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < dateKey(new Date())).length;
```

**Effect:** Tasks due today are counted in both `dueToday` (line 62) AND `overdue` (line 63). The "Needs attention" stat card shows an inflated overdue count that includes today's tasks.

---

### BUG-02 · Priority sort order is inverted
**File:** `App.jsx:74`
**Operands swapped:** `a - b` → `b - a`

```js
// BUGGY (HEAD):
if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority] || ...
// CORRECT (HEAD~1):
if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || ...
```

**Context:** `priorityRank = { high: 0, medium: 1, low: 2 }`. Lower rank = higher priority.
**Effect:** Sorting by priority shows Low tasks first and High tasks last — exactly backwards. With the fix (`a - b`), rank 0 (high) sorts to the top.

---

### BUG-03 · Task completion toggle is one-way only (cannot un-complete)
**File:** `App.jsx:85`
**Toggle replaced with set-true:**

```js
// BUGGY (HEAD):
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
// CORRECT (HEAD~1):
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
```

**Effect:** Clicking the completion checkbox always sets `completed: true`. A completed task can never be marked incomplete. The aria-label says "Mark X incomplete" but the action is a no-op for already-completed tasks.

---

## 11. High-Risk Areas

| Risk | Location | Description |
|---|---|---|
| 🔴 HIGH | `App.jsx:85` | BUG-03: one-way toggle — data integrity issue; tasks become permanently stuck |
| 🔴 HIGH | `App.jsx:74` | BUG-02: inverted sort — UX logic inversion in primary sort mode |
| 🟡 MED | `App.jsx:63` | BUG-01: double-count — misleading stat display |
| 🟡 MED | `App.jsx:23–26` | `loadTasks()` silently discards all stored tasks on any JSON parse error |
| 🟡 MED | `App.jsx:136` | Profile edited via `window.prompt()` — no validation beyond `.trim()` check |
| 🟡 MED | `App.jsx:55` | `localStorage.setItem` called on every task state change — no throttle/debounce |
| 🟢 LOW | `App.jsx:13` | `shiftDate()` uses `new Date()` at module load time for seed data; seeds will have stale dates if module is cached |
| 🟢 LOW | `App.jsx:12` | `dateKey()` uses local timezone; two users in different timezones see different "today" for the same UTC moment |

---

## 12. Blockers

| Blocker | Impact |
|---|---|
| Non-runnable reference files import `@/` modules that don't exist | `Dashboard.jsx`, `Tasks.jsx`, etc. cannot be run without restoring the full Base44 app scaffold |
| No test harness | No automated regression possible without adding Vitest or Jest first |
| No linter | Code quality checks require ESLint setup before enforcement |
| `IBM-BOB-2.0-Hackathon/` subdirectory is a separate git repo | Changes committed to root will not be reflected in the subdirectory and vice versa |

---

## 13. Data Flow Diagram

```
User action
    │
    ▼
React event handler (App.jsx)
    │
    ├─► setTasks() / setModal() / setProfile() / setSortBy() etc.
    │       │
    │       ▼
    │   React re-render
    │       │
    │       ├─► visibleTasks (useMemo) — filter + sort pipeline
    │       │
    │       └─► renderOverview / renderTasks / renderDetail / renderInsights
    │
    └─► useEffect: localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
                   localStorage.setItem(PROFILE_KEY, profile)

On mount:
    localStorage.getItem(STORAGE_KEY) → loadTasks() → useState initial value
    window.location.hash              → readRoute()  → useState initial value
    localStorage.getItem(PROFILE_KEY) → profile useState initial value
    window.addEventListener('hashchange', ...) → updates route state
```

---

*End of Report 01 — DIVE stage complete. No source files were modified during investigation.*
