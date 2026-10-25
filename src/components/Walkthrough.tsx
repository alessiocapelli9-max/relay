import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Car,
  ShoppingBag,
  Utensils,
  RotateCcw,
} from "lucide-react";
import { Caregiver, Task, dateAdd, today, weekOf } from "../models";
import { alternatives, active, changed } from "../engine/scheduler";

export function exampleScenario() {
  const date = dateAdd(weekOf(today()), 2);
  const people: Caregiver[] = ["Sarah", "Michael", "Emily"].map((name, i) => ({
    id: `example-${i}`,
    name,
    role: "Family",
    color: ["#ad755c", "#477d88", "#7e8259"][i],
    maxHours: 6,
    capabilities:
      i === 2 ? ["Meals"] : i === 0 ? ["Driving"] : ["Driving", "Errands"],
    preferences: [],
    availability: [3, 4].map((day) => ({ day, start: 840, end: 1140 })),
    exceptions: [],
    backups: [],
  }));
  const task = (
    id: string,
    name: string,
    category: string,
    start: number,
    duration: number,
    caregiver: string,
    fixed: boolean,
  ): Task => ({
    id,
    name,
    category,
    start,
    duration,
    caregiver,
    fixed,
    date,
    allowedDates: [date],
    earliest: start,
    latest: fixed ? start + duration : 1140,
    priority: fixed ? "high" : "normal",
    required: [category],
    preferred: "",
    buffer: 0,
    notes: "",
    description: "",
    excluded: [],
    status: "confirmed",
  });
  return {
    people,
    tasks: [
      task(
        "ride",
        "Ride to an appointment",
        "Driving",
        900,
        90,
        people[0].id,
        true,
      ),
      task(
        "groceries",
        "Pick up groceries",
        "Errands",
        900,
        60,
        people[1].id,
        false,
      ),
      task("dinner", "Make dinner", "Meals", 1020, 45, people[2].id, true),
    ],
  };
}
export const friendlyTime = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""} ${m >= 720 ? "pm" : "am"}`;
export function Walkthrough({
  start,
  onExplore,
}: {
  start: number;
  onExplore: () => void;
}) {
  const [scenario] = useState(exampleScenario);
  const [stage, setStage] = useState(0);
  const [plan, setPlan] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (start) setStage(1);
  }, [start]);
  const people = scenario.people;
  const base = scenario.tasks.map((t) =>
    t.id === "ride"
      ? {
          ...t,
          caregiver: undefined,
          start: undefined,
          status: "unassigned" as const,
          excluded: [people[0].id],
        }
      : t,
  );
  const visible = stage === 0 ? scenario.tasks : stage === 1 ? base : plan;
  const replacement = people.find(
    (c) => c.id === plan.find((t) => t.id === "ride")?.caregiver,
  )?.name;
  function solve() {
    setBusy(true);
    setTimeout(() => {
      const unavailable = people.map((c, i) =>
        i === 0
          ? { ...c, exceptions: [{ date: base[0].date, start: 0, end: 1440 }] }
          : c,
      );
      const result = alternatives(base, unavailable);
      setPlan(result[0]?.tasks || base);
      setStage(2);
      setBusy(false);
    }, 120);
  }
  const titles = [
    "Meet Elena’s Wednesday.",
    "Sarah can’t make it.",
    "There’s another way.",
    "One last thing: ask Michael.",
    "Care continues.",
  ];
  const captions = [
    "Three everyday tasks. Three people sharing the care.",
    "Her ride is now uncovered. The groceries can happen later—can Relay work around that?",
    `${replacement || "A caregiver"} can cover the ride. Relay rearranged the flexible task to make room.`,
    "A suggestion isn’t a commitment. Changed tasks stay unconfirmed until the caregiver agrees.",
    "The ride is covered, the groceries still get done, and the family stays in control.",
  ];
  return (
    <section
      className="story"
      id="relay-example"
      aria-label="Interactive cancellation example"
    >
      <div className="story-top">
        <span className="eyebrow">TRY IT · FICTIONAL FAMILY</span>
        <span className="story-dots" aria-label={`Step ${stage + 1} of 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= stage ? "filled" : ""} />
          ))}
        </span>
      </div>
      <div className="story-copy" aria-live="polite">
        <h2>{titles[stage]}</h2>
        <p>{captions[stage]}</p>
      </div>
      <div className="example-list">
        {visible.map((t, i) => {
          const Icon = [Car, ShoppingBag, Utensils][i];
          const old = scenario.tasks.find((x) => x.id === t.id)!;
          const moved = stage >= 2 && changed(old, t);
          const name = people.find((c) => c.id === t.caregiver)?.name;
          return (
            <div
              key={t.id}
              className={`example-task ${!active(t) ? "uncovered" : ""}`}
            >
              <span className="example-icon">
                <Icon size={20} />
              </span>
              <div className="grow">
                <b>{t.name}</b>
                <span>
                  {t.start === undefined
                    ? "Wednesday, 3 pm"
                    : `${t.date === old.date ? "Wednesday" : "Thursday"}, ${friendlyTime(t.start)}`}
                  {moved && t.start !== old.start && (
                    <em> moved from {friendlyTime(old.start!)}</em>
                  )}
                </span>
              </div>
              <div className="example-assignee">
                {name ? (
                  <>
                    <span className="mini-avatar">{name[0]}</span>
                    <b>{name}</b>
                    {stage === 3 && moved ? (
                      <small>Needs a reply</small>
                    ) : stage === 2 && moved ? (
                      <small>Suggested</small>
                    ) : (
                      <small>
                        <Check size={12} /> Confirmed
                      </small>
                    )}
                  </>
                ) : (
                  <span className="needs-help">Needs help</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="story-action">
        {stage === 0 ? (
          <>
            <span className="tiny-note">
              A real scheduling example. Give it a try.
            </span>
            <button className="link-button" onClick={() => setStage(1)}>
              Sarah can’t make it <ArrowRight size={16} />
            </button>
          </>
        ) : stage === 1 ? (
          <button className="primary full" onClick={solve} disabled={busy}>
            {busy ? "Checking who can help…" : "Find a replacement"}
            <ArrowRight size={17} />
          </button>
        ) : stage === 2 ? (
          <>
            <div className="reason">
              <Check size={16} />
              <span>
                Available for the whole ride. Can drive. No overlapping tasks.
              </span>
            </div>
            <button className="primary full" onClick={() => setStage(3)}>
              Ask {replacement || "the caregiver"} to help{" "}
              <ArrowRight size={17} />
            </button>
          </>
        ) : stage === 3 ? (
          <button
            className="primary full"
            onClick={() => {
              setPlan(plan.map((t) => ({ ...t, status: "confirmed" })));
              setStage(4);
            }}
          >
            <Check size={17} />
            Try {replacement || "the caregiver"} accepting
          </button>
        ) : (
          <>
            <div className="demo-result">
              <Check size={18} />
              <span>
                <b>
                  {plan.filter(active).length} of {plan.length} tasks covered.
                </b>{" "}
                One less gap for the family to solve.
              </span>
            </div>
            <button className="primary full" onClick={onExplore}>
              Explore the full weekly plan <ArrowRight size={17} />
            </button>
          </>
        )}
      </div>
      {stage > 0 && (
        <button
          className="restart"
          onClick={() => {
            setStage(0);
            setPlan([]);
          }}
        >
          <RotateCcw size={13} />
          Start example again
        </button>
      )}
    </section>
  );
}
