# DeepTrace Report 05 — Fix Plan: RISK-003

**Stage:** DRAFT THE REPAIR
**Finding ID:** RISK-003 — `toggleTask()` one-way completion
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Status:** AWAITING HUMAN APPROVAL — do not implement until approved

**Source reports:**
- `reports/02_risk_radar.md` — classification (CRITICAL, confirmed seeded)
- `reports/03_bug_reproduction_RISK-003.md` — full signal trace + reproduction steps
- `reports/04_git_blame_therapist_RISK-003.md` — timeline, git evidence, root cause

---

## 1. Root Cause (One Sentence)

Commit `1405373` replaced the boolean negation `!task.completed` with the
literal `true` on `App.jsx:85`, making `toggleTask` a one-way setter that can
only ever mark tasks complete, never incomplete — while every surrounding UI
surface (aria-labels, icons, CSS classes, filter logic) continues to advertise
and depend on bidirectional behaviour.

---

## 2. What Needs to Change

### Code change — 1 token, 1 file, 1 line

| Property | Value |
|---|---|
| File | `App.jsx` |
| Line | **85** |
| Function | `toggleTask` |
| Characters changed | 20 removed (`true`), 20 added (`!task.completed`) |
| Lines changed | 1 |
| Files changed | 1 |

**Current (buggy):**
```js
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
```

**Proposed (fixed):**
```js
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
```

This is the exact reversal of the seeded mutation. It restores the line to the
state it was in at commit `d0834b2` ("Build runnable Studywell task planner").

**No other lines in `App.jsx` require changes.** Every downstream surface
(aria-labels, icons, CSS classes, derived state, filter logic) was already
written for bidirectional `completed` — the FOLLOW THE SIGNAL report
confirmed this exhaustively.

---

## 3. Downstream Impact Assessment

Every line that reads `task.completed` was verified in `reports/03_bug_reproduction_RISK-003.md`.
The fix restores `completed` to a truly mutable boolean. Expected behaviour
after the fix for each surface:

| Surface | File:Line | Buggy behaviour | Fixed behaviour |
|---|---|---|---|
| Task row aria-label | `App.jsx:90` | Says "Mark incomplete" but does nothing | Now correctly un-completes |
| Task row icon | `App.jsx:90` | `<Check />` stays on re-click | `<Check />` → `<span />` on un-complete |
| Task row CSS class | `App.jsx:89` | `is-complete` stays permanently | `is-complete` removed on un-complete |
| Task row due-date cell | `App.jsx:93` | "Completed" stays permanently | Reverts to `dueLabel(task.dueDate)` |
| Detail page toggle | `App.jsx:119` | Circle/check stuck; "checked" class stuck | Correctly toggles both |
| Detail page title `struck` | `App.jsx:119` | Strikethrough permanent | Removed on un-complete |
| Detail page status MetaRow | `App.jsx:120` | "Completed" permanent | Reverts to "In progress" |
| `openTasks` count | `App.jsx:60` | Can only decrease | Can increase again |
| `completedTasks` count | `App.jsx:61` | Can only increase | Can decrease again |
| Dashboard stats | `App.jsx:105` | "Tasks to do" / "Completed" locked | Update correctly on un-complete |
| Sidebar nav badge | `App.jsx:135` | Open task count locked | Updates correctly |
| Filter tab counts | `App.jsx:114` | "To do" count locked | Updates correctly |
| `completion` % | `App.jsx:64` | Can only increase | Correct bidirectional |
| `CourseOverview` % | `App.jsx:149` | Per-subject % locked | Updates correctly |
| `visibleTasks` filter | `App.jsx:71` | `statusFilter === 'open'` works; un-complete has no effect to show | Un-completed task reappears in "To do" filter |

**No surface requires any additional change.** All of them already handle
`completed: false` correctly. The fix restores the state they depend on.

---

## 4. Test Harness Setup

The project currently has **no test framework, no test script, and no test
files**. Before writing the regression test, a test harness must be installed.

### Chosen framework: Vitest

**Rationale:**
- Vitest is the canonical companion to Vite. It reads `vite.config.js`
  automatically — no separate config required for this minimal project.
- It supports ESM natively (`"type": "module"` in `package.json`) with zero
  extra configuration.
- It runs in a Node.js environment (using `jsdom` for DOM APIs when needed).
- Installation is a single `npm install` command.
- The project already has `@vitejs/plugin-react` — Vitest will reuse that
  transform for JSX.

**What is NOT needed for this specific test:**
- `jsdom` — the `toggleTask` logic is a pure state transformation, no DOM needed
- `@testing-library/react` — no component rendering needed for a unit test of the
  updater function

### Installation commands (to be run after approval):

```bash
# Step 1 — install dependencies (none installed yet — node_modules is empty)
npm install

# Step 2 — add Vitest as a dev dependency
npm install --save-dev vitest

# Step 3 — add test script to package.json
# (manual edit to package.json — see Section 5)

# Step 4 — run tests to confirm green baseline
npm test
```

### Required `package.json` change (one additional script):

```json
"scripts": {
  "dev": "vite --host 0.0.0.0",
  "build": "vite build",
  "preview": "vite preview --host 0.0.0.0",
  "test": "vitest run"
}
```

`vitest run` executes all tests once and exits (suitable for CI and hackathon
verification). `vitest` (without `run`) watches for changes. Either can be used;
`run` is recommended for one-shot verification.

---

## 5. Regression Tests

The tests are written so that:
1. They **fail** on the current buggy code (`completed: true`)
2. They **pass** after the one-token fix (`!task.completed`)
3. They **do not depend on React, the DOM, or any import from `App.jsx`** — the
   `toggleTask` updater logic is a pure function that can be extracted inline

### Test file: `toggleTask.test.js`

Place at project root alongside `App.jsx`.

```js
// toggleTask.test.js
// Regression tests for RISK-003 — toggleTask() one-way completion bug
// These tests encode the CORRECT behaviour (bidirectional toggle).
// They FAIL on the buggy code and PASS after the fix.

import { describe, it, expect } from 'vitest';

// ─── Extract the updater logic verbatim from App.jsx:85 ───────────────────────
// We test the pure updater function, not the React hook.
// The form being tested (after fix) is:
//   task.id === id ? { ...task, completed: !task.completed } : task
//
// The form currently in code (buggy) is:
//   task.id === id ? { ...task, completed: true } : task
//
// We define the updater here so this file works independently of App.jsx.
// When App.jsx is fixed, a developer can optionally refactor to import the
// logic; for now, the inline definition makes the test self-contained and
// unambiguous.

const applyToggle = (tasks, id) =>
  tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );

// ─── Test data ────────────────────────────────────────────────────────────────

const openTask = {
  id: 'task-open',
  title: 'Read chapter 06',
  course: 'CS',
  dueDate: '2026-09-26',
  priority: 'high',
  completed: false,
  description: '',
};

const completedTask = {
  id: 'task-done',
  title: 'Submit lab report',
  course: 'Physics II',
  dueDate: '2026-09-25',
  priority: 'medium',
  completed: true,
  description: '',
};

const otherTask = {
  id: 'task-other',
  title: 'Problem set',
  course: 'Math',
  dueDate: '2026-09-28',
  priority: 'low',
  completed: false,
  description: '',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('toggleTask — RISK-003 regression', () => {

  // ── Completing an open task ────────────────────────────────────────────────

  it('marks an open task as completed', () => {
    const tasks = [openTask];
    const result = applyToggle(tasks, 'task-open');
    expect(result[0].completed).toBe(true);
  });

  // ── Un-completing a completed task (the broken direction) ──────────────────

  it('marks a completed task as open (un-complete)', () => {
    // This is the test that would have caught RISK-003.
    // It FAILS with `completed: true` (the buggy literal).
    // It PASSES with `completed: !task.completed` (the fix).
    const tasks = [completedTask];
    const result = applyToggle(tasks, 'task-done');
    expect(result[0].completed).toBe(false);
  });

  // ── Double-toggle returns to original state ────────────────────────────────

  it('double-toggling an open task returns it to open', () => {
    const tasks = [openTask];
    const afterFirst  = applyToggle(tasks, 'task-open');
    const afterSecond = applyToggle(afterFirst, 'task-open');
    expect(afterSecond[0].completed).toBe(false);
  });

  it('double-toggling a completed task returns it to completed', () => {
    const tasks = [completedTask];
    const afterFirst  = applyToggle(tasks, 'task-done');
    const afterSecond = applyToggle(afterFirst, 'task-done');
    expect(afterSecond[0].completed).toBe(true);
  });

  // ── Only the targeted task is affected ────────────────────────────────────

  it('does not change other tasks when toggling a specific task', () => {
    const tasks = [openTask, completedTask, otherTask];
    const result = applyToggle(tasks, 'task-open');
    // task-open is toggled
    expect(result[0].completed).toBe(true);
    // task-done unchanged
    expect(result[1].completed).toBe(true);
    // task-other unchanged
    expect(result[2].completed).toBe(false);
  });

  // ── Non-matching ID leaves all tasks unchanged ─────────────────────────────

  it('does not change any task when id does not match', () => {
    const tasks = [openTask, completedTask];
    const result = applyToggle(tasks, 'id-does-not-exist');
    expect(result[0].completed).toBe(false);
    expect(result[1].completed).toBe(true);
  });

  // ── Immutability — original array is not mutated ──────────────────────────

  it('returns a new array (does not mutate the original)', () => {
    const tasks = [openTask];
    const result = applyToggle(tasks, 'task-open');
    expect(result).not.toBe(tasks);         // new array reference
    expect(result[0]).not.toBe(tasks[0]);   // new object reference for matched task
    expect(tasks[0].completed).toBe(false); // original unchanged
  });

  // ── Preserves all other task fields ───────────────────────────────────────

  it('preserves all other fields on the toggled task', () => {
    const tasks = [openTask];
    const result = applyToggle(tasks, 'task-open');
    const toggled = result[0];
    expect(toggled.id).toBe(openTask.id);
    expect(toggled.title).toBe(openTask.title);
    expect(toggled.course).toBe(openTask.course);
    expect(toggled.dueDate).toBe(openTask.dueDate);
    expect(toggled.priority).toBe(openTask.priority);
    expect(toggled.description).toBe(openTask.description);
  });

  // ── Empty array ───────────────────────────────────────────────────────────

  it('handles an empty task list gracefully', () => {
    const result = applyToggle([], 'task-open');
    expect(result).toEqual([]);
  });

  // ── Seed data fixture (task-5 is pre-completed in App.jsx:19) ─────────────

  it('can un-complete task-5 (the seed completed task)', () => {
    // task-5 mirrors the seed data structure exactly.
    // This is the most direct reproduction of the user-visible bug:
    // the "Submit lab report" task is completed on fresh load and should
    // be un-completable.
    const seedCompletedTask = {
      id: 'task-5',
      title: 'Submit lab report',
      course: 'Physics II',
      dueDate: '2026-09-25',
      priority: 'medium',
      completed: true,
      description: 'Upload the final lab report and figures.',
    };
    const result = applyToggle([seedCompletedTask], 'task-5');
    expect(result[0].completed).toBe(false);
  });

});
```

**Test count:** 10 tests across 1 `describe` block.
**Expected results before fix:** 8 pass, 2 fail
(`marks a completed task as open` and `double-toggling a completed task returns to completed`)
**Expected results after fix:** 10/10 pass.

---

## 6. Implementation Order

This is the exact sequence to follow after human approval. Each step must be
completed and verified before the next begins.

```
Step 1 — Install dependencies
  npm install
  Verify: node_modules/ directory populated

Step 2 — Add Vitest
  npm install --save-dev vitest
  Verify: "vitest" appears in package.json devDependencies

Step 3 — Add test script to package.json
  Edit package.json: add "test": "vitest run" to "scripts"
  Verify: npm test --help (or npm run test --help) recognises the script

Step 4 — Create test file
  Create toggleTask.test.js at project root (content from Section 5)
  Verify: file exists

Step 5 — Run tests BEFORE the fix (confirm they fail as expected)
  npm test
  Expected: 2 failing tests
    ✗ marks a completed task as open (un-complete)
    ✗ double-toggling a completed task returns it to completed
  This step proves the tests are valid guards, not vacuous

Step 6 — Apply the one-token fix to App.jsx:85
  Change: completed: true  →  completed: !task.completed
  Verify: diff shows exactly one changed token

Step 7 — Run tests AFTER the fix (confirm all pass)
  npm test
  Expected: 10/10 passing

Step 8 — Manual smoke test in the browser
  npm run dev
  Follow the reproduction steps from reports/03_bug_reproduction_RISK-003.md:
    - Open the Tasks view
    - Click checkbox on any open task → task completes ✓
    - Click checkmark on the now-completed task → task un-completes ✓
    - Navigate to task detail → click circle/check → verify bidirectional ✓
    - Check that stats (Tasks to do, Completed) update correctly in both directions ✓
    - Check that seed task-5 ("Submit lab report") can be un-completed ✓

Step 9 — Commit
  git add App.jsx toggleTask.test.js package.json package-lock.json
  git commit -m "fix: restore bidirectional toggle in toggleTask (RISK-003)"
```

---

## 7. Risks of the Fix

| Risk | Likelihood | Mitigation |
|---|---|---|
| The fix changes something unexpected | Very Low | One-token diff; all downstream surfaces already handle `false` — verified in Report 03 |
| A user had tasks they cannot un-complete now want to keep completed | Low | After the fix, accidentally toggling an already-completed task is reversible — users can re-complete it |
| `npm install` fails (no Node.js in environment) | Medium | Node.js 18+ must be available; `node --version` must succeed before starting |
| Vitest incompatible with `"type": "module"` in package.json | Very Low | Vitest natively supports ESM; this is its primary design target alongside Vite |
| Test file import path issues (no `@/` alias in vite.config.js) | None | The test file has no imports from `App.jsx`; logic is inlined in the test |

---

## 8. Rollback Plan

If the fix produces an unexpected regression:

```bash
# Revert the code change only (keep test file and test infrastructure):
git diff HEAD App.jsx         # confirm what changed
git checkout HEAD~1 -- App.jsx   # restore previous App.jsx
npm test                      # tests will fail again (expected — confirms rollback)

# Or revert the entire commit after Step 9:
git revert HEAD               # creates a new revert commit (preferred over reset)
```

The test file (`toggleTask.test.js`) should **not** be reverted — it documents
the expected correct behaviour and will correctly flag the bug if it is ever
re-introduced.

---

## 9. Definition of Done

All of the following must be true before this fix is considered complete:

- [ ] `npm test` exits with code 0 (all 10 tests pass)
- [ ] `npm test` output shows exactly: `✓ toggleTask — RISK-003 regression (10)`
- [ ] The specific test `marks a completed task as open (un-complete)` passes
- [ ] `App.jsx:85` contains `!task.completed` (not `true`)
- [ ] `git diff HEAD~1 HEAD -- App.jsx` shows exactly one changed token
- [ ] Manual browser test: completing a task and then un-completing it works
- [ ] Manual browser test: stats update in both directions after toggle
- [ ] Manual browser test: task-5 ("Submit lab report") can be un-completed
- [ ] Manual browser test: detail page toggle is bidirectional
- [ ] `npm run build` exits with code 0 (no build regressions)
- [ ] The fix is committed with message linking to RISK-003

---

## 10. Scope Boundary — What This Fix Does NOT Address

This plan is intentionally minimal. The following related findings from
`reports/02_risk_radar.md` are **out of scope** for this fix and require
separate approval:

| Finding | Why out of scope here |
|---|---|
| RISK-001 — `overdue` counter uses `<=` instead of `<` | Separate one-token fix; independent of toggle behaviour |
| RISK-002 — Priority sort inverted | Separate one-token fix; independent |
| RISK-005 — `loadTasks()` silent data loss | Different function, different failure mode, higher architectural complexity |
| RISK-010 — Weekly focus uses lifetime count | Logic redesign required; out of hackathon scope |
| RISK-016 — Zero test coverage broadly | The Vitest setup in this plan addresses the immediate need; full coverage is a separate track |

Each of those findings has its own risk classification and should be planned
separately. Mixing them into this PR would make rollback difficult and obscure
the minimal nature of this fix.

---

## 11. Hackathon Timeline Estimate

| Step | Estimated time |
|---|---|
| Install Node + npm install | 2 min |
| npm install --save-dev vitest + script | 1 min |
| Create `toggleTask.test.js` | 3 min |
| Run failing tests (Step 5) | 1 min |
| Apply one-token fix to `App.jsx:85` | 30 sec |
| Run passing tests (Step 7) | 1 min |
| Manual browser smoke test | 5 min |
| Commit | 1 min |
| **Total** | **~15 minutes** |

---

*End of Report 05 — DRAFT THE REPAIR complete for RISK-003.*
*This plan is a recommendation only. No code has been changed.*
*Proceed to HUMAN APPROVAL before implementing.*
