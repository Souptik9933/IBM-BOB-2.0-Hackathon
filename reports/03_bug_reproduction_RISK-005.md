# DeepTrace Report 03 — Bug Reproduction: RISK-005

**Stage:** REPLAY (read-only investigation)
**Finding ID:** RISK-005
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Prior reports:** `reports/01_repository_map.md`, `reports/02_risk_radar.md`

---

## Summary

`loadTasks()` at `App.jsx:23–26` silently returns seed data whenever `localStorage` contains a value that is either unparseable JSON or a non-array JSON value. Immediately after React mounts, the `useEffect` at `App.jsx:55` unconditionally overwrites `localStorage` with whatever `tasks` state holds — which is now the seed array. The user's real data is permanently destroyed within one render cycle, with no error message, no console warning, and no recovery path.

**Status:** ⚠️ DEFECT — Not one of the three seeded bugs. Found independently by static analysis.
**Confidence:** HIGH (logic is deterministic; no runtime uncertainty in the primary path)
**Severity:** HIGH

---

## 1. Fault Location

| Element | File | Line | Code |
|---|---|---|---|
| `STORAGE_KEY` constant | `App.jsx` | 9 | `const STORAGE_KEY = 'studywell.tasks.v1';` |
| `loadTasks()` — read + fallback | `App.jsx` | 23–26 | `try { JSON.parse(...) } catch { return starterTasks; }` |
| `useState` init | `App.jsx` | 41 | `const [tasks, setTasks] = useState(loadTasks);` |
| Write-back `useEffect` | `App.jsx` | 55 | `useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);` |
| React entry point | `main.jsx` | 6–9 | `createRoot(...).render(<React.StrictMode><App /></React.StrictMode>)` |

---

## 2. Code Under Investigation

```js
// App.jsx:9
const STORAGE_KEY = 'studywell.tasks.v1';

// App.jsx:14–21
const starterTasks = [
  { id: 'task-1', title: 'Read chapter 06: Data structures', ... },
  { id: 'task-2', title: 'Problem set 04', ... },
  // ... 4 more seed tasks
];

// App.jsx:23–26  ← THE FAULT
function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : starterTasks;
  }
  catch { return starterTasks; }   // ← no logging, no warning, silently returns seeds
}

// App.jsx:41  ← Seeds become initial state
const [tasks, setTasks] = useState(loadTasks);

// App.jsx:55  ← Seeds unconditionally overwrite localStorage after first render
useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);
```

---

## 3. Full Data Flow Trace

### 3a. Normal write path (happy path — establishes the precondition)

```
User action (e.g. "Create task")
  │
  ▼
TaskEditor.submit() — App.jsx:165
  │  calls onSave(draft)
  ▼
saveTask(draft) — App.jsx:80–84
  │  calls setTasks(current => [{...draft, id: UUID, completed: false}, ...current])
  ▼
React schedules re-render
  │
  ▼
App() re-executes
  │  tasks = [newTask, ...previousTasks]
  ▼
useEffect dependency [tasks] has changed — effect fires after paint
  │
  ▼
localStorage.setItem('studywell.tasks.v1', JSON.stringify(tasks))
  │
  └─→ localStorage now contains: '[{"id":"<uuid>","title":"...","completed":false,...}, ...]'
```

After this sequence, `localStorage['studywell.tasks.v1']` is a well-formed JSON array string. A user who has created several tasks and closes the tab has this value stored.

---

### 3b. Corruption — how the key becomes invalid

There are four realistic corruption vectors. Each produces a value that causes `loadTasks()` to discard all user data:

#### Vector A — Manual DevTools edit (most common during development/testing)
A developer opens Application → Local Storage in DevTools and types a direct edit to the key value.
- Typo mid-edit: `[{"id":"task-1"` (unclosed) → `SyntaxError` on parse → `catch` fires
- Clear the value field and save: value becomes `""` → `JSON.parse("")` throws `SyntaxError`

#### Vector B — Browser extension writes to the key
Some productivity extensions (clipboard managers, form-fillers, or poorly scoped data-sync extensions) enumerate all localStorage keys and may overwrite or corrupt values. If an extension writes a non-JSON string to `'studywell.tasks.v1'`, the next page load triggers the fallback.

#### Vector C — Storage quota truncation
`localStorage` is typically capped at 5–10 MB per origin. If the storage quota is nearly full and a write truncates mid-JSON (e.g. the buffer is exhausted mid-array), the stored value becomes `'[{"id":"task-1",...},{"id":"task-2",...},{"id'` — valid UTF-8 but invalid JSON. `JSON.parse` throws `SyntaxError`.

> **Note:** Modern browsers typically throw `QuotaExceededError` at the `setItem` call rather than silently truncating. However, the `useEffect` at `App.jsx:55` has **no try/catch** — a `QuotaExceededError` here is an unhandled exception that React will surface as an error boundary event (none exists), meaning the write silently fails and the in-memory state diverges from storage. On the **next** page load, the old (pre-quota-exceeded) JSON is still present and loads correctly. This is a separate risk from RISK-005 but worth noting here.

#### Vector D — JSON object instead of array (valid JSON, wrong shape)
`JSON.parse` succeeds but returns a non-array:
- Someone writes `{"tasks": [...]}` (object wrapper) → `Array.isArray(stored)` returns `false` → `return starterTasks`
- Someone writes `null` → `JSON.parse('null')` succeeds, returns `null` → `Array.isArray(null)` is `false` → `return starterTasks`
- Someone writes `"hello"` → `JSON.parse('"hello"')` succeeds, returns a string → `Array.isArray` false → `return starterTasks`

> **Critical distinction:** Vector D does **not** throw — it passes through `JSON.parse` successfully. The `try/catch` is irrelevant here. The `Array.isArray` guard is the only check, and it silently discards without any indication.

---

### 3c. The overwrite — step-by-step destruction sequence

This is the core of the defect. The sequence below applies regardless of which vector caused the corruption:

```
STEP 1: localStorage['studywell.tasks.v1'] = <corrupt/non-array value>
         (occurred before this page load — by any of Vector A–D above)

STEP 2: User opens / refreshes the app
         Browser fetches index.html → loads main.jsx → loads App.jsx
         Module-level code executes:
           starterTasks is constructed with today's relative dates

STEP 3: React renders App component for the first time
         useState(loadTasks) calls loadTasks() as the initialiser function

STEP 4: loadTasks() executes (App.jsx:23–26)
         localStorage.getItem('studywell.tasks.v1') → <corrupt value>
         JSON.parse(<corrupt value>) → throws SyntaxError  [Vector A/B/C]
         OR JSON.parse(<corrupt value>) → non-array        [Vector D]

         In either case:
           return starterTasks   ← user's real tasks never enter React state

STEP 5: tasks state is initialised to starterTasks (6 seed tasks)
         App renders the seed tasks as if the user has a fresh account

STEP 6: React commits to DOM, runs layout effects, then passive effects
         useEffect([tasks]) fires because tasks changed (initial mount always fires)
         App.jsx:55: localStorage.setItem('studywell.tasks.v1', JSON.stringify(starterTasks))

         ┌─────────────────────────────────────────────────────────────────────┐
         │  AT THIS EXACT MOMENT, the user's real tasks are PERMANENTLY GONE.  │
         │  The corrupt/wrong value has been replaced by the seed array.        │
         │  No exception. No console.error. No toast. No modal. Nothing.        │
         └─────────────────────────────────────────────────────────────────────┘

STEP 7: All subsequent renders and saves use the seed array as the baseline.
         Any new tasks the user creates are appended to the seeds.
         The original user data cannot be recovered from localStorage.
```

---

### 3d. React StrictMode double-invoke — does it change anything?

`main.jsx:7` wraps `App` in `<React.StrictMode>`. In development builds, StrictMode **double-invokes** the component function and calls effects twice (mount → unmount → remount) to detect side effects.

**In development (`npm run dev`):**
- `loadTasks()` is called twice as the `useState` initialiser
- The `useEffect` at line 55 fires twice — the overwrite happens twice
- **The data loss still occurs.** The double-invocation does not protect against it; it makes the overwrite happen one extra time, but the outcome is identical.

**In production (`npm run build` + `npm run preview`):**
- StrictMode double-invocation is suppressed
- Effects fire once
- **Data loss still occurs on the single effect run.**

---

## 4. Reproduction Scenarios

### Scenario A — Minimum steps (DevTools, 60 seconds) — CONFIRMED BY STATIC ANALYSIS

**Precondition:** App has been used — user has real tasks in localStorage.

**Steps:**
```
1. Open http://localhost:5173 in a browser with npm run dev running
2. Create at least one custom task so localStorage is populated with real user data
   (e.g. "My Important Task", course "Algebra", due date tomorrow, high priority)
3. Open DevTools → Application tab → Local Storage → http://localhost:5173
4. Click on the key 'studywell.tasks.v1'
5. In the value field, type: CORRUPTED  (or any non-JSON string) and press Enter
6. Refresh the page (Cmd+R / Ctrl+R)
```

**Expected behaviour:**
```
The app detects that stored data is invalid and either:
  (a) shows an error/warning to the user, or
  (b) keeps the corrupt value and does not overwrite it, or
  (c) attempts to parse any recoverable data, or
  (d) at minimum, logs a console.error before falling back to seeds.
The user's custom task "My Important Task" should still be visible
or an error state should be presented.
```

**Actual behaviour:**
```
The app silently loads with 6 seed tasks, exactly as if opened for the first time.
"My Important Task" is gone.
localStorage['studywell.tasks.v1'] now contains the 6-item seed array (JSON).
The corrupt value has been permanently overwritten.
The user sees no error, no warning, no notification.
```

**Verification (DevTools console commands to confirm):**
```js
// BEFORE refresh — set up the corruption:
localStorage.setItem('studywell.tasks.v1', 'CORRUPTED');
console.log(localStorage.getItem('studywell.tasks.v1'));
// → "CORRUPTED"

// AFTER refresh — check what happened:
console.log(localStorage.getItem('studywell.tasks.v1'));
// → '[{"id":"task-1","title":"Read chapter 06: Data structures",...},...]'
// The corrupt value is gone. Seed data has been written back.
```

---

### Scenario B — Non-array JSON (Vector D, no exception path) — CONFIRMED BY STATIC ANALYSIS

This scenario exercises the `Array.isArray` branch, bypassing the `catch` block entirely:

**Steps:**
```
1. Open DevTools console on the running app
2. Paste and run:
   localStorage.setItem('studywell.tasks.v1', JSON.stringify({wrapped: true, tasks: []}))
   // This is valid JSON — it WON'T throw on JSON.parse — but it IS an object, not an array
3. Refresh the page
```

**Trace through loadTasks():**
```js
const stored = JSON.parse('{"wrapped":true,"tasks":[]}');
// stored = { wrapped: true, tasks: [] }   ← JSON.parse succeeds, no exception
Array.isArray(stored)  // → false
return starterTasks;   // ← silently discards the value and returns seeds
```

**Outcome:** Identical to Scenario A — seed data overwrites storage, no warning.
**Note:** This scenario is particularly insidious because an external tool writing a structured-but-wrong object would leave no exception trail whatsoever.

---

### Scenario C — null stored value (localStorage key missing or explicitly null)

**Steps:**
```
1. DevTools console:
   localStorage.removeItem('studywell.tasks.v1');
2. Refresh the page
```

**Trace through loadTasks():**
```js
localStorage.getItem('studywell.tasks.v1')  // → null  (key doesn't exist)
JSON.parse(null)  // → null  (JSON.parse coerces to string 'null', returns JS null)
Array.isArray(null)  // → false
return starterTasks;
```

**Expected:** This is the intended first-run behaviour — seeds are correct here.
**Observation:** The `null` → `JSON.parse(null)` → `null` path is **not** a parse error and **not** caught by the `try`. It silently falls through the `Array.isArray` guard. This means the `catch` block is only reached by genuinely malformed JSON, not by missing keys.

**This is a design gap in the guard:** `localStorage.getItem` returns `null` when the key is absent, and `JSON.parse(null)` doesn't throw — it returns `null`. The guard works by coincidence (`Array.isArray(null)` is false → seeds), not by explicit null handling.

---

### Scenario D — Quota exceeded truncation (harder to reproduce manually)

**DevTools simulation steps:**
```js
// Fill localStorage with junk until near-quota
const fill = 'x'.repeat(1024 * 1024); // 1 MB string
let i = 0;
try {
  while (true) {
    localStorage.setItem('__fill__' + i, fill);
    i++;
  }
} catch(e) {
  console.log('Quota reached at key', i, e.name);
}
// Now make the storage look like it was truncated mid-write:
localStorage.setItem('studywell.tasks.v1', '[{"id":"task-1","title":"Real User Task","course":"Algebra"');
// ^ truncated — not valid JSON
```

**Outcome after refresh:** Same as Scenario A — `JSON.parse` throws on the truncated string, `catch` returns seeds, `useEffect` overwrites.

> **Note on realistic truncation:** Modern browsers throw `QuotaExceededError` at the `setItem` call rather than partially writing. True truncation is rare on modern engines. The more realistic production risk is Vector B (extension interference) or Vector A (developer/user manual edit).

---

## 5. Request / Response Evidence

This is a frontend-only application with no network layer. There are no HTTP requests, API calls, or server responses involved in this defect. The entire failure occurs within the browser's JavaScript execution context.

**Equivalent trace for a client-server app:**

| Layer | Equivalent | Actual in this app |
|---|---|---|
| Frontend state | `tasks` React state | `useState(loadTasks)` → seeds |
| "API request" | localStorage read | `localStorage.getItem(STORAGE_KEY)` |
| "API response" | Stored value | `'CORRUPTED'` or non-array JSON |
| Error handling | Try/catch | `catch { return starterTasks }` — no re-throw, no log |
| "Database write" | localStorage write | `localStorage.setItem(...)` in `useEffect` |
| User feedback | UI notification | None — silent |

---

## 6. UI Trace: What the User Sees

### Before corruption (normal state):
```
Overview page:
  "Good morning, Alex."
  Tasks to do: 1  (the custom task "My Important Task")
  "Coming up" panel: shows "My Important Task" — Algebra — due tomorrow
```

### After page reload on corrupt storage:
```
Overview page:
  "Good morning, Alex."    ← unchanged (profile is a separate key, unaffected)
  Tasks to do: 5           ← seed count, not 1
  "Coming up" panel: shows seed tasks — "Read chapter 06", "Problem set 04", etc.
  "My Important Task" — GONE, with no indication it ever existed
```

There is no diff indicator, no "Your data was reset" message, no console output. The app appears to be working normally — just with different tasks.

---

## 7. Fault Boundary Analysis

The defect spans two functions that individually appear correct but interact destructively:

```
loadTasks()          useEffect([tasks])
     │                      │
     ▼                      ▼
Reads bad data    →   Writes seed data
Falls back silently   Immediately after mount
     │                      │
     └──────── together ─────┘
               = permanent data loss
```

**Where detection COULD occur (currently does not):**

| Location | What could be added | Would it prevent data loss? |
|---|---|---|
| `loadTasks()` catch block | `console.error('localStorage parse failed:', e)` | No — too late if overwrite follows |
| `loadTasks()` catch block | Return `null` or a sentinel value instead of `starterTasks` | YES — the `useState` and `useEffect` would need to handle the sentinel |
| `useState` initialiser | Check if `loadTasks()` returned seeds vs real data | Partially — could gate the `useEffect` |
| `useEffect` at line 55 | Guard: only write if `tasks !== starterTasks` | YES — prevents overwrite of seeded fallback |
| `useEffect` at line 55 | Wrap in try/catch to handle `QuotaExceededError` | Prevents secondary quota data loss (RISK-012) |
| Top-level `App` | Display a "Data could not be loaded" error banner | Informs user, doesn't prevent loss |

**The smallest safe fix** (to be proposed, not implemented here):
```js
// Option 1 — Guard the useEffect: never write seeds back over a corrupt key
// Requires distinguishing "loaded seeds as fallback" from "loaded real data that happens to equal seeds"

// Option 2 — Return a sentinel from loadTasks() on failure, and treat it differently in the useEffect
// e.g.: return null from catch; in useEffect, don't write if tasks === null

// Option 3 — In loadTasks() catch, preserve the corrupt value by not calling setItem in that session
// Requires a ref or a flag passed out of loadTasks()
```

Human approval required before any of these options are implemented.

---

## 8. Confidence Assessment

| Aspect | Confidence | Basis |
|---|---|---|
| Bug exists | **100%** | Deterministic logic; `catch` → `starterTasks`; `useEffect` overwrites on every mount |
| Overwrites on first render | **100%** | `useEffect([tasks])` fires on mount unconditionally in React 18 |
| User sees no warning | **100%** | No `console.error`, no UI alert, no error boundary anywhere in the file |
| Data is unrecoverable after reload | **100%** | `setItem` with seed data replaces the corrupt value; there is no backup mechanism |
| Vector A (DevTools) reproducible | **100%** | Trivially reproducible in < 60 seconds |
| Vector B (extensions) realistic | **MEDIUM** | Depends on what extensions are installed; cannot be tested without a specific extension |
| Vector C (quota truncation) realistic | **LOW** | Modern browsers throw rather than truncate; scenario is possible but uncommon |
| Vector D (non-array JSON) realistic | **MEDIUM** | Can occur via external write; exercises a separate code path from the `catch` |

---

## 9. Related Risks

| ID | Relationship |
|---|---|
| RISK-012 | Related: `useEffect` `setItem` also has no quota-error handler — a `QuotaExceededError` thrown at line 55 is unhandled |
| RISK-016 | Root enabler: zero test coverage means this defect has no automated regression guard |
| RISK-003 | Interaction: BUG-03 (one-way toggle) means if a user accidentally completes all tasks, they cannot undo — and if storage then corrupts, they lose their tasks AND cannot restore completion state |

---

## 10. Smallest Reproducible Scenario (30-second proof)

Copy and run these three lines in the browser DevTools console while the app is running:

```js
// Step 1: Simulate a user who has real data (replace seeds with custom task)
localStorage.setItem('studywell.tasks.v1', JSON.stringify([
  { id: 'my-real-task', title: 'My Important Exam', course: 'Chemistry', dueDate: '2026-10-01', priority: 'high', completed: false, description: 'Study chapters 4-7' }
]));

// Step 2: Corrupt the storage (simulates extension interference or manual edit)
localStorage.setItem('studywell.tasks.v1', 'NOT_VALID_JSON');

// Step 3: Verify corruption is in place
console.log('Before reload:', localStorage.getItem('studywell.tasks.v1'));
// → "NOT_VALID_JSON"
```

Then press **Cmd+R** (or **Ctrl+R**) to reload.

After reload, run:
```js
// Step 4: Verify data loss
console.log('After reload:', JSON.parse(localStorage.getItem('studywell.tasks.v1')));
// → Array of 6 seed tasks — "My Important Exam" is gone
// → The corrupt value "NOT_VALID_JSON" has been replaced with seed data
```

The task list in the UI also shows the 6 seed tasks instead of "My Important Exam".

---

## 11. Recommended Next Stage

**FOLLOW THE SIGNAL** — Trace the smallest safe fix options:
- Option A: `loadTasks()` returns a sentinel on failure; `useEffect` does not write sentinel state
- Option B: `useEffect` compares `tasks` identity to `starterTasks` before writing (reference equality — fragile)
- Option C: A separate `didCorrupt` ref tracks whether fallback was used, gates the overwrite

Then proceed to **DRAFT THE REPAIR** stage for human approval before any code is changed.

---

*End of Report 03 — REPLAY stage complete for RISK-005. No source files were modified during investigation.*
