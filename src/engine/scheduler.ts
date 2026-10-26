import { Caregiver, Task, Template, dateAdd, weekOf } from "../models";
export const active = (t: Task) =>
  !!t.caregiver &&
  t.start !== undefined &&
  !["declined", "cancelled", "unassigned"].includes(t.status);
export function reasons(
  t: Task,
  c: Caregiver,
  date: string,
  start: number,
  schedule: Task[],
): string[] {
  const end = start + t.duration,
    day = new Date(date + "T12:00:00").getDay(),
    r: string[] = [];
  if (
    !t.allowedDates.includes(date) ||
    start < t.earliest ||
    end > t.latest ||
    (t.fixed && (date !== t.date || start !== t.earliest))
  )
    r.push("Outside the allowed time window");
  if (t.excluded.includes(c.id))
    r.push("Caregiver declined this responsibility");
  if (!t.required.every((x) => c.capabilities.includes(x)))
    r.push("Required capability is missing");
  if (
    !c.availability.some(
      (w) =>
        w.day === day && w.start <= start - t.buffer && w.end >= end + t.buffer,
    )
  )
    r.push("Not available for the full duration and buffer");
  if (
    c.exceptions.some(
      (w) =>
        w.date === date && start - t.buffer < w.end && end + t.buffer > w.start,
    )
  )
    r.push("Availability exception");
  if (
    schedule.some(
      (o) =>
        o.id !== t.id &&
        active(o) &&
        o.caregiver === c.id &&
        o.date === date &&
        start - t.buffer < o.start! + o.duration + o.buffer &&
        end + t.buffer > o.start! - o.buffer,
    )
  )
    r.push("Overlapping responsibility or travel buffer");
  return r;
}
export function conflicts(tasks: Task[], people: Caregiver[]) {
  return tasks.flatMap((t) => {
    if (!active(t)) return [];
    const c = people.find((c) => c.id === t.caregiver);
    const why = c
      ? reasons(t, c, t.date, t.start!, tasks)
      : ["Caregiver no longer exists"];
    return why.length ? [{ task: t, reasons: why }] : [];
  });
}
export const hours = (tasks: Task[], id: string) =>
  tasks
    .filter((t) => active(t) && t.caregiver === id)
    .reduce((n, t) => n + t.duration / 60, 0);
export function expand(
  templates: Template[],
  tasks: Task[],
  week: string,
): Task[] {
  const out = [...tasks];
  for (const t of templates)
    for (let d = 0; d < 7; d++) {
      const date = dateAdd(week, d);
      if (
        t.days.includes(new Date(date + "T12:00:00").getDay()) &&
        !out.some((x) => x.templateId === t.id && x.id === `${t.id}:${date}`)
      ) {
        const { days, ...base } = t;
        out.push({
          ...base,
          id: `${t.id}:${date}`,
          templateId: t.id,
          date,
          allowedDates: [date],
          status: "unassigned",
          excluded: [],
        });
      }
    }
  return out;
}
type Candidate = {
  date: string;
  start: number;
  caregiver: string;
  score: number;
};
export function candidates(
  t: Task,
  people: Caregiver[],
  schedule: Task[],
  mode = 0,
): Candidate[] {
  const out: Candidate[] = [];
  for (const c of people)
    for (const date of t.fixed
      ? [t.date]
      : t.allowedDates.filter((d) => weekOf(d) === weekOf(t.date)))
      for (
        let start = t.earliest;
        start + t.duration <= t.latest;
        start += 15
      ) {
        if (t.fixed && start !== t.earliest) break;
        if (reasons(t, c, date, start, schedule).length) continue;
        const h = hours(
            schedule.filter((x) => weekOf(x.date) === weekOf(date)),
            c.id,
          ),
          same = t.caregiver === c.id && t.date === date && t.start === start;
        const backup = people
          .find((p) => p.id === (t.caregiver || t.excluded.at(-1)))
          ?.backups.includes(c.id);
        out.push({
          date,
          start,
          caregiver: c.id,
          score:
            (h / Math.max(c.maxHours, 1)) * (mode === 1 ? 16 : 6) +
            Math.max(0, h + t.duration / 60 - c.maxHours) * 12 +
            (same ? -(mode === 0 ? 15 : 3) : 0) +
            (t.preferred === c.id ? -3 : 0) +
            (backup ? -2 : 0) +
            (c.preferences.includes(t.category) ? -2 : 0) +
            (start - t.earliest) / 240 +
            (mode === 2 ? people.indexOf(c) * 0.8 : 0),
        });
      }
  return out.sort(
    (a, b) =>
      a.score - b.score ||
      a.date.localeCompare(b.date) ||
      a.start - b.start ||
      a.caregiver.localeCompare(b.caregiver),
  );
}
export function generate(
  tasks: Task[],
  people: Caregiver[],
  mode = 0,
  repair = false,
): Task[] {
  const locked = tasks.filter(
    (t) =>
      t.status === "completed" ||
      (!repair && t.status === "confirmed") ||
      t.status === "cancelled",
  );
  // Availability, capability and window checks do not depend on a search branch.
  // Calculate them once, then evaluate only overlaps and workloads per branch.
  const placements = new Map(
    tasks.map((t) => [t.id, candidates(t, people, [], mode)]),
  );
  const personById = new Map(people.map((c) => [c.id, c]));
  const todo = tasks
    .filter((t) => !locked.includes(t))
    .sort(
      (a, b) =>
        Number(b.fixed) - Number(a.fixed) ||
        Number(b.priority === "high") - Number(a.priority === "high") ||
        placements.get(a.id)!.length - placements.get(b.id)!.length ||
        a.id.localeCompare(b.id),
    );
  let beam: { list: Task[]; cost: number }[] = [{ list: locked, cost: 0 }];
  for (const t of todo) {
    const next: typeof beam = [];
    for (const b of beam) {
      const occupied = b.list.filter(active);
      const load = new Map<string, number>();
      for (const o of occupied) {
        const key = `${o.caregiver}:${weekOf(o.date)}`;
        load.set(key, (load.get(key) || 0) + o.duration / 60);
      }
      const opts = placements
        .get(t.id)!
        .filter(
          (c) =>
            !occupied.some(
              (o) =>
                o.caregiver === c.caregiver &&
                o.date === c.date &&
                c.start - t.buffer < o.start! + o.duration + o.buffer &&
                c.start + t.duration + t.buffer > o.start! - o.buffer,
            ),
        )
        .map((c) => {
          const person = personById.get(c.caregiver)!;
          const h = load.get(`${c.caregiver}:${weekOf(c.date)}`) || 0;
          return {
            ...c,
            score:
              c.score +
              (h / Math.max(person.maxHours, 1)) * (mode === 1 ? 16 : 6) +
              (Math.max(0, h + t.duration / 60 - person.maxHours) -
                Math.max(0, t.duration / 60 - person.maxHours)) *
                12,
          };
        })
        .sort(
          (a, b) =>
            a.score - b.score ||
            a.date.localeCompare(b.date) ||
            a.start - b.start ||
            a.caregiver.localeCompare(b.caregiver),
        )
        .slice(0, 10);
      for (const c of opts) {
        const unchanged =
          t.caregiver === c.caregiver &&
          t.date === c.date &&
          t.start === c.start;
        next.push({
          list: [
            ...b.list,
            {
              ...t,
              ...c,
              status: unchanged && active(t) ? t.status : "proposed",
            },
          ],
          cost: b.cost + c.score,
        });
      }
      next.push({
        list: [
          ...b.list,
          {
            ...t,
            caregiver: undefined,
            start: undefined,
            status: "unassigned",
          },
        ],
        cost: b.cost + (t.priority === "high" ? 10000 : 3000),
      });
    }
    beam = next.sort((a, b) => a.cost - b.cost).slice(0, 28);
  }
  const best = beam[0]?.list || locked;
  return tasks.map((t) => best.find((x) => x.id === t.id)!).filter(Boolean);
}
export const changed = (a: Task, b: Task) =>
  a.caregiver !== b.caregiver || a.date !== b.date || a.start !== b.start;
export function alternatives(tasks: Task[], people: Caregiver[]) {
  const seen = new Set<string>();
  return [0, 1, 2].flatMap((mode) => {
    const plan = generate(tasks, people, mode, true);
    if (conflicts(plan, people).length) return [];
    const key = JSON.stringify(
      plan.map((t) => [t.id, t.date, t.start, t.caregiver]),
    );
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        name: ["Fewest changes", "Balanced support", "Another way forward"][
          mode
        ],
        tasks: plan,
        changes: plan.filter((t) =>
          changed(
            tasks.find((o) => o.id === t.id)!,
            t,
          ),
        ),
      },
    ];
  });
}
export function explain(t: Task, people: Caregiver[]) {
  const c = people.find((c) => c.id === t.caregiver);
  return c
    ? `${c.name} is available for the full ${t.duration} minutes${t.buffer ? ` plus ${t.buffer}-minute buffers` : ""}${t.required.length ? ` and can help with ${t.required.join(", ").toLowerCase()}` : ""}. This placement fits the task window without overlapping commitments.`
    : `No eligible placement was found within the search limit. Review availability or ask an approved backup.`;
}

// Show the closest valid-time attempt for each person instead of claiming success
// when the search cannot place a task.
export function assignmentBlockers(t: Task, people: Caregiver[], schedule: Task[]): {person?: Caregiver; reason: string}[] {
  if (!people.length) return [{reason: "Add someone who can help, including the times they are available."}];
  return people.map(person => {
    if (!person.availability.length) return {person, reason: "No availability has been added yet."};
    const missing = t.required.filter(r => !person.capabilities.includes(r));
    if (missing.length) return {person, reason: `Their abilities do not include ${missing.join(", ")}.`};
    let closest: string[] | undefined;
    for (const date of t.fixed ? [t.date] : t.allowedDates.filter(d => weekOf(d) === weekOf(t.date))) {
      for (let start = t.earliest; start + t.duration <= t.latest; start += 15) {
        const why = reasons(t, person, date, start, schedule);
        if (!closest || why.length < closest.length) closest = why;
        if (t.fixed) break;
      }
    }
    const messages: Record<string,string> = {
      "Not available for the full duration and buffer": "Their available hours do not cover the task and its travel buffer.",
      "Availability exception": "They have time off during this task.",
      "Overlapping responsibility or travel buffer": "Another task or its travel buffer overlaps this time.",
      "Caregiver declined this responsibility": "They previously declined this task.",
      "Outside the allowed time window": "The task does not fit its allowed time window.",
    };
    return {person, reason: closest === undefined ? "The task needs a time window long enough to fit its duration."
      : closest.length ? closest.map(r => messages[r] || r).join(" ")
      : "They may be available, but the planner could not fit this task alongside the other assignments. Try adjusting its time."};
  });
}
