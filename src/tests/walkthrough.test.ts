import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleScenario } from "../components/Walkthrough";
import { active, alternatives, conflicts } from "../engine/scheduler";
test("intro example computes a valid replacement and keeps acceptance with the affected caregiver", () => {
  const { tasks, people } = exampleScenario();
  const before = structuredClone(tasks);
  const unavailable = people.map((p, i) =>
    i === 0
      ? { ...p, exceptions: [{ date: tasks[0].date, start: 0, end: 1440 }] }
      : p,
  );
  const disrupted = tasks.map((t) =>
    t.id === "ride"
      ? {
          ...t,
          status: "unassigned" as const,
          caregiver: undefined,
          start: undefined,
          excluded: [people[0].id],
        }
      : t,
  );
  const plans = alternatives(disrupted, unavailable);
  assert.ok(plans.length);
  const plan = plans[0].tasks;
  assert.equal(plan.filter(active).length, 3);
  assert.deepEqual(conflicts(plan, unavailable), []);
  assert.equal(plan.find((t) => t.id === "ride")?.caregiver, people[1].id);
  assert.equal(plan.find((t) => t.id === "groceries")?.caregiver, people[1].id);
  assert.notEqual(
    plan.find((t) => t.id === "groceries")?.start,
    tasks[1].start,
  );
  assert.equal(plan.find((t) => t.id === "ride")?.status, "proposed");
  assert.equal(plan.find((t) => t.id === "groceries")?.status, "proposed");
  assert.deepEqual(tasks, before);
});
