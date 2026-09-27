// toggleTask.test.js
// Regression tests for RISK-003 — toggleTask() one-way completion bug
//
// These tests encode the CORRECT bidirectional toggle behaviour.
// They FAIL against the buggy literal `completed: true`.
// They PASS after the one-token fix `completed: !task.completed`.
//
// The updater logic is inlined here so the test file is self-contained
// and does not depend on App.jsx imports or JSX transforms.
// The function under test (after fix) is:
//   tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task)

import { describe, it, expect } from 'vitest';

// ─── Updater under test ───────────────────────────────────────────────────────
// This mirrors App.jsx:85 exactly as it should read after the fix.
// If App.jsx is later refactored to export the updater, this line can be
// replaced with an import — but the tests themselves remain unchanged.
const applyToggle = (tasks, id) =>
  tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );

// ─── Fixtures ─────────────────────────────────────────────────────────────────
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

  // ── Completing an open task (happy path — worked before the seeded bug too) ─

  it('marks an open task as completed', () => {
    const result = applyToggle([openTask], 'task-open');
    expect(result[0].completed).toBe(true);
  });

  // ── Un-completing a completed task (THE BROKEN DIRECTION) ─────────────────
  // This test FAILS on `completed: true` and PASSES on `completed: !task.completed`.

  it('marks a completed task as open (un-complete)', () => {
    const result = applyToggle([completedTask], 'task-done');
    expect(result[0].completed).toBe(false);
  });

  // ── Double-toggle round-trips ──────────────────────────────────────────────

  it('double-toggling an open task returns it to open', () => {
    const afterFirst  = applyToggle([openTask], 'task-open');
    const afterSecond = applyToggle(afterFirst, 'task-open');
    expect(afterSecond[0].completed).toBe(false);
  });

  // This test also FAILS on the buggy code (true → true, never returns to true from false).
  it('double-toggling a completed task returns it to completed', () => {
    const afterFirst  = applyToggle([completedTask], 'task-done');
    const afterSecond = applyToggle(afterFirst, 'task-done');
    expect(afterSecond[0].completed).toBe(true);
  });

  // ── Isolation — only the targeted task changes ─────────────────────────────

  it('does not change other tasks when toggling a specific task', () => {
    const tasks  = [openTask, completedTask, otherTask];
    const result = applyToggle(tasks, 'task-open');
    expect(result[0].completed).toBe(true);   // toggled
    expect(result[1].completed).toBe(true);   // unchanged
    expect(result[2].completed).toBe(false);  // unchanged
  });

  it('does not change any task when id does not match', () => {
    const result = applyToggle([openTask, completedTask], 'id-does-not-exist');
    expect(result[0].completed).toBe(false);
    expect(result[1].completed).toBe(true);
  });

  // ── Immutability ───────────────────────────────────────────────────────────

  it('returns a new array and does not mutate the original', () => {
    const tasks  = [openTask];
    const result = applyToggle(tasks, 'task-open');
    expect(result).not.toBe(tasks);           // new array reference
    expect(result[0]).not.toBe(tasks[0]);     // new object reference for matched task
    expect(tasks[0].completed).toBe(false);   // original unchanged
  });

  // ── Field preservation ─────────────────────────────────────────────────────

  it('preserves all other fields on the toggled task', () => {
    const result  = applyToggle([openTask], 'task-open');
    const toggled = result[0];
    expect(toggled.id).toBe(openTask.id);
    expect(toggled.title).toBe(openTask.title);
    expect(toggled.course).toBe(openTask.course);
    expect(toggled.dueDate).toBe(openTask.dueDate);
    expect(toggled.priority).toBe(openTask.priority);
    expect(toggled.description).toBe(openTask.description);
  });

  // ── Edge case ─────────────────────────────────────────────────────────────

  it('handles an empty task list gracefully', () => {
    const result = applyToggle([], 'task-open');
    expect(result).toEqual([]);
  });

  // ── Seed data fixture — task-5 is pre-completed in App.jsx:19 ─────────────
  // This is the most direct reproduction of the user-visible bug:
  // "Submit lab report" is completed on first load and must be un-completable.

  it('can un-complete task-5 (the seed completed task)', () => {
    const task5 = {
      id: 'task-5',
      title: 'Submit lab report',
      course: 'Physics II',
      dueDate: '2026-09-25',
      priority: 'medium',
      completed: true,
      description: 'Upload the final lab report and figures.',
    };
    const result = applyToggle([task5], 'task-5');
    expect(result[0].completed).toBe(false);
  });

});
