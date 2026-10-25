import {
  State,
  Task,
  Caregiver,
  Template,
  weekOf,
  today,
  dateAdd,
  categories,
} from "./models";
import { generate } from "./engine/scheduler";
export function demo(): State {
  const week = weekOf(today());
  const people: Caregiver[] = ["Sarah", "Michael", "David", "Emily"].map(
    (name, i) => ({
      id: `p${i}`,
      name,
      role: ["Daughter", "Son", "Family friend", "Granddaughter"][i],
      color: ["#367d70", "#b47b43", "#7a71ab", "#547fa8"][i],
      maxHours: [8, 7, 6, 7][i],
      capabilities:
        i === 3 ? categories.filter((x) => x !== "Driving") : categories,
      preferences: [categories[i]],
      availability: Array.from({ length: 7 }, (_, day) => ({
        day,
        start: i === 0 ? 12 * 60 : i === 2 ? 15 * 60 : 8 * 60,
        end: i === 1 ? 17 * 60 : 21 * 60,
      })),
      exceptions: [],
      backups: [`p${(i + 1) % 4}`],
    }),
  );
  const specs: [string, string, number, number, number, boolean][] = [
    ["Appointment transportation", "Driving", 0, 900, 90, true],
    ["Grocery shopping", "Errands", 0, 540, 60, false],
    ["Dinner preparation", "Meals", 0, 1020, 45, false],
    ["An afternoon together", "Companionship", 1, 840, 60, false],
    ["Laundry & light tidying", "Household", 1, 600, 60, false],
    ["Dinner preparation", "Meals", 1, 1020, 45, false],
    ["Appointment transportation", "Driving", 2, 900, 90, true],
    ["Fresh groceries", "Errands", 2, 600, 60, false],
    ["Dinner preparation", "Meals", 2, 1020, 45, false],
    ["A walk & a catch-up", "Companionship", 3, 840, 60, false],
    ["Prescription pickup", "Errands", 3, 600, 45, false],
    ["Dinner preparation", "Meals", 3, 1020, 45, false],
    ["Household reset", "Household", 4, 600, 60, false],
    ["Dinner preparation", "Meals", 4, 1020, 45, false],
    ["Coffee & company", "Companionship", 5, 660, 60, false],
    ["Weekend groceries", "Errands", 5, 540, 60, false],
    ["Sunday meal prep", "Meals", 6, 960, 90, false],
    ["An evening together", "Companionship", 6, 1080, 60, false],
  ];
  let tasks: Task[] = specs.map(
    ([name, category, d, start, duration, fixed], i) => ({
      id: `demo${i}`,
      name,
      category,
      date: dateAdd(week, d),
      allowedDates: [dateAdd(week, d)],
      earliest: start,
      latest: fixed ? start + duration : Math.min(start + 180, 1260),
      duration,
      fixed,
      priority: fixed ? "high" : "normal",
      required: [category],
      preferred: "",
      buffer: fixed ? 15 : 0,
      description: "",
      notes: "",
      status: "unassigned",
      excluded: [],
    }),
  );
  tasks = generate(tasks, people).map((t, i) => ({
    ...t,
    status: i < 12 && t.caregiver ? "confirmed" : t.status,
  }));
  const meal = tasks.find((t) => t.name === "Dinner preparation")!;
  const {
    date,
    allowedDates,
    caregiver,
    start,
    status,
    excluded,
    templateId,
    ...base
  } = meal;
  const template: Template = {
    ...base,
    id: "weekly-dinner",
    days: [1, 2, 3, 4, 5],
  };
  tasks = tasks.map((t) =>
    t.name === "Dinner preparation"
      ? { ...t, id: `weekly-dinner:${t.date}`, templateId: template.id }
      : t,
  );
  return {
    version: 1,
    onboarded: false,
    recipient: "Elena",
    needs: categories,
    preferences: "Afternoons for visits; keep evenings relaxed.",
    recurring: true,
    caregivers: people,
    tasks,
    templates: [template],
    activity: [
      {
        id: "welcome",
        at: new Date().toISOString(),
        text: "Welcome to Elena’s fictional care circle. Your demo week is ready.",
        read: false,
      },
    ],
  };
}
