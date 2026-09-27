# DeepTrace Report 03 — Bug Reproduction + Signal Trace: RISK-003

**Stage:** FOLLOW THE SIGNAL (read-only investigation)
**Finding ID:** RISK-003
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Prior reports:** `reports/01_repository_map.md`, `reports/02_risk_radar.md`

---

## Summary

`toggleTask()` at `App.jsx:85` was mutated in commit `1405373` to always set
`completed: true` instead of toggling `!task.completed`. Every UI surface that
calls this function — the task-row checkbox, the detail-page circle button — can
only move a task from open → complete. The reverse direction (complete → open) is
silently absorbed: the state updater runs, produces the same value, React re-renders
with no visible change, and the user receives no feedback that their action failed.
The accessibility label, visual icon, and CSS class all correctly advertise
un-completion as available — none of them are aware of the bug.

**Status:** ✅ CONFIRMED SEEDED — introduced by exact one-character diff in commit `1405373`
**Confidence:** 100% — deterministic; no runtime uncertainty
**Severity:** CRITICAL

---

## 1. Git Evidence — Exact Change

```diff
# commit 1405373  "Seed intentional bugs for hackathon AI testing"
# File: App.jsx  Line 85

- const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
+ const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
```

**The mutation:** `!task.completed` → `true`.
One operand removed. Boolean negation replaced with boolean literal.

---

## 2. Hop-by-Hop Signal Trace

This application has no API, no backend, and no database. The full signal path
is: **UI event → React event handler → state updater → React re-render →
derived state → UI output → localStorage write**. Each hop is traced for both
the working path and the broken path.

---

### HOP 1 — User gesture: checkbox click

**Surface A — Task list row** (`App.jsx:90`, `renderTaskRow`)

```jsx
<button
  className="task-check"
  aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
  onClick={() => toggleTask(task.id)}
>
  {task.completed ? <Check size={15} strokeWidth={2.5} /> : <span />}
</button>
```

| Property | Open task | Completed task |
|---|---|---|
| `aria-label` | `"Complete <title>"` | `"Mark <title> incomplete"` |
| icon rendered | empty `<span>` | `<Check />` (checkmark) |
| `onClick` target | `toggleTask(task.id)` | `toggleTask(task.id)` — **same function** |

**Surface B — Task detail page** (`App.jsx:119`, `renderDetail`)

```jsx
<button
  className={`detail-check${selectedTask.completed ? ' checked' : ''}`}
  aria-label="Toggle task completion"
  onClick={() => toggleTask(selectedTask.id)}
>
  {selectedTask.completed ? <Check size={19} /> : <Circle size={21} />}
</button>
```

| Property | Open task | Completed task |
|---|---|---|
| `className` | `"detail-check"` | `"detail-check checked"` |
| `aria-label` | `"Toggle task completion"` | `"Toggle task completion"` |
| icon rendered | `<Circle />` (hollow) | `<Check />` (filled) |
| `onClick` target | `toggleTask(selectedTask.id)` | `toggleTask(selectedTask.id)` — **same function** |

Both call sites pass the task `id` string to `toggleTask`. Neither surface has
any awareness of the bug; both surfaces correctly advertise bidirectional toggle
behaviour.

---

### HOP 2 — Event handler: `toggleTask(id)`

**File:** `App.jsx:85`
**Function:** `toggleTask`

```js
// BUGGY (HEAD):
const toggleTask = (id) =>
  setTasks((current) =>
    current.map((task) =>
      task.id === id ? { ...task, completed: true } : task
    )
  );

// CORRECT (HEAD~1):
const toggleTask = (id) =>
  setTasks((current) =>
    current.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    )
  );
```

**Data flowing in:** `id` — the UUID or seed-ID string of the clicked task.

**What the function does (buggy):**
1. Calls `setTasks` with a functional updater (receives current state snapshot — correct, race-safe pattern)
2. Maps over the entire task array
3. For the matching task: spreads all existing fields, then **unconditionally sets `completed: true`**
4. Returns the mapped array as the new state

**Divergence boundary — exact location:**

```
task.completed = false  →  toggleTask called  →  { ...task, completed: true }   ✓ open→complete (works)
task.completed = true   →  toggleTask called  →  { ...task, completed: true }   ✗ complete→open (no-op)
                                                                    ↑
                                              THIS IS THE FAULT BOUNDARY
                                              completed: true is written onto an already-true value.
                                              The output state is identical to the input state.
```

React's `setTasks` receives the same `completed: true` it already had. React
performs a shallow-equality check on the task object, but because `{ ...task, completed: true }`
always creates a **new object reference** (spread always allocates), React cannot
short-circuit — it will re-render. However, since every field value is identical,
the rendered output is also identical. The UI does not change.

---

### HOP 3 — React state update

**`useState` / `setTasks` behaviour in React 18:**

React 18 with `createRoot` (used at `main.jsx:6`) batches state updates by default.
`toggleTask` calls `setTasks` with a functional updater. React:

1. Enqueues the updater
2. Schedules a re-render (even if the result will be identical — React does not
   peek inside the updater before running it)
3. Runs the updater: `current.map(...)` produces a **new array** (`.map` always
   allocates), but every element is either the same reference (unmatched tasks)
   or a new object with the same field values (the matched task with `true` → `true`)

**`Object.is` comparison:** React uses `Object.is` on the state value for bail-out
optimisation. The new array returned by `.map` is a different reference than the
previous array, so React will **not** bail out. A re-render is triggered even on
the no-op path.

**State before and after (un-complete attempt — the broken path):**

```
Before:
  tasks = [
    { id: 'task-5', title: 'Submit lab report', completed: true, ... },
    ...other tasks...
  ]

setTasks updater runs:
  current.map(task =>
    task.id === 'task-5'
      ? { ...task, completed: true }   // completed was already true — same value
      : task
  )

After:
  tasks = [
    { id: 'task-5', title: 'Submit lab report', completed: true, ... },  // unchanged values
    ...other tasks...
  ]
```

The array reference changed (`.map` returns new array). Every object reference
changed for the matched task (spread returns new object). **All field values
are identical.**

---

### HOP 4 — Derived state recalculation (synchronous with render)

After `setTasks`, App re-renders. Every derived value recalculates from the new
`tasks` array:

| Derived value | Expression | Result on no-op path |
|---|---|---|
| `openTasks` | `tasks.filter(t => !t.completed)` | **unchanged** — same set of open tasks |
| `completedTasks` | `tasks.filter(t => t.completed)` | **unchanged** — same completed set |
| `dueToday` | `openTasks.filter(...)` | **unchanged** |
| `overdue` | `openTasks.filter(...)` | **unchanged** |
| `completion` | `Math.round(completed/total * 100)` | **unchanged** |
| `visibleTasks` | `useMemo(...)` — deps: `[tasks, ...]` | **recalculated** (tasks reference changed), but same elements |

The `useMemo` for `visibleTasks` at line 67 will re-run because `tasks` is in
its dependency array and its reference changed. However, the output is the same
task array with the same `completed: true` value for task-5 — no functional change.

---

### HOP 5 — Re-render: UI output

After the re-render, every UI surface that consumes `completed` re-evaluates
with the same value. **The UI is visually identical to before the click.**

#### Surface-by-surface output comparison (un-complete attempt):

**Task row checkbox** (`App.jsx:89–90`):
```
Before click:  task.completed = true
  className: "task-row is-complete"
  aria-label: "Mark Submit lab report incomplete"   ← lying: says it will un-complete
  icon: <Check />                                   ← checkmark shown

After click:   task.completed = true   (unchanged)
  className: "task-row is-complete"                 ← same
  aria-label: "Mark Submit lab report incomplete"   ← still lying
  icon: <Check />                                   ← still checkmark
```

**Due date cell** (`App.jsx:93`):
```
  task.completed ? 'Completed' : dueLabel(task.dueDate)
  → 'Completed'   (unchanged — completed is still true)
```

**Detail page toggle button** (`App.jsx:119`):
```
Before: className="detail-check checked", icon=<Check />, aria-label="Toggle task completion"
After:  className="detail-check checked", icon=<Check />, aria-label="Toggle task completion"
  No change.
```

**Detail page title** (`App.jsx:119`):
```
<h1 className={selectedTask.completed ? 'struck' : ''}>
  → className="struck"   (strikethrough — unchanged)
```

**Detail page status MetaRow** (`App.jsx:120`):
```
value={selectedTask.completed ? 'Completed' : 'In progress'}
→ 'Completed'   (unchanged)
```

**Stat cards — "Tasks to do"** (`App.jsx:105`):
```
value={openTasks.length}   → same number (task-5 was already completed)
```

**Stat cards — "Completed"** (`App.jsx:105`):
```
value={completedTasks.length}   → same number
```

**Sidebar nav badge** (`App.jsx:135`):
```
count={openTasks.length}   → same number
```

**Sidebar week card** (`App.jsx:136`):
```
{completedTasks.length}   → same number
```

**Filter tabs** (`App.jsx:114`):
```
"Completed" tab count = completedTasks.length   → same
"To do" tab count = openTasks.length            → same
```

**Tasks page heading** (`App.jsx:113`):
```
`${openTasks.length} open tasks · ${completedTasks.length} completed`   → same
```

**Insights page** (`App.jsx:125`):
```
completion %, completedTasks.length / tasks.length   → same
```

**CourseOverview** (`App.jsx:149`):
```
const done = group.filter(t => t.completed).length;
const percent = Math.round(done / group.length * 100);
→ same values (task-5 was already counted as done)
```

**No UI surface changes.** The entire application renders identically before and
after the un-complete click. There is no error state, no toast, no visual flicker.
From the user's perspective, the click did nothing.

---

### HOP 6 — localStorage write

**File:** `App.jsx:55`

```js
useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);
```

Because `tasks` is a new array reference (`.map` always allocates), this effect
fires after every `toggleTask` call — including the no-op un-complete attempt.

```
Write on complete (open → complete):
  Before: [..., { id: 'task-X', completed: false, ... }, ...]
  After:  [..., { id: 'task-X', completed: true,  ... }, ...]
  → localStorage updated with new completed state  ✓

Write on un-complete attempt (complete → complete, no-op):
  Before: [..., { id: 'task-X', completed: true, ... }, ...]
  After:  [..., { id: 'task-X', completed: true, ... }, ...]
  → localStorage updated with identical content
  → The corrupt state (cannot un-complete) is persisted to disk
  → On next page reload, the task is still completed, still stuck
```

The localStorage write on the no-op path is not itself harmful — it writes the
same data that was already there. But it confirms that the stuck state survives
page reload: the task is permanently completed.

---

### HOP 7 — Response: what the user observes

| User action | Expected response | Actual response |
|---|---|---|
| Click checkbox on **open** task | Task moves to completed: checkmark appears, row style changes, stats update | ✅ **Works correctly** — open → complete |
| Click checkbox on **completed** task (list view) | Task moves back to open: checkmark disappears, row reverts, stats update | ❌ **Silent no-op** — nothing changes |
| Click circle/check on **completed** task (detail view) | Task status changes to "In progress", title loses strikethrough | ❌ **Silent no-op** — nothing changes |
| Aria-label "Mark X incomplete" suggests reversibility | Screen reader announces the button as "Mark X incomplete" | ❌ **Accessibility lie** — the announced action cannot be performed |

---

## 3. Divergence Boundary — Exact Location

```
App.jsx line 85:

const toggleTask = (id) =>
  setTasks((current) =>
    current.map((task) =>
      task.id === id
        ? { ...task, completed: true }     ← FAULT: always true
                              ↑
                    DIVERGENCE BOUNDARY
                    For open tasks:   false → true  (correct)
                    For done tasks:   true  → true  (should be false, is true)
        : task
    )
  );
```

The boundary is the literal `true` inside the ternary on `App.jsx:85`. Every
observable downstream effect (derived state, re-renders, localStorage,
UI output) is correct and consistent — they all faithfully reflect a state in
which `completed` is `true`. The bug is entirely localised to this one value.

---

## 4. Downstream Consistency Analysis

A secondary effect of the one-way toggle is that several UI surfaces make
**truthful but misleading** statements once a task is permanently stuck:

| Surface | File:Line | State shown | Problem |
|---|---|---|---|
| `aria-label` on task-check button | `App.jsx:90` | `"Mark <title> incomplete"` | Labels the action as available when it is not |
| `detail-check` button icon | `App.jsx:119` | `<Check />` (filled) | Visually implies clickable toggle |
| `detail-check` aria-label | `App.jsx:119` | `"Toggle task completion"` | Generic toggle label — does not warn of one-directionality |
| `h1` className | `App.jsx:119` | `"struck"` (line-through) | CSS correctly reflects state — not a lie, but reinforces permanence |
| Status MetaRow | `App.jsx:120` | `"Completed"` | Factually correct — but no way to change it |
| `task-due` text | `App.jsx:93` | `"Completed"` | Same — factually correct, but immutable |

The only surfaces that actively mislead are the two `aria-label` values: they
promise an action they cannot deliver. Screen-reader users are more affected
than mouse users, because mouse users at least see the visual no-op and may
deduce that something is wrong; a screen-reader user hears "Mark incomplete",
activates the button, hears no state announcement change, and has no indication
that the action failed.

---

## 5. Edit-via-Modal Analysis (separate path — does it bypass the bug?)

The `TaskEditor` form at `App.jsx:158–167` saves via `saveTask()`. Its submit
handler at line 165:

```js
onSave({
  title: title.trim(), course: course.trim(), dueDate, priority,
  description: description.trim(),
  completed: task?.completed || false
});
```

`saveTask` at line 80–84:
```js
const saveTask = (draft) => {
  if (modal?.task) setTasks((current) =>
    current.map((task) => task.id === modal.task.id ? { ...task, ...draft } : task)
  );
  ...
};
```

When editing a completed task via the modal, `draft.completed = task?.completed || false`.
For a completed task: `true || false = true`. The edit path saves `completed: true`.
**There is no checkbox or toggle in `TaskEditor` for the `completed` field** —
a user opening the edit modal on a completed task has no UI control to un-complete
it. The edit form does not expose `completed` as an editable field.

**Therefore:** There is no alternative code path that allows un-completion.
`toggleTask` is the only mechanism, and it is broken.

---

## 6. Reproduction Steps (30 seconds)

### Scenario A — Task list view

```
1. Open http://localhost:5173 (npm run dev)
2. Observe the task list on the Overview or Tasks page.
   If seed data is present: "Submit lab report" (Physics II) is already completed —
   it has a checkmark and "Completed" label. Observe it.
3. Click the checkmark button on "Submit lab report".
Expected: checkmark disappears, row reverts to open state, "Tasks to do" count increases.
Actual:   nothing changes. The row stays completed. Stats stay the same.
```

### Scenario B — Newly completed task (shows one-directionality clearly)

```
1. Open the Tasks view.
2. Click the checkbox on any open task (e.g. "Read chapter 06: Data structures").
   → The task moves to completed. Checkmark appears. Stats update. ✓
3. Click the checkmark again on the same task to un-complete it.
Expected: task reverts to open state.
Actual:   nothing changes. The task remains completed, permanently.
```

### Scenario C — Detail page

```
1. Click on any open task to navigate to its detail view (#/task/<id>).
2. Click the hollow circle button next to the title.
   → Task moves to completed. Circle becomes filled check. Title gets strikethrough. ✓
3. Click the filled check button again.
Expected: task reverts to open. Check becomes circle. Strikethrough removed.
Actual:   nothing changes.
```

### Verification via DevTools console

```js
// After making any task completed, run:
const tasks = JSON.parse(localStorage.getItem('studywell.tasks.v1'));
const completedTask = tasks.find(t => t.completed);
console.log('completed:', completedTask?.completed);  // → true

// Now click the checkmark in the UI to attempt un-completion, then re-run:
const tasks2 = JSON.parse(localStorage.getItem('studywell.tasks.v1'));
const sameTask = tasks2.find(t => t.id === completedTask.id);
console.log('still completed:', sameTask?.completed);  // → true  (unchanged)
```

---

## 7. Fault Boundary Summary

```
UI (checkbox / circle button)
  │
  ▼  onClick fires
HOP 1: toggleTask(id) called   — App.jsx:85
  │
  ▼  setTasks functional updater runs
HOP 2: .map() evaluates each task
  │
  │  For task.id === id:
  │
  │  [task.completed = false]              [task.completed = true]
  │        │                                       │
  │        ▼                                       ▼
  │  { ...task, completed: true }    { ...task, completed: true }
  │        │                                       │
  │  new value: true  ✓              ┌─── new value: true  ✗
  │  state changes                   │    state unchanged
  │                                  │
  │                           ◄──────┘
  │                     DIVERGENCE BOUNDARY — App.jsx:85
  │                     `true` literal absorbs the un-complete intent
  ▼
HOP 3: React re-render (reference changed even on no-op)
HOP 4: All derived state recalculates — same values
HOP 5: All UI surfaces re-render — identical output
HOP 6: localStorage write — same JSON as before
HOP 7: User sees no change — silent failure
```

---

## 8. Smallest Safe Fix

To be implemented **only after human approval**:

```js
// App.jsx:85 — change one token
// From:
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
// To:
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
```

This is the exact reversal of the seeded mutation. It restores the original boolean
negation. No other lines require changes. All downstream surfaces already correctly
handle both `true` and `false` states — the rendering logic for open and completed
states is intact; only the toggle function is broken.

**Regression test needed** (before applying the fix):
```js
// Vitest — to be written:
// Given a completed task, toggleTask should set completed to false.
// Given an open task, toggleTask should set completed to true.
```

---

## 9. Related Findings

| ID | Relationship |
|---|---|
| RISK-001 | The `overdue` counter uses the same seeded commit — both bugs exist simultaneously. A completed task is not counted as overdue (correct), but if accidentally completed (due to BUG-03), it cannot be restored to open/overdue state. |
| RISK-016 | No tests exist for `toggleTask`. The correct behaviour (`!task.completed`) had no automated guard, which is why the mutation was trivially introducible. |
| RISK-010 | "Weekly focus" widget counts all-time completions. BUG-03 makes the count non-decreasing — once tasks are completed they can never be un-completed, so `completedTasks.length` is permanently inflated. |

---

*End of Report 03 — FOLLOW THE SIGNAL complete for RISK-003. No source files were modified.*
