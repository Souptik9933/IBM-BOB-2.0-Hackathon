# DeepTrace Report 04 — Timeline Dive / Git Blame Therapist: RISK-003

**Stage:** TIMELINE DIVE (read-only investigation)
**Finding ID:** RISK-003 — `toggleTask()` one-way completion
**Date:** 2026-09-26
**Analyst:** DeepTrace
**Prior reports:**
- `reports/01_repository_map.md` — architecture
- `reports/02_risk_radar.md` — risk classification
- `reports/03_bug_reproduction_RISK-003.md` — signal trace

> *This report is blameless. It documents conditions, not culpability.
> Every observation is grounded in git and code evidence.*

---

## 1. Complete Repository Timeline

The entire commit history of this repository fits on a single day (plus one 2-day-earlier seed):

```
2026-09-24 18:03  fb86715  Initial commit              — README.md only
2026-09-26 10:51  99cbedb  Create Dashboard component  — Dashboard.jsx (Base44 reference)
2026-09-26 10:52  dae6f40  Implement Forgot Password   — forpass.jsx   (Base44 reference)
2026-09-26 10:53  ec08e46  Add login component         — login.jsx     (Base44 reference)
2026-09-26 10:54  991ed9d  Create OAuthConsent.jsx     — OAuthConsent.jsx (Base44 reference)
2026-09-26 10:54  022f974  Create register.jsx         — register.jsx  (Base44 reference)
2026-09-26 10:55  d0f69f1  Add ResetPassword           — Resetpass.jsx (Base44 reference)
2026-09-26 10:56  268610f  Add TaskDetail component    — taskdetail.jsx (Base44 reference)
2026-09-26 10:57  7ae2af2  Add Tasks component         — Tasks.jsx     (Base44 reference)
                                                          ↑ 31 min gap ↑
2026-09-26 11:28  d0834b2  Build runnable Studywell    — App.jsx BORN  ← toggleTask() born
                                                          ↑ 4 min gap  ↑
2026-09-26 11:32  1405373  Seed intentional bugs       — App.jsx MUTATED ← toggleTask() broken
```

**Total elapsed time from app birth to mutation: 4 minutes.**
**Total elapsed time from initial commit to mutation: ~90 minutes.**
**Number of authors: 1** (Souptik Purkait, single contributor).
**Number of branches: 2** (`main` and `agent-lead` in the subdirectory repo; root repo has `main` only).

---

## 2. Phase 1 — The Base44 Reference Era (10:51–10:57)

**Commits:** `99cbedb` → `7ae2af2` (7 commits, 6 minutes)

Before `App.jsx` existed, the repository received 7 JSX files that represent a
previous, fully-featured Base44 platform application. These files are the
historical record of the app's intended design.

### What the Base44 era reveals about `toggleTask`'s intended behaviour

The Base44 `taskdetail.jsx` (`268610f`) contains:

```jsx
// taskdetail.jsx — line 19 (Base44 era, commit 268610f)
import TaskCheckbox from '@/components/tasks/TaskCheckbox';

// line 50:
<TaskCheckbox task={task} size="lg" />
```

`TaskCheckbox` is a dedicated component imported from `@/components/tasks/TaskCheckbox`.
Its implementation does not exist in this repository (the `@/` module tree was
never committed), but its name and usage reveal two assumptions:

1. **Toggle was always bidirectional** in the original design. A component called
   `TaskCheckbox` (not `CompleteButton` or `MarkDoneButton`) implies it manages
   a boolean field that can go both directions — checking and unchecking.

2. **Toggle logic lived in a custom hook or mutation**, not inline. `Tasks.jsx`
   (`7ae2af2`) uses `useTasks` and `useTaskDialogs` hooks. The completion toggle
   would have been encapsulated in `useTasks` — a hook that, by implication,
   called an API to persist the toggle. The Base44 design had a full backend; the
   mutation was server-side and authoritative.

**Key observation:** In the original design, completion toggling was a **remote
mutation** — it called a backend API and the server decided the new `completed`
state. There was no equivalent of `!task.completed` in the front-end; that
computation happened server-side. The front-end's `TaskCheckbox` simply fired
the action and let the server respond.

---

## 3. Phase 2 — App Birth: The `toggleTask` Function is Created (d0834b2, 11:28)

**Commit:** `d0834b21` — "Build runnable Studywell task planner"
**Files changed:** `.gitignore`, `App.jsx`, `README.md`, `index.html`, `main.jsx`,
`package-lock.json`, `package.json`, `styles.css`, `vite.config.js`

This is the commit in which the entire runnable application was created in one
shot. `App.jsx` (169 lines) was introduced as a complete, new file — all 169 lines
are additions (`+`).

### `toggleTask` as born:

```js
// d0834b2 — App.jsx line 85 (the CORRECT version)
const toggleTask = (id) =>
  setTasks((current) =>
    current.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    )
  );
```

**Original intent (from code evidence):**

The function was written with `!task.completed` — a deliberate boolean negation.
The surrounding context provides evidence of the author's intent:

1. **The `aria-label` on the task-check button** (also born in this commit, line 90):
   ```jsx
   aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
   ```
   This label explicitly handles both directions. The author anticipated users
   un-completing tasks and wrote accessible labels for that action.

2. **The `detail-check` button** (line 119):
   ```jsx
   aria-label="Toggle task completion"
   ```
   The word "Toggle" (not "Complete") confirms bidirectional intent.

3. **The visual states in `renderDetail`** (line 119):
   ```jsx
   {selectedTask.completed ? <Check size={19} /> : <Circle size={21} />}
   ```
   Both icons (hollow circle for open, filled check for done) suggest the author
   visualised clicking the check to revert to a circle — i.e., un-completing.

4. **The `statusFilter === 'open'` path in `visibleTasks`** (line 71):
   ```jsx
   statusFilter === 'open' ? !task.completed : task.completed
   ```
   Filtering for "To do" tasks explicitly handles the case where `completed`
   is `false`. This only has ongoing utility if tasks can actually revert to
   `false` — confirming the author assumed bidirectional state.

**Conclusion for Phase 2:** The original `toggleTask` was correct. The author
understood and intended bidirectional toggle. The `!task.completed` expression
was written deliberately, not accidentally. Every surrounding UI surface was
built with bidirectionality as an assumption.

### What was missing at birth:

- **No tests.** The birth commit (`d0834b2`) introduced no test files.
  `package.json` contains no `test` script and no test dependency.
- **No linter.** No ESLint config was added. The code could not be statically
  analysed for correctness.
- **No CI.** No GitHub Actions, no pre-push hooks, no automated checks.

The function was correct, but it had zero automated verification of that
correctness. Its only "test" was manual visual inspection.

---

## 4. Phase 3 — The Mutation: `!task.completed` → `true` (1405373, 11:32)

**Commit:** `1405373` — "Seed intentional bugs for hackathon AI testing"
**Files changed:** `App.jsx` (6 lines, 3 hunks), `README.md` (1 line)
**Time since app birth:** 4 minutes
**Author:** same single contributor

### The exact mutation:

```diff
# App.jsx line 85
- const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
+ const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
```

**What changed:** `!task.completed` → `true` — the boolean negation operator and
the `task.completed` operand were both removed. The resulting literal `true` is
syntactically valid and functionally plausible to a casual reader (completing a
task does set `completed` to `true`). The broken direction (un-completing) is
invisible until tested.

### What did NOT change in this commit:

| Surface | Changed? | Significance |
|---|---|---|
| `aria-label` on task-check (`App.jsx:90`) | ❌ No | Still reads "Mark X incomplete" for done tasks — the contract is preserved but undeliverable |
| `aria-label` on detail button (`App.jsx:119`) | ❌ No | Still reads "Toggle task completion" — promises bidirectionality |
| `detail-check` CSS class logic | ❌ No | `.checked` class still toggled correctly — visual shows bidirectional |
| `detail-check` icon logic | ❌ No | `<Check />` / `<Circle />` swap still present — visual implies undo is possible |
| `statusFilter === 'open'` path | ❌ No | Still filters for `!task.completed` — assumes un-completion is possible |
| `visibleTasks` useMemo | ❌ No | Still sorts and filters by `completed` — derives from a state that can now only be monotonically increasing |
| `completedTasks` / `openTasks` derivation | ❌ No | Still computes correctly — but `completedTasks` can only ever grow |
| `CourseOverview.done` count | ❌ No | Still counts `task.completed` — will perpetually increase |
| Sidebar week card | ❌ No | Still shows `completedTasks.length` — can only increase |

**The mutation created a divergence between promise and delivery.** Every UI
surface continued to advertise and accommodate bidirectional toggle. Only the
function that actually performs the toggle was broken. The gap between the
advertising layer and the delivery layer is what makes the bug difficult to
spot by reading any single line.

### The README mutation (same commit):

```diff
- Studywell is a lightweight student task planner built for the IBM BOB 2.0 Hackathon.
+ Studywell is a lightweight student task planner built for the IBM BOB 2.0 Hackathon.
+ This version intentionally contains seeded logic defects as a test target for a hackathon bug-detection AI.
```

**Significance:** The README mutation confirms the intentional nature of the
change and discloses it publicly within the same commit. The bug was not an
accident, a typo, or a misunderstanding — it was a deliberately placed test
artefact. This matters for root cause: the conditions that *enabled* the bug to
be placed undetected are the real subject of this analysis.

---

## 5. git blame Attribution

`git blame` on the current `HEAD` of `App.jsx`:

| Line | Commit | Content |
|---|---|---|
| 85 | `1405373` | `toggleTask` — `completed: true` (the mutation) |
| 90 | `d0834b2` | `aria-label` with "Mark X incomplete" (the birth commit) |
| 119 | `d0834b2` | `detail-check` with "Toggle task completion" (the birth commit) |

**Interpretation:** Line 85 is the only line in `App.jsx` with `1405373` as its
blame commit — confirming that exactly one line was changed, and that it is the
line of concern. Every surrounding line was last touched at the birth commit and
has never been modified. The mutation was surgically precise.

---

## 6. What the Reference Era's Architecture Reveals as a Missing Safeguard

The Base44 reference files suggest that in the original platform design:

- **`TaskCheckbox`** was a reusable component that encapsulated completion toggling.
  Its existence as a separate component means the toggle logic would have had
  its own unit test surface.
- **`useTasks` hook** (`Tasks.jsx:11`) would have contained the task mutation
  logic. Custom hooks in the React testing ecosystem are typically tested with
  `@testing-library/react-hooks` or equivalent — giving the toggle an explicit
  test boundary.
- **Backend API** (`useTasks` called an API) provided a natural integration
  test boundary: a test could mock the API and verify that completing/un-completing
  a task produced the correct network call.

When the runnable `App.jsx` was built, the architecture was **collapsed** from
this multi-layer structure into a single file with inline functions. The toggle
logic that formerly lived in a dedicated hook and component now lived as a
one-liner closure inside `App`. This architectural consolidation eliminated
the natural test boundaries that had existed in the prior design.

**The missing safeguard is not a missed `if` statement or a missing guard clause.
It is the absence of any test that exercises the un-complete path.**

---

## 7. Conditions That Made the Mutation Possible (Not Causes — Conditions)

These are structural conditions in the codebase at the time of the mutation.
None of them reflect on any individual.

### Condition 1 — Zero automated test coverage

The birth commit (`d0834b2`) introduced 169 lines of application logic with no
corresponding test file. `package.json` has no `test` script. There is no
Vitest, Jest, or any testing library anywhere in `package.json` dependencies.

**Effect on RISK-003:** The correct `!task.completed` had no automated assertion.
The mutation changed one token; there was no test to fail. In the 4 minutes
between `d0834b2` and `1405373`, no automated system detected the regression.

### Condition 2 — Compact inline architecture with no type boundaries

`toggleTask` is a one-liner arrow function defined inside `App()`:
```js
const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true } : task));
```

All logic — the id match, the spread, the completed field assignment — is on a
single line with no intermediate values, no named intermediate objects, and no
type annotations. A reader must mentally parse the entire expression to evaluate
correctness. There is no intermediate variable like `const wasCompleted = task.completed`
to signal intent.

**Effect on RISK-003:** The mutation from `!task.completed` to `true` is a
two-character change on a line with ~130 characters. The change is easy to make
and easy to miss in review. The `true` literal is contextually plausible (a
completion action _does_ set `completed` to `true`) — it does not look obviously
wrong on first read.

### Condition 3 — No linter or static analysis

There is no ESLint config in the repository. TypeScript is not used. The project
has no static analysis tooling of any kind.

**Effect on RISK-003:** TypeScript would have had no impact here (both `true`
and `!task.completed` are valid `boolean` assignments). However, an ESLint rule
like `prefer-destructuring` or a custom rule enforcing toggle patterns would
not have caught this either. Static analysis cannot detect semantic inversions
of this kind — this condition is noted for completeness but is not the primary
missing safeguard.

### Condition 4 — No pre-commit or CI hooks

`.git/hooks/` contains only sample files (none activated). There is no
`package.json` `prepare` script, no husky config, no CI YAML file. Nothing
runs automatically on commit.

**Effect on RISK-003:** A pre-commit hook running tests would have caught the
regression immediately. With no hooks, the mutation could be committed and
pushed with zero automated scrutiny.

### Condition 5 — UI surfaces that promise more than the function delivers

The `aria-label`, icon logic, and CSS class all correctly describe a
bidirectional toggle. They were not updated in the mutation commit. This is not
a condition that enabled the mutation — but it is a condition that makes the
bug harder to identify through UI inspection alone. The app *looks* correct
because every visual element other than the actual state change behaves as
expected.

**Effect on RISK-003:** A developer doing a quick visual smoke test of the
mutation commit ("does completing a task still work?") would answer yes. The
broken case ("can you un-complete a task?") is the second click on the same
element — a less-obvious test scenario, especially for someone who just wrote
the code and knows the intended semantic.

---

## 8. Timeline of the Un-complete Feature Across Both Codebases

```
BASE44 ERA (10:51–10:57)
  Dashboard.jsx    — no direct toggle; uses useTaskDialogs hook
  Tasks.jsx        — uses useTasks hook (API-backed) + TaskCheckbox component
  taskdetail.jsx   — uses TaskCheckbox component (bidirectional by design)
  [missing] @/components/tasks/TaskCheckbox — would contain toggle logic + test surface
  [missing] @/hooks/useTasks                — would contain API mutation + test surface

RUNNABLE APP BIRTH (11:28, d0834b2)
  App.jsx:85 — toggleTask = (...) => { ...task, completed: !task.completed }
               ↑ Born correct. Bidirectional. No tests.

MUTATION (11:32, 1405373) — 4 minutes later
  App.jsx:85 — toggleTask = (...) => { ...task, completed: true }
               ↑ Broken. One-directional. Still no tests.
               ↑ README updated to disclose intentional defects.

NOW (HEAD = 1405373)
  No tests exist. The mutation is undetected by any automated mechanism.
  The only detection path is manual usage or AI analysis (this report).
```

---

## 9. Blameless Root Cause

The mutation was intentional — it was placed deliberately as a test target for
a bug-detection AI, as disclosed by both the commit message and the README.

**The conditions that made it possible to place the mutation undetected, and that
make it impossible for the codebase to self-heal, are:**

> **The toggle's correct behaviour — bidirectional boolean negation — was never
> expressed as an automated assertion. Without a test that exercises the
> un-complete path, any change to `toggleTask` that preserves the complete path
> (open → done) is indistinguishable from a correct implementation until a human
> manually tests the reverse direction.**

This is a **coverage gap**, not a logic gap. The logic was right at birth. The
gap is that the right logic had no guardian.

---

## 10. Prevention Lessons (Evidence-Based Only)

Each lesson is grounded in a specific observable condition from this codebase's
history:

### Lesson 1 — Test both directions of any boolean toggle at the moment of writing

**Evidence:** `toggleTask` was correct at birth (`d0834b2`) and broken 4 minutes
later (`1405373`) without detection. A single test would have caught this:

```js
// The test that should have existed in d0834b2:
test('toggleTask un-completes a completed task', () => {
  const initial = [{ id: '1', completed: true }];
  // apply toggleTask logic
  const result = initial.map(task =>
    task.id === '1' ? { ...task, completed: !task.completed } : task
  );
  expect(result[0].completed).toBe(false);
});
```

The 4-minute window between birth and mutation is so narrow that a test written
alongside the function would have been present at mutation time.

### Lesson 2 — Boolean negation (`!x`) is a fragile construction; named intent survives better

**Evidence:** `!task.completed` was changed to `true` in a 2-character edit that
is visually plausible in context. An explicit pattern like:

```js
const toggleTask = (id) => setTasks((current) =>
  current.map((task) => {
    if (task.id !== id) return task;
    return { ...task, completed: !task.completed };  // bidirectional toggle
  })
);
```

...or a named helper:

```js
const withToggled = (task) => ({ ...task, completed: !task.completed });
```

...gives the intention a name and a location that is harder to change without
noticing.

### Lesson 3 — Architectural consolidation eliminates test boundaries

**Evidence:** The Base44 reference architecture had `TaskCheckbox` and `useTasks`
as separate modules — natural unit test targets. The consolidation of everything
into `App.jsx` removed those boundaries. When toggle logic lives inside a large
closure, it becomes harder to test in isolation and easier to mutate undetected.

### Lesson 4 — UI surfaces that promise behaviour should be covered by the same test suite

**Evidence:** The `aria-label` ("Mark X incomplete"), the detail button icon
logic, and the CSS class all assume bidirectionality. These are parallel
contracts that should fail alongside a broken `toggleTask`. An integration test
that clicks the checkbox twice and asserts state would exercise both the function
and its UI surface contract simultaneously.

### Lesson 5 — Seed data with pre-completed tasks is a natural regression test fixture

**Evidence:** `task-5` ("Submit lab report") is already `completed: true` in
`starterTasks` (`App.jsx:19`). This task is the perfect fixture for testing the
un-complete path — it is present on every fresh load. If `task-5` could be
un-completed in a test, the bug would be caught on every run.

---

## 11. Summary Evidence Table

| Evidence | Source | Significance |
|---|---|---|
| `toggleTask` born with `!task.completed` | `git show d0834b2:App.jsx \| grep toggleTask` | Function was correct at birth |
| `toggleTask` changed to `completed: true` | `git diff HEAD~1 HEAD -- App.jsx` | Exact mutation; one token changed |
| Commit message: "Seed intentional bugs" | `git log --oneline HEAD` | Intentional placement confirmed |
| README updated in same commit | `git show 1405373 -- README.md` | Public disclosure of intentional defects |
| `blame` assigns line 85 to `1405373` | `git blame App.jsx` | Only one line changed; mutation is isolated |
| `blame` assigns lines 90, 119 to `d0834b2` | `git blame App.jsx` | UI surfaces unchanged — promise/delivery gap created |
| No test files in any commit | `git ls-files \| grep -E test\|spec` | Zero automated coverage at any point in history |
| No `test` script in `package.json` | `cat package.json` | No test runner ever configured |
| `TaskCheckbox` import in `taskdetail.jsx` | `git show 268610f -- taskdetail.jsx` | Original architecture had dedicated toggle component |
| Birth and mutation are 4 minutes apart | `git log --format="%ai %s"` | No time for any manual testing cycle |
| Single author throughout | `git log --format="%an"` | No second set of eyes on any commit |

---

*End of Report 04 — TIMELINE DIVE complete for RISK-003. No source files were modified.*
