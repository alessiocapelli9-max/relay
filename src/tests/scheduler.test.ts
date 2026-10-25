import { test } from "node:test";
import assert from "node:assert/strict";
import { demo } from "../data";
import {
  generate,
  conflicts,
  alternatives,
  reasons,
  active,
  expand,
} from "../engine/scheduler";
import { Task, weekOf, today } from "../models";
test("demo and generated plans obey every hard constraint", () => {
  const s = demo();
  assert.equal(s.tasks.length, 18);
  assert.deepEqual(conflicts(s.tasks, s.caregivers), []);
  for (const p of alternatives(s.tasks, s.caregivers))
    assert.deepEqual(conflicts(p.tasks, s.caregivers), []);
});
test("confirmed assignments are preserved by generation", () => {
  const s = demo();
  const plan = generate(s.tasks, s.caregivers);
  for (const t of s.tasks.filter((t) => t.status === "confirmed"))
    assert.deepEqual(
      plan.find((x) => x.id === t.id),
      t,
    );
});
test("absence prevents placement and repair yields pending proposals", () => {
  const s = demo(),
    target = s.tasks.find((t) => active(t))!;
  const people = s.caregivers.map((c) =>
    c.id === target.caregiver
      ? { ...c, exceptions: [{ date: target.date, start: 0, end: 1440 }] }
      : c,
  );
  const result = alternatives(s.tasks, people);
  assert.ok(result.length);
  for (const p of result) {
    assert.equal(conflicts(p.tasks, people).length, 0);
    assert.ok(
      !p.tasks.some(
        (t) =>
          t.caregiver === target.caregiver &&
          t.date === target.date &&
          active(t),
      ),
    );
  }
});
test("missing capability leaves uncovered instead of inventing coverage", () => {
  const s = demo(),
    t = {
      ...s.tasks[0],
      required: ["Impossible"],
      status: "unassigned" as const,
      caregiver: undefined,
      start: undefined,
    };
  assert.equal(generate([t], s.caregivers)[0].status, "unassigned");
});
test("overlap, buffers, full availability, fixed window and declines rejected", () => {
  const s = demo(),
    c = s.caregivers[1],
    date = s.tasks[0].date;
  const t: Task = {
    ...s.tasks[0],
    date,
    allowedDates: [date],
    earliest: 600,
    latest: 660,
    duration: 60,
    buffer: 15,
    fixed: true,
    status: "proposed",
    caregiver: c.id,
    start: 600,
  };
  assert.ok(reasons(t, c, date, 615, []).length);
  assert.ok(reasons({ ...t, excluded: [c.id] }, c, date, 600, []).length);
  assert.ok(
    reasons(t, c, date, 600, [{ ...t, id: "other", start: 675 }]).length,
  );
  assert.ok(
    reasons({ ...t, earliest: 480, latest: 540 }, c, date, 480, []).length,
  );
});
test("bounded search handles forty responsibilities without invalid placements", () => {
  const s = demo();
  const ts = Array.from({ length: 40 }, (_, i) => ({
    ...s.tasks[i % s.tasks.length],
    id: `stress${i}`,
    status: "unassigned" as const,
    caregiver: undefined,
    start: undefined,
  }));
  const start = performance.now();
  const plan = generate(ts, s.caregivers);
  assert.equal(plan.length, 40);
  assert.equal(conflicts(plan, s.caregivers).length, 0);
  assert.ok(performance.now() - start < 10000);
});
test("recurrence expansion is idempotent and preserves completed instances", () => {
  const s = demo(),
    base = s.tasks[0],
    template = { ...base, id: "template", days: [1, 3] };
  const first = expand([template], [], weekOf(today()));
  first[0].status = "completed";
  const second = expand([template], first, weekOf(today()));
  assert.equal(second.length, 2);
  assert.equal(second[0].status, "completed");
});
