# DEEPTRACE_SETUP.md

**Project:** Studywell — IBM BOB 2.0 Hackathon
**Investigation mode:** DeepTrace DIVE (read-only)
**Full report:** `reports/01_repository_map.md`

---

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173 (also bound to 0.0.0.0)
npm run build      # → dist/
npm run preview    # serve dist/ on 0.0.0.0
```

**No lint command. No test command. No single-test command. None exist.**

---

## What This Codebase Is

A React 18 + Vite single-page student task planner. The entire runnable application is in **one file**: [`App.jsx`](App.jsx). There is no backend, no API, no database, no authentication. All data lives in `localStorage`.

The repo also contains 8 non-runnable JSX files (`Dashboard.jsx`, `Tasks.jsx`, `login.jsx`, `register.jsx`, `taskdetail.jsx`, `forpass.jsx`, `Resetpass.jsx`, `OAuthConsent.jsx`) — these are design references from a prior Base44-platform version and import modules that do not exist in this repo (`@/api/base44Client`, `@/components/*`, `@/hooks/*`, `@/lib/*`). Do not attempt to run or import them.

The README and the most recent commit (`1405373`) explicitly state: **the app intentionally contains seeded logic defects for hackathon AI testing**.

---

## Architecture in One Diagram

```
index.html → main.jsx → App.jsx (entire application)
                           │
                    localStorage          ← only persistence layer
                    hash routing          ← window.location.hash, no router lib
                    lucide-react          ← icons only
```

### Routing table

| Hash | View |
|---|---|
| `#/overview` | Dashboard (default) |
| `#/tasks` | Task list |
| `#/insights` | Progress |
| `#/task/<id>` | Task detail |

### Storage keys

| Key | Value |
|---|---|
| `studywell.tasks.v1` | JSON array of task objects |
| `studywell.profile.v1` | Display name string |

---

## Confirmed Seeded Defects (commit `1405373` diff)

Three bugs were deliberately introduced in the most recent commit. All are in [`App.jsx`](App.jsx).

### BUG-01 — `overdue` counter includes today's tasks (Line 63)
```js
// BUGGY — <= makes today count as overdue
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate <= dateKey(new Date())).length;
// CORRECT — < excludes today
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < dateKey(new Date())).length;
```
**Symptom:** "Needs attention" stat shows a number that includes today's tasks, double-counting them against `dueToday`.

### BUG-02 — Priority sort is inverted (Line 74)
```js
// BUGGY — b-a puts low (rank 2) first, high (rank 0) last
if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority] || ...
// CORRECT — a-b puts high (rank 0) first
if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || ...
```
**Symptom:** Selecting "Priority" sort shows Low tasks at the top, High tasks at the bottom.

### BUG-03 — Task completion toggle is one-way only (Line 85)
```js
// BUGGY — always sets completed:true; cannot un-complete a task
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
// CORRECT — toggles the boolean
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
```
**Symptom:** Clicking the checkmark on a completed task does nothing. Tasks can only be marked done, never undone.

---

## High-Risk Areas

| Severity | Location | Issue |
|---|---|---|
| 🔴 | `App.jsx:85` | BUG-03: permanent completion — data integrity |
| 🔴 | `App.jsx:74` | BUG-02: inverted sort — UX logic failure |
| 🟡 | `App.jsx:63` | BUG-01: inflated overdue count |
| 🟡 | `App.jsx:23` | `loadTasks()` silently drops all data on any JSON parse error |
| 🟡 | `App.jsx:136` | Profile edited via `window.prompt()` — no input sanitisation |
| 🟢 | `App.jsx:55` | `localStorage.setItem` fires on every render cycle involving task state |

---

## Blockers Before Fixing

1. **No test harness** — add Vitest before applying fixes so each fix can be regression-tested
2. **No linter** — add ESLint to catch future regressions
3. **Dual-repo confusion** — root and `IBM-BOB-2.0-Hackathon/` are separate git repos; commits to root are not visible in the subdirectory

---

## Key Code Locations

| What | Where |
|---|---|
| All application logic | `App.jsx` (169 lines) |
| `overdue` counter (BUG-01) | `App.jsx:63` |
| Priority sort (BUG-02) | `App.jsx:74` |
| Toggle function (BUG-03) | `App.jsx:85` |
| `dateKey()` utility | `App.jsx:12` |
| `loadTasks()` | `App.jsx:23` |
| Route parser `readRoute()` | `App.jsx:27` |
| `navigate()` | `App.jsx:58` |
| View dispatch (`if/else`) | `App.jsx:139` |
| `TaskEditor` form | `App.jsx:158–167` |

---

## What Does NOT Exist in This Repo

- Backend / server
- Database
- API routes
- Authentication (in the runnable app)
- Tests
- ESLint / Prettier
- TypeScript
- React Router
- `@/components/`, `@/hooks/`, `@/lib/`, `@/api/` — referenced only in non-runnable files
- Environment variables (no `.env` present)

---

*DIVE complete. No source files were modified. Approved fixes should target `App.jsx` lines 63, 74, and 85.*
