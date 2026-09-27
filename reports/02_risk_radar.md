# DeepTrace Report 02 — Risk Radar

**Stage:** RISK PULSE (read-only scan)
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Scope:** `App.jsx` (entire runnable application) + reference files
**Prior report:** `reports/01_repository_map.md`

---

## Classification Key

| Symbol | Meaning |
|---|---|
| ✅ CONFIRMED | Proven by git diff evidence — introduced deliberately in commit `1405373` |
| ⚠️ DEFECT | Reproducible bug found by static analysis, not in the seeded diff |
| 🔍 HYPOTHESIS | Suspected risk; requires runtime reproduction to confirm |
| ℹ️ DESIGN GAP | Missing capability that creates fragility (not a code bug) |

**Severity scale:** CRITICAL → HIGH → MEDIUM → LOW

---

## Section 1 — Confirmed Seeded Defects

These three findings are proven by the git diff between `HEAD` and `HEAD~1`. They are not hypotheses.

---

### RISK-001 · `overdue` counter inflates — today's tasks double-counted
**Status:** ✅ CONFIRMED (seeded)
**Severity:** MEDIUM
**Area:** Dashboard statistics

**Evidence (`App.jsx:63`):**
```js
// HEAD (buggy) — <= includes today
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate <= dateKey(new Date())).length;
// HEAD~1 (correct) — < excludes today
const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < dateKey(new Date())).length;
```

**Impact:** With the seed data (2 tasks due today), `overdue` = 2 on first load instead of 0. The "Needs attention" stat card shows "2 overdue tasks" while the "due today" note on the adjacent card also shows "2 due today" — the same tasks counted twice across two stats. Users are misled into thinking they have overdue work when they do not.

**Inconsistency with row-level display:** The `.overdue` CSS class on task rows at `App.jsx:93` uses strict `<` — so the row text correctly shows "Due today" while the summary stat calls it overdue. The dashboard and the task list are inconsistent with each other.

**Reproduction:** Load the app on a fresh browser (clears localStorage). The overview "Needs attention" value will be 2 (the two tasks due today). The task rows for those same tasks will read "Due today", not "Overdue".

**Next investigation:** REPLAY stage — verify row-level vs stat-level discrepancy in browser.

---

### RISK-002 · Priority sort direction is inverted — Low sorts before High
**Status:** ✅ CONFIRMED (seeded)
**Severity:** HIGH
**Area:** Search / filter / sort

**Evidence (`App.jsx:74`):**
```js
// HEAD (buggy) — b-a: rank 2 (low) comes first
if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority] || ...
// HEAD~1 (correct) — a-b: rank 0 (high) comes first
if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || ...
```

**Context:** `priorityRank = { high: 0, medium: 1, low: 2 }`. A positive comparator return moves `b` before `a`. With `b-a`, a task with priority "low" (rank=2) minus "high" (rank=0) = +2, so "low" appears before "high". This is exactly backwards from user expectation.

**Impact:** Every user who sorts by priority sees their least-urgent work at the top. This is a critical UX inversion for the core workflow of the app.

**Reproduction:** Tasks view → sort dropdown → "Priority" → observe Low tasks listed first.

**Next investigation:** REPLAY stage — screenshot or DOM check to confirm ordering.

---

### RISK-003 · Task completion toggle is one-way — completed tasks are permanently stuck
**Status:** ✅ CONFIRMED (seeded)
**Severity:** CRITICAL
**Area:** Task CRUD / status

**Evidence (`App.jsx:85`):**
```js
// HEAD (buggy) — always sets true
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
// HEAD~1 (correct) — toggles boolean
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
```

**Impact (multi-surface):**
1. **Data integrity:** Once a task is marked complete, it can never be undone without editing localStorage directly. Users who accidentally complete a task have no recovery path.
2. **Accessibility lie (`App.jsx:90`):** The aria-label reads `"Mark {title} incomplete"` for completed tasks, implying the button will un-complete the task — but it silently does nothing (sets `true` on an already-`true` value).
3. **Detail page (`App.jsx:119`):** The toggle button on the detail view has the same bug — clicking the checked circle on a completed task is a no-op.
4. **Cascading stat corruption:** Because tasks can only move open→complete and never back, the completion percentage, "Tasks to do" count, and "Weekly focus" widget all become permanently incorrect if any tasks are erroneously completed.

**Reproduction:** Complete any task → attempt to click its checkbox to un-complete → observe that it remains completed with no change.

**Next investigation:** REPLAY stage — confirm localStorage value after double-click on completed task checkbox.

---

## Section 2 — Additional Defects (Not Seeded, Found by Static Analysis)

---

### RISK-004 · `dueLabel()` calls `dateKey(new Date())` and `shiftDate(1)` on every invocation — multiple `new Date()` calls per render may produce different values across midnight
**Status:** ⚠️ DEFECT (latent, timing-dependent)
**Severity:** LOW
**Area:** Date handling

**Evidence (`App.jsx:32–38`):**
```js
function dueLabel(value) {
  if (!value) return 'No due date';
  if (value < dateKey(new Date()))   return `Overdue · ${formatDate(value)}`;  // new Date() call 1
  if (value === dateKey(new Date())) return 'Due today';                        // new Date() call 2
  if (value === shiftDate(1))        return 'Due tomorrow';                     // new Date() call 3 (inside shiftDate)
  return formatDate(value, { weekday: 'short', month: 'short', day: 'numeric' });
}
```

**Impact:** If the clock crosses midnight between the three `new Date()` calls (extremely rare, but possible), a task could evaluate as neither overdue, nor today, nor tomorrow — falling through to the generic date format. More practically: `dateKey(new Date())` and `shiftDate(1)` are re-evaluated on every render and on every call to `dueLabel`. With a list of many tasks, this is many redundant `Date` allocations per render cycle, though not a correctness bug under normal conditions.

**Secondary issue:** `dueLabel` is called from `renderTaskRow` which is called in a `.map()` at `App.jsx:106` and `App.jsx:114`. Each task row creates 3 `new Date()` objects. For typical task counts this is negligible, but it is a code smell.

**Next investigation:** Reproduce by mocking `Date` to return a time 1ms before midnight and calling `dueLabel` with today's date key.

---

### RISK-005 · `loadTasks()` silently discards all user data on any `JSON.parse` error
**Status:** ⚠️ DEFECT
**Severity:** HIGH
**Area:** Data consistency / localStorage

**Evidence (`App.jsx:23–26`):**
```js
function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : starterTasks;
  }
  catch { return starterTasks; }  // ← silently resets to seeds
}
```

**Impact:** If localStorage becomes corrupted (browser extension writes to the key, storage quota exceeded truncates the JSON string, or manual editing introduces a syntax error), the catch block silently returns `starterTasks`. The `useEffect` at `App.jsx:55` then immediately overwrites the corrupted key with the seed data:
```js
useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);
```
The user's entire task list is lost with no warning, no backup, and no recovery path. The silent overwrite makes the data loss permanent within milliseconds of opening the app.

**Reproduction:** In DevTools console: `localStorage.setItem('studywell.tasks.v1', 'INVALID_JSON')` → reload page → all tasks replaced by seed data.

**Next investigation:** REPLAY stage — reproduce in browser DevTools.

---

### RISK-006 · Seed `starterTasks` dates are stale after module is cached
**Status:** ⚠️ DEFECT (latent)
**Severity:** LOW
**Area:** Date handling / data consistency

**Evidence (`App.jsx:13–21`):**
```js
const shiftDate = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return dateKey(date); };
const starterTasks = [
  { ..., dueDate: shiftDate(0), ... },   // "today" at module parse time
  { ..., dueDate: shiftDate(-1), ... },  // "yesterday" at module parse time
  ...
];
```

`starterTasks` is a module-level constant evaluated **once** when the JavaScript module is first parsed. In a standard Vite dev server with HMR, the module is re-evaluated on each hot reload, keeping dates fresh. However, in a production build (`npm run build`), the entire module is bundled and parsed once per page load. The seed dates are therefore always correct on first page load.

**The actual risk** is more subtle: if the JavaScript bundle is cached by a service worker or aggressive HTTP cache, and a user opens the app after midnight on a day when their localStorage is empty, `shiftDate(0)` will reflect the date at which the module was **last bundled**, not today. The "due today" seed tasks will appear as overdue.

**Confidence:** LOW (requires specific caching scenario). Marking as design gap for production.

**Next investigation:** Verify with `npm run build` + `npm run preview` across a date boundary.

---

### RISK-007 · `saveTask` edit path uses stale closure over `modal.task` — race condition if modal state changes during async operation
**Status:** 🔍 HYPOTHESIS
**Severity:** LOW
**Area:** Task CRUD

**Evidence (`App.jsx:80–84`):**
```js
const saveTask = (draft) => {
  if (modal?.task) setTasks((current) => current.map((task) => task.id === modal.task.id ? { ...task, ...draft } : task));
  else setTasks((current) => [{ ...draft, id: crypto.randomUUID(), completed: false }, ...current]);
  setModal(null);
};
```

`saveTask` reads `modal?.task` from the outer closure rather than from the React state updater callback. If React batches state updates in a way that causes `modal` to be `null` at evaluation time (theoretically possible in concurrent mode), the edit path would fall through to the `else` branch, creating a duplicate task instead of updating the existing one.

**Confidence:** LOW — React 18 renders synchronously in response to event handlers by default; this race requires concurrent features that are not used here. Marking as hypothesis for awareness.

**Next investigation:** Verify whether React 18's `createRoot` activates concurrent mode for event-handler state updates. If yes, `modal.task.id` should be captured at `setModal({ type: 'edit', task })` time.

---

## Section 3 — Design Gaps (Missing Capabilities)

---

### RISK-008 · No input sanitisation on `window.prompt` profile name — XSS via localStorage on other vector
**Status:** 🔍 HYPOTHESIS
**Severity:** LOW (in-browser SPA — no server, no other users)
**Area:** Validation / security

**Evidence (`App.jsx:136`):**
```js
onClick={() => {
  const next = window.prompt('What name should we use?', profile);
  if (next?.trim()) setProfile(next.trim());
}}
```

And later:
```js
const firstName = profile.trim().split(/\s+/)[0] || 'there';
```

The profile name is rendered via JSX text nodes (`{profile}`, `{firstName}`) which React escapes. **Traditional XSS is not possible here** — React's JSX rendering prevents raw HTML injection.

However: if the profile is externally modified in localStorage (e.g. by a browser extension that writes `<img src=x onerror=alert(1)>`), and that string is read back as `profile` state, React's JSX will still safely escape it. **Risk is LOW** in this architecture.

**Residual concern:** No length limit is enforced on the prompt value. A profile name of 10,000 characters would render in the sidebar, potentially breaking layout.

**Next investigation:** Test with a 1000-character name string via `window.prompt`.

---

### RISK-009 · Search is active on all views but filters and sort state are not reset when navigating away from Tasks view
**Status:** 🔍 HYPOTHESIS
**Severity:** MEDIUM
**Area:** Search / filter / UX

**Evidence:**
- `search` state at `App.jsx:44` is a global App-level state
- Search input at `App.jsx:138` is rendered in the **topbar** — visible on all views (overview, detail, insights)
- When a user searches from overview and navigates to task detail via a task row click, the search state persists
- When user returns to tasks view, the `visibleTasks` memo at `App.jsx:67` still applies the stale search query

**Impact:** A user typing in the search box while on the overview page (where results are not shown) will silently filter the tasks list when they navigate to the Tasks view. They may see an unexpectedly short list with no obvious explanation. The `EmptyState` component at `App.jsx:147` shows "No tasks match those filters" if `filtered` is true — but `filtered` only checks `search || statusFilter !== 'all' || priorityFilter !== 'all'`, so it will show the correct message if they search in the header and see zero results.

**Potential secondary issue:** The `filtered` prop evaluation for `EmptyState` at line 114:
```js
filtered={Boolean(search || statusFilter !== 'all' || priorityFilter !== 'all')}
```
This includes `search` in the condition, so the empty state message will correctly say "No tasks match those filters" rather than "A little room to begin". Partially mitigated — but the user still has to know to clear the search box.

**Next investigation:** REPLAY — type a search term that matches zero tasks, navigate to Tasks view, confirm filtered empty state.

---

### RISK-010 · "Weekly focus" widget uses all-time completed count as a proxy for weekly progress
**Status:** ⚠️ DEFECT (logic error)
**Severity:** MEDIUM
**Area:** Dashboard statistics

**Evidence (`App.jsx:105`):**
```jsx
<Stat
  tint="blue"
  label="Weekly focus"
  value={<>{Math.min(completedTasks.length, 7)}<small> / 7</small></>}
  note={<span className="progress-track"><i style={{ width: `${Math.min(completedTasks.length / 7 * 100, 100)}%` }} /></span>}
/>
```

And in the sidebar week card (`App.jsx:136`):
```jsx
<div className="week-card-number">{Math.min(completedTasks.length, 7)}<small> / 7 tasks</small></div>
<div className="week-progress"><i style={{ width: `${Math.min(completedTasks.length / 7 * 100, 100)}%` }} /></div>
```

`completedTasks.length` is the **total** number of completed tasks across all time, not the number completed this calendar week. After a user has ever completed 7+ tasks, the weekly focus widget permanently shows "7 / 7" and a full progress bar — regardless of whether they completed any tasks this week.

**Impact:** The widget becomes permanently maxed-out and meaningless after the first 7 task completions. The "THIS WEEK" label in the sidebar week card is misleading — it claims to show this week's progress but displays a lifetime count capped at 7.

**Reproduction:** Complete 7 tasks → observe "7 / 7" with full progress bar. Create new tasks for the following week and complete none — widget still shows 7 / 7.

**Confidence:** HIGH — logic is clearly using `completedTasks.length` (lifetime) without any date filtering.

**Next investigation:** REPLAY stage — confirm the widget does not reset across a week boundary.

---

### RISK-011 · `completion` percentage uses integer rounding but is displayed without a denominator — can show misleading values
**Status:** 🔍 HYPOTHESIS
**Severity:** LOW
**Area:** Dashboard statistics

**Evidence (`App.jsx:64, 105`):**
```js
const completion = tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0;
```

With 1 completed task out of 3: `Math.round(1/3 * 100)` = `Math.round(33.33)` = 33%.
With 2 out of 3: `Math.round(66.67)` = 67%.
With 1 out of 2: `Math.round(50)` = 50%.

None of these are wrong, but the "Completed" stat card shows:
```
Completed: 1
33% of your list
```

If a user has 0 tasks, `completion = 0` (the ternary guard prevents division by zero). **No crash risk**, but the "0%" display on an empty task list is mildly confusing.

**Confidence:** LOW — this is a display quirk, not a defect.

---

### RISK-012 · `localStorage.setItem` is called synchronously on every task state change with no debounce or error handling
**Status:** ⚠️ DEFECT (reliability)
**Severity:** MEDIUM
**Area:** Data consistency / localStorage

**Evidence (`App.jsx:55`):**
```js
useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);
```

**Two sub-risks:**

**12a — No storage quota error handling:** `localStorage.setItem` throws a `DOMException` (`QuotaExceededError`) when storage is full. This call has no try/catch. If the browser's storage quota is exceeded (5–10 MB on most browsers), the `setItem` call throws, the task is lost from persistence (though it remains in React state for the current session), and the error is silently swallowed by React's event loop. On next page load, `loadTasks()` returns the last successfully serialised state — the user's most recent task may simply not appear.

**12b — No debounce:** Every keystroke in a form field that modifies task state (if patched to do so) or every toggle/save triggers a full `JSON.stringify(tasks)` + `setItem`. For typical task counts this is fast, but it is unnecessary work and could cause janky behaviour at scale.

**Reproduction of 12a:** Fill localStorage to near-quota via DevTools and then add a task with a large description — verify that `setItem` throws.

**Next investigation:** REPLAY stage — trigger quota error in DevTools, confirm data loss on reload.

---

### RISK-013 · Edit form passes `completed: task?.completed || false` — a completed task being edited has its completion status preserved only via the falsy-or fallback, which silently loses `false` completions
**Status:** 🔍 HYPOTHESIS (subtle logic)
**Severity:** LOW
**Area:** Task CRUD / validation

**Evidence (`App.jsx:165`):**
```js
const submit = (event) => {
  ...
  onSave({
    title: title.trim(), course: course.trim(), dueDate, priority,
    description: description.trim(),
    completed: task?.completed || false   // ← logical-OR, not nullish coalescing
  });
};
```

`task?.completed || false` evaluates to:
- `true || false` = `true` ✓ (completed task stays completed)
- `false || false` = `false` ✓ (open task stays open)
- `undefined || false` = `false` ✓ (new task defaults to false)

In this specific case `||` and `??` produce identical outputs because `completed` is always boolean or `undefined`. **Not a real bug given current data shapes**, but fragile: if a task object ever stored `completed: 0` (falsy integer), it would lose its completion state.

**Confidence:** LOW — not a real bug with current strictly-boolean data. Marking as design fragility.

---

### RISK-014 · No cross-tab synchronisation — multiple open tabs overwrite each other's task state
**Status:** 🔍 HYPOTHESIS
**Severity:** MEDIUM
**Area:** Data consistency / session

**Evidence:** The app listens to `hashchange` events (`App.jsx:50–54`) but does **not** listen to `storage` events on `window`. The `storage` event fires in other tabs when `localStorage` is modified.

If a user has two tabs open:
1. Tab A adds a task → localStorage is written
2. Tab B adds a task → localStorage is written, **overwriting Tab A's change**
3. Tab A's React state and Tab B's localStorage are now out of sync
4. Any action in Tab A will persist Tab A's stale state to localStorage, silently overwriting Tab B's task

**Reproduction:** Open app in two tabs → add a task in each → reload both → one task is missing.

**Next investigation:** REPLAY stage — open two tabs, perform concurrent mutations.

---

### RISK-015 · `readRoute()` applies `decodeURIComponent` but `navigate()` does not encode route components — special characters in task IDs would break routing
**Status:** 🔍 HYPOTHESIS
**Severity:** LOW
**Area:** Routing / data consistency

**Evidence (`App.jsx:27, 58, 59`):**
```js
function readRoute() { return decodeURIComponent(window.location.hash.replace(/^#\/?/, '') || 'overview'); }
const navigate = (nextRoute) => { window.location.hash = `/${nextRoute}`; };
const selectedTask = route.startsWith('task/') ? tasks.find((task) => task.id === route.slice(5)) : null;
```

Task IDs are generated with `crypto.randomUUID()` which produces lowercase hex and hyphens only (e.g. `550e8400-e29b-41d4-a716-446655440000`). These characters are all URL-safe and will never trigger `decodeURIComponent` issues.

**However:** the seed data uses static IDs like `'task-1'` through `'task-6'` — also safe. The `readRoute` decoding is technically correct but unnecessary, and the asymmetry (decode but never encode) is a latent risk if ID generation strategy ever changes.

**Confidence:** VERY LOW under current code — IDs are UUID-format only. Marking as informational.

---

### RISK-016 · Zero test coverage across all functionality
**Status:** ℹ️ DESIGN GAP
**Severity:** HIGH (operational risk)
**Area:** Testing

**Evidence:** No test framework in `package.json`. No `*.test.js`, `*.spec.js`, `__tests__/` files exist anywhere in the repository. No `test` script. No CI configuration.

**Coverage gaps — complete list of untested behaviours:**

| Untested behaviour | Risk if broken |
|---|---|
| `loadTasks()` — parse error fallback | Silent data loss (RISK-005) |
| `loadTasks()` — returns array check | Would render with non-array |
| `toggleTask()` — toggle semantics | RISK-003 confirmed bug |
| `saveTask()` — edit vs create branch | RISK-007 hypothesis |
| `saveTask()` — new task gets UUID | ID collision |
| `deleteTask()` — navigates away from detail | Navigation broken after delete |
| `overdue` counter — `<` vs `<=` | RISK-001 confirmed bug |
| Priority sort — direction | RISK-002 confirmed bug |
| `visibleTasks` — search, filter, sort combinations | Many silent regressions possible |
| `dueLabel()` — all branches (overdue, today, tomorrow, future, null) | Display defects |
| `dateKey()` — month/day padding | Off-by-one in date comparison |
| `CourseOverview` — subject deduplication, percentage calc | Stats inaccuracy |
| `completion` — zero-task edge case | Division-by-zero guard |
| `localStorage` quota error | RISK-012 data loss |
| Cross-tab `storage` event | RISK-014 data loss |
| Route parsing — unknown routes | Render null / crash |

**Recommended test framework:** Vitest (zero-config with Vite, same toolchain).

---

## Section 4 — Authentication / Session Risks

---

### RISK-017 · No user isolation — all tasks are global in the browser
**Status:** ℹ️ DESIGN GAP
**Severity:** LOW (single-user app by design)
**Area:** Auth / session

**Evidence:** No authentication exists in the runnable app. All data is in `localStorage` under keys that are not namespaced by user or session. Any person with physical access to the browser can read, modify, or delete all task data via DevTools.

**Context:** This is intentional by design (the app is a single-user personal planner). Risk is noted for completeness — not a defect.

---

### RISK-018 · Reference auth files are orphaned — partial auth surface creates confusion
**Status:** ℹ️ DESIGN GAP
**Severity:** MEDIUM (developer confusion risk)
**Area:** Auth / session

**Evidence:** `login.jsx`, `register.jsx`, `forpass.jsx`, `Resetpass.jsx`, `OAuthConsent.jsx` all exist in the repo root alongside the runnable app. They import from modules that do not exist. They are never imported from `main.jsx` or `App.jsx`. They are not referenced in `index.html`.

**Risk:** A developer unfamiliar with the repo may attempt to integrate these files into the runnable app, expecting they will work. They will fail silently at build time (Vite will 404 on `@/api/base44Client`) or at runtime. The `OAuthConsent.jsx` file in particular contains security-sensitive logic (OAuth consent flow, session token handling) that would need a complete backend to function.

**Next investigation:** Verify that `vite build` does not attempt to bundle these files (they are not in the import graph from `main.jsx`, so they should be excluded).

---

## Summary Table

| ID | Status | Severity | Area | Finding |
|---|---|---|---|---|
| RISK-001 | ✅ CONFIRMED | MEDIUM | Statistics | `overdue` uses `<=`, counts today's tasks as overdue |
| RISK-002 | ✅ CONFIRMED | HIGH | Sort | Priority sort inverted (`b-a` instead of `a-b`) |
| RISK-003 | ✅ CONFIRMED | CRITICAL | CRUD/Status | `toggleTask` always sets `true`, can't un-complete |
| RISK-004 | ⚠️ DEFECT | LOW | Date handling | `dueLabel()` creates multiple `new Date()` per call; midnight edge case |
| RISK-005 | ⚠️ DEFECT | HIGH | Data consistency | `loadTasks()` catch silently resets to seed data, loses all user tasks |
| RISK-006 | ⚠️ DEFECT | LOW | Date handling | Seed task dates stale if module cache crosses midnight (production) |
| RISK-007 | 🔍 HYPOTHESIS | LOW | CRUD | `saveTask` stale closure on `modal.task` in concurrent mode |
| RISK-008 | 🔍 HYPOTHESIS | LOW | Validation | `window.prompt` profile — no length limit, not XSS-able via JSX |
| RISK-009 | 🔍 HYPOTHESIS | MEDIUM | Search/filter | Search state persists across view navigation, silently filters task list |
| RISK-010 | ⚠️ DEFECT | MEDIUM | Statistics | "Weekly focus" uses lifetime completed count, not this-week count |
| RISK-011 | 🔍 HYPOTHESIS | LOW | Statistics | `completion` % shows "0%" on empty list (minor display quirk) |
| RISK-012 | ⚠️ DEFECT | MEDIUM | Data consistency | `localStorage.setItem` has no quota-error handler; data loss on full storage |
| RISK-013 | 🔍 HYPOTHESIS | LOW | CRUD | `task?.completed || false` fragile against non-boolean values |
| RISK-014 | 🔍 HYPOTHESIS | MEDIUM | Data consistency | No `storage` event listener — two open tabs overwrite each other |
| RISK-015 | 🔍 HYPOTHESIS | LOW | Routing | `readRoute` decodes URI but `navigate` doesn't encode — safe with UUID IDs only |
| RISK-016 | ℹ️ DESIGN GAP | HIGH | Testing | Zero test coverage across all functionality |
| RISK-017 | ℹ️ DESIGN GAP | LOW | Auth/session | No user isolation (by design, single-user app) |
| RISK-018 | ℹ️ DESIGN GAP | MEDIUM | Auth/session | Orphaned Base44 auth files create developer confusion |

---

## Priority Repair Queue

Ordered by impact × confidence:

1. **RISK-003** (CRITICAL, CONFIRMED) — Fix `toggleTask`: `completed: true` → `completed: !task.completed`
2. **RISK-002** (HIGH, CONFIRMED) — Fix priority sort: `priorityRank[b.priority] - priorityRank[a.priority]` → `a - b` order
3. **RISK-005** (HIGH, DEFECT) — Add warning + prevent silent overwrite in `loadTasks()` catch block
4. **RISK-001** (MEDIUM, CONFIRMED) — Fix `overdue` filter: `<=` → `<`
5. **RISK-010** (MEDIUM, DEFECT) — Fix "Weekly focus" to filter by current ISO week, not lifetime count
6. **RISK-012** (MEDIUM, DEFECT) — Wrap `localStorage.setItem` in try/catch with user-visible warning
7. **RISK-009** (MEDIUM, HYPOTHESIS) — Verify search persistence across views; add clear-on-navigate if confirmed
8. **RISK-014** (MEDIUM, HYPOTHESIS) — Add `window.addEventListener('storage', ...)` to sync tabs
9. **RISK-016** (HIGH, DESIGN GAP) — Add Vitest; write regression tests for all confirmed defects before patching

---

*End of Report 02 — RISK PULSE stage complete. No source files were modified during investigation.*
