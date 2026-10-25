"use client";
import { useEffect, useState } from "react";

import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  HeartHandshake,
  Clock,
  Car,
  ShoppingBag,
  Utensils,
  House,
  Users,
  RotateCcw,
  Download,
  HelpCircle,
} from "lucide-react";
import {
  State,
  Task,
  Caregiver,
  Status,
  Template,
  uid,
  weekOf,
  today,
  dateAdd,
  dayLabel,
} from "./models";
import {
  active,
  generate,
  conflicts,
  hours,
  alternatives,
  changed,
  expand,
  reasons,
} from "./engine/scheduler";
import { demo } from "./data";
import { PersonEditor } from "./components/Editors";
import { TaskForm as TaskEditor } from "./components/TaskForm";
import { Walkthrough, friendlyTime } from "./components/Walkthrough";
import { RepairReview } from "./components/RepairReview";
import "./style.css";
import "./editorial.css";
import "./flow.css";

type Page = "home" | "plan" | "people" | "about" | "settings" | "activity";
type Modal =
  "task" | "person" | "detail" | "repair" | "setup" | "simulate" | null;
const statusText: Record<Status, string> = {
  confirmed: "Confirmed",
  completed: "Done",
  proposed: "Needs a reply",
  pending: "Needs a reply",
  declined: "Needs help",
  unassigned: "Needs help",
  cancelled: "Cancelled",
};
const taskIcons: Record<string, typeof Car> = {
  Driving: Car,
  Errands: ShoppingBag,
  Meals: Utensils,
  Household: House,
  Companionship: HeartHandshake,
};
function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem("relay-v1") || "null");
    return saved?.version === 1 ? saved : demo();
  } catch {
    return demo();
  }
}
export default function App({initialState,onChange}:{initialState:State;onChange:(state:State)=>void}) {
  const [s, S] = useState<State>(initialState),
    [page, setPage] = useState<Page>(initialState.caregivers.length ? "plan" : "people"),
    [week, W] = useState(weekOf(today())),
    [day, D] = useState("all"),
    [filter, F] = useState("all"),
    [modal, M] = useState<Modal>(null),
    [edit, T] = useState<Task>(),
    [person, C] = useState<Caregiver>(),
    [template, TE] = useState<Template>(),
    [toast, N] = useState(""),
    [undo, U] = useState<State>(),
    [busy, BS] = useState(false),
    [demoStart, DS] = useState(0),
    [plans, PL] = useState<ReturnType<typeof alternatives>>([]),
    [before, B] = useState<Task[]>([]),
    [simulation, SM] = useState(false),
    [simPeople, SPE] = useState<Caregiver[]>([]),
    [simPerson, SP] = useState(s.caregivers[0]?.id || ""),
    [simDate, SD] = useState(today()),
    [setupName, SN] = useState("");
  useEffect(() => { onChange(s); }, [s]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => N(""), 7500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") M(null);
      if (e.key === "Tab") {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".dialog button:not([disabled]), .dialog input, .dialog select, .dialog textarea, .dialog summary",
          ),
        ).filter((e) => e.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const id = setTimeout(
      () => document.querySelector<HTMLElement>(".dialog .close")?.focus(),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", handler);
    };
  }, [modal]);
  function go(next: Page) {
    setPage(next);
    F("all");
    D("all");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function save(next: State, message: string) {
    U(s);
    S({
      ...next,
      activity: [
        { id: uid(), at: new Date().toISOString(), text: message, read: false },
        ...next.activity,
      ],
    });
    N(message);
    PL([]);
  }
  const tasks = s.tasks.filter((t) => weekOf(t.date) === week),
    live = tasks.filter((t) => t.status !== "cancelled"),
    issues = conflicts(tasks, s.caregivers),
    needsHelp = (t: Task) =>
      (!active(t) && t.status !== "cancelled") ||
      issues.some((i) => i.task.id === t.id),
    gaps = live.filter(needsHelp),
    pending = live.filter((t) => ["pending", "proposed"].includes(t.status)),
    confirmed = live.filter(
      (t) => ["confirmed", "completed"].includes(t.status) && !needsHelp(t),
    );
  const who = (id?: string) => s.caregivers.find((c) => c.id === id);
  function update(t: Task, message: string) {
    save({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? t : x)) }, message);
  }
  function respond(t: Task, status: Status) {
    if (status === "confirmed") {
      const c = who(t.caregiver);
      if (
        !c ||
        t.start === undefined ||
        reasons(t, c, t.date, t.start, s.tasks).length
      ) {
        N(
          "This task has a scheduling conflict. Find a replacement before accepting.",
        );
        return;
      }
    }
    update(
      {
        ...t,
        status,
        excluded:
          status === "declined" ? [...t.excluded, t.caregiver!] : t.excluded,
      },
      `${who(t.caregiver)?.name || "Coordinator"} ${status === "confirmed" ? "accepted" : status === "completed" ? "completed" : status} ${t.name}.`,
    );
    M(null);
  }
  function newTask() {
    T(undefined);
    TE(undefined);
    M("task");
  }
  function viewTask(t: Task) {
    T(t);
    TE(undefined);
    M("detail");
  }
  function run() {
    BS(true);
    setTimeout(() => {
      const expanded = expand(s.templates, s.tasks, week),
        plan = generate(
          expanded.filter((t) => weekOf(t.date) === week),
          s.caregivers,
        );
      save(
        {
          ...s,
          tasks: [...expanded.filter((t) => weekOf(t.date) !== week), ...plan],
        },
        "Relay suggested a plan. Each person still needs to accept their new tasks.",
      );
      BS(false);
    }, 100);
  }
  function repair(simulate = false, source: State = s) {
    BS(true);
    SM(simulate);
    setTimeout(() => {
      const people = simulate
        ? source.caregivers.map((c) =>
            c.id === simPerson
              ? {
                  ...c,
                  exceptions: [
                    ...c.exceptions,
                    { date: simDate, start: 0, end: 1440 },
                  ],
                }
              : c,
          )
        : source.caregivers;
      const original = source.tasks.filter((t) => weekOf(t.date) === week);
      const base = original.map((t) =>
        simulate &&
        t.caregiver === simPerson &&
        t.date === simDate &&
        t.status !== "completed"
          ? {
              ...t,
              status: "unassigned" as Status,
              caregiver: undefined,
              start: undefined,
            }
          : t,
      );
      const found = alternatives(base, people);
      B(base);
      SPE(people);
      PL(found);
      S((current) => ({
        ...current,
        activity: [
          {
            id: uid(),
            at: new Date().toISOString(),
            text: `Relay found ${found.length} ${simulate ? "what-if" : "replacement"} options.`,
            read: false,
          },
          ...current.activity,
        ],
      }));
      BS(false);
      M("repair");
    }, 100);
  }
  function apply(i: number) {
    const plan = plans[i];
    const result = plan.tasks.map((t) => {
      const original = tasks.find((x) => x.id === t.id)!;
      return changed(original, t) && active(t)
        ? { ...t, status: "pending" as Status }
        : t;
    });
    save(
      {
        ...s,
        tasks: [...s.tasks.filter((t) => weekOf(t.date) !== week), ...result],
      },
      "New plan saved. Changed tasks need a reply from the people helping.",
    );
    M(null);
  }
  function cancel(t: Task) {
    const next = {
      ...s,
      tasks: s.tasks.map((x) =>
        x.id === t.id
          ? {
              ...x,
              caregiver: undefined,
              start: undefined,
              status: "unassigned" as Status,
              excluded: [...x.excluded, x.caregiver!],
            }
          : x,
      ),
    };
    save(
      next,
      `${who(t.caregiver)?.name || "The caregiver"} can’t make ${t.name}. Let’s find someone else.`,
    );
    M(null);
    go("plan");
  }
  function saveTask(t: Task, days: number[]) {
    if (!t.name.trim()) {
      N("Give this task a name.");
      return;
    }
    t = { ...t, name: t.name.trim() };
    if (
      t.earliest + t.duration > t.latest ||
      t.duration <= 0 ||
      !t.allowedDates.length
    ) {
      N("The time window needs to fit the whole task.");
      return;
    }
    if (template) {
      const {
        date,
        allowedDates,
        caregiver,
        start,
        status,
        excluded,
        templateId,
        ...base
      } = t;
      save(
        {
          ...s,
          templates: s.templates.map((x) =>
            x.id === template.id ? { ...base, id: template.id, days } : x,
          ),
        },
        "Repeating task updated. Existing dates stay unchanged.",
      );
      TE(undefined);
      M(null);
      return;
    }
    const next = {
      ...t,
      caregiver: undefined,
      start: undefined,
      status: "unassigned" as Status,
    };
    let templates = s.templates,
      list = s.tasks.some((x) => x.id === t.id)
        ? s.tasks.map((x) => (x.id === t.id ? next : x))
        : [...s.tasks, next];
    if (days.length) {
      const {
        date,
        allowedDates,
        caregiver,
        start,
        status,
        excluded,
        templateId,
        ...base
      } = t;
      const item: Template = { ...base, id: uid(), days };
      templates = [...templates, item];
      list = expand(
        [item],
        list.filter((x) => x.id !== t.id),
        weekOf(t.date),
      );
    }
    save(
      { ...s, tasks: list, templates },
      `${t.name} saved. Relay can now help find someone.`,
    );
    W(weekOf(t.date));
    M(null);
    go("plan");
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "relay-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const row = (t: Task) => {
    const Icon = taskIcons[t.category] || HeartHandshake;
    const problem = needsHelp(t);
    return (
      <button className="task-row" key={t.id} onClick={() => viewTask(t)}>
        <span className="task-time">
          {friendlyTime(t.start ?? t.earliest)}
          <small>{t.duration} min</small>
        </span>
        <span className={`task-icon ${t.category.toLowerCase()}`}>
          <Icon size={20} />
        </span>
        <span className="task-name">
          <b>{t.name}</b>
          <small>
            {who(t.caregiver)?.name || "No one assigned"}
            {t.fixed ? " · Fixed time" : " · Flexible time"}
          </small>
        </span>
        <span className={"status " + (problem ? "unassigned" : t.status)}>
          {problem ? "Needs help" : statusText[t.status]}
        </span>
        <ChevronRight size={17} />
      </button>
    );
  };
  const shown = tasks.filter(
    (t) =>
      (filter === "all" ||
        (filter === "help" && needsHelp(t)) ||
        (filter === "replies" && ["proposed", "pending"].includes(t.status))) &&
      (day === "all" || day === t.date),
  );
  return (
    <>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go("plan")}
          aria-label="Relay home"
        >
          <span className="brand-mark">
            <HeartHandshake size={23} />
          </span>
          relay<span className="brand-period">.</span>
        </button>
        <nav aria-label="Main navigation">
          {(
            [
              
              ["plan", "Weekly plan"],
              ["people", "People"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-current={page === key ? "page" : undefined}
              className={page === key ? "current" : ""}
              onClick={() => go(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className={"about-link " + (page === "settings" ? "current" : "")}
          onClick={() => go("settings")}
        >
          Plan settings <ArrowRight size={14} />
        </button>
      </header>
      <main className={page === "home" ? "home-main" : "workspace-main"}>
        {(page === "plan" || page === "people") && <>
          {!s.onboarded && <div className="sample-label"><span><b>Sample plan</b> · Fictional people and tasks</span><button className="text-button" onClick={() => {SN("");M("setup");}}>Create my own plan <ArrowRight size={16}/></button></div>}
          <nav className="setup-path" aria-label="Plan steps">
            <button onClick={() => go("people")}><span>1</span> People <small>{s.caregivers.length} added</small></button>
            <button onClick={() => go("plan")}><span>2</span> Tasks <small>{live.length} this week</small></button>
            <button disabled={!s.caregivers.length || !live.length || busy} onClick={() => {go("plan");run();}}><span>3</span> Assign people</button>
          </nav>
        </>}

        {page === "home" && (
          <>
            <section className="home-intro">
              <div className="hero-copy">
                <div className="eyebrow">A FAMILY CARE COORDINATOR</div>
                <h1>Someone to<br />count on.</h1>
                <p className="hero-description">Share rides, meals, and everyday care. Add people and tasks. Relay helps match them.</p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => { if(s.onboarded) go("plan"); else {SN("");M("setup");} }}>{s.onboarded ? "Continue my plan" : "Create my plan"} <ArrowRight size={18}/></button>
                  <button className="link-button" onClick={() => go(s.onboarded ? "people" : "plan")}>{s.onboarded ? "Manage people" : "Try the sample plan"} <ArrowRight size={16}/></button>
                </div>
                <p className="byline">A project by <b>Alessio Capelli</b><br/><span>Congressional App Challenge</span></p>
              </div>
              <figure className="care-figure">
                <svg viewBox="0 0 540 430" role="img" aria-labelledby="care-title care-desc">
                  <title id="care-title">Care is a shared responsibility</title>
                  <desc id="care-desc">Three illustrated hands pass a care plan between family members.</desc>
                  <rect width="540" height="430" fill="#e9b95d"/>
                  <path d="M0 100H540M0 330H540" stroke="#ce9c42"/>
                  <path d="M-20 46L100 76L205 158L169 211L65 149L-20 139Z" fill="#324e45"/>
                  <path d="M169 138L218 157L244 194Q252 211 239 216L208 192L189 197L156 177Z" fill="#f1d4b1" stroke="#282e29" strokeWidth="2"/>
                  <path d="M540 63L440 100L365 174L400 222L478 168L540 157Z" fill="#b64932"/>
                  <path d="M394 147L353 171L328 211Q325 224 339 223L369 193L392 197L414 174Z" fill="#8d543c" stroke="#282e29" strokeWidth="2"/>
                  <g transform="rotate(-7 270 233)">
                    <rect x="165" y="155" width="210" height="210" fill="#fffdf4" stroke="#282e29" strokeWidth="2"/>
                    <path d="M185 203H354M185 249H354M185 295H354" stroke="#b5b5a7"/>
                    <text x="185" y="184" fontFamily="Arial,sans-serif" fontSize="17" fontWeight="700" fill="#282e29">WEDNESDAY</text>
                    <g fontFamily="Arial,sans-serif" fontSize="16" fill="#282e29"><text x="214" y="232">The appointment</text><text x="214" y="278">The groceries</text><text x="214" y="324">Dinner together</text></g>
                    <g fill="none" stroke="#324e45" strokeWidth="2"><path d="M187 222l5 6 10-14M187 268l5 6 10-14M187 314l5 6 10-14"/></g>
                  </g>
                  <path d="M243 430L250 367L278 323Q287 313 294 321L285 352L311 344Q323 341 325 353L309 384L310 430" fill="#c4815b" stroke="#282e29" strokeWidth="2"/>
                  <path d="M227 430L239 391L322 401L329 430" fill="#324e45"/>
                </svg>
                <figcaption><span>01 / EVERYDAY CARE</span><span>A little help, shared.</span></figcaption>
              </figure>
            </section>
            <details className="optional-example"><summary>What happens if someone cancels? Try an example.</summary><Walkthrough start={demoStart} onExplore={() => go("plan")} /></details>

          </>
        )}
        {page === "plan" && (
          <>
            <div className="page-heading">
              <div className="eyebrow">THE WEEKLY PLAN</div>
              <div className="heading-row">
                <div>
                  <h1>{s.recipient}’s weekly plan</h1>
                  <p>
                    Select a task to update it.
                  </p>
                </div>
                <button className="primary" onClick={newTask}>
                  <Plus size={17} />
                  Add a task
                </button>
              </div>
            </div>
            <div className="week-toolbar">
              <div className="inline">
                <button
                  className="icon-button"
                  aria-label="Previous week"
                  onClick={() => {
                    W(dateAdd(week, -7));
                    D("all");
                  }}
                >
                  <ChevronLeft size={19} />
                </button>
                <b>
                  {dayLabel(week)} – {dayLabel(dateAdd(week, 6))}
                </b>
                <button
                  className="icon-button"
                  aria-label="Next week"
                  onClick={() => {
                    W(dateAdd(week, 7));
                    D("all");
                  }}
                >
                  <ChevronRight size={19} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    W(weekOf(today()));
                    D("all");
                  }}
                >
                  This week
                </button>
              </div>
              <span className="coverage-line">
                <Check size={16} />
                {confirmed.length} of {live.length} tasks confirmed
              </span>
            </div>
            {gaps.length > 0 ? (
              <div className="help-banner">
                <span className="banner-symbol">
                  <HelpCircle size={23} />
                </span>
                <div className="grow">
                  <b>
                    {gaps.length === 1
                      ? "One task needs a helping hand."
                      : `${gaps.length} tasks need a helping hand.`}
                  </b>
                  <p>Match tasks to available people.</p>
                </div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => s.caregivers.length ? repair() : go("people")}
                >
                  {busy ? "Checking availability…" : (s.caregivers.length ? "Find someone to help" : "Add people first")}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : pending.length > 0 ? (
              <div className="reply-note">
                <Clock size={20} />
                <span>
                  <b>{pending.length} tasks need a reply.</b>
                </span>
                <button onClick={() => {F("replies");D("all");}}>Review tasks <ArrowRight size={16}/></button>
              </div>
            ) : null}
            <div className="plan-controls">
              <div className="filter-tabs" aria-label="Filter tasks">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => F("all")}
                >
                  All tasks
                </button>
                <button
                  className={filter === "replies" ? "selected" : ""}
                  onClick={() => F("replies")}
                >
                  Needs a reply <span>{pending.length}</span>
                </button>
                <button
                  className={filter === "help" ? "selected" : ""}
                  onClick={() => F("help")}
                >
                  Needs help <span>{gaps.length}</span>
                </button>
              </div>
              <select
                aria-label="Show a day"
                value={day}
                onChange={(e) => D(e.target.value)}
              >
                <option value="all">Whole week</option>
                {Array.from({ length: 7 }, (_, i) => dateAdd(week, i)).map(
                  (d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ),
                )}
              </select>
            </div>
            <section className="agenda">
              {Array.from({ length: 7 }, (_, i) => dateAdd(week, i))
                .filter((d) => shown.some((t) => t.date === d))
                .map((d) => (
                  <div className="agenda-day" key={d}>
                    <div className="day-title">
                      <h2>{dayLabel(d)}</h2>
                      {d === today() && <span>Today</span>}
                    </div>
                    {shown
                      .filter((t) => t.date === d)
                      .sort(
                        (a, b) =>
                          (a.start ?? a.earliest) - (b.start ?? b.earliest),
                      )
                      .map(row)}
                  </div>
                ))}
              {!shown.length && (
                <div className="empty">
                  <HeartHandshake size={32} />
                  <h2>
                    {tasks.length
                      ? "Nothing to review here."
                      : "A fresh week to plan."}
                  </h2>
                  <p>
                    {tasks.length
                      ? "Try another filter to see your other tasks."
                      : "Start with one thing that needs doing."}
                  </p>
                  {!tasks.length && (
                    <button className="primary" onClick={newTask}>Add your first task <Plus size={16}/></button>
                  )}
                </div>
              )}
            </section>
            <details className="plan-tools"><summary>More planning options</summary><div className="plan-bottom"><button onClick={run} disabled={busy || !s.caregivers.length}>{busy ? "Planning…" : "Suggest assignments / add repeating tasks"}</button><button onClick={() => {SP(s.caregivers[0]?.id || "");SD(week);M("simulate");}} disabled={!s.caregivers.length}>Try someone being unavailable</button></div></details>
            <details className="secondary-panel">
              <summary>
                Repeating tasks <span>{s.templates.length}</span>
              </summary>
              <p>
                These create new tasks when you plan a week. Existing dates stay
                unchanged.
              </p>
              {s.templates.map((t) => (
                <div className="template-row" key={t.id}>
                  <div className="grow">
                    <b>{t.name}</b>
                    <small>
                      {t.days
                        .map(
                          (d) =>
                            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                              d
                            ],
                        )
                        .join(", ")}
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      TE(t);
                      T({
                        ...t,
                        date: week,
                        allowedDates: [week],
                        status: "unassigned",
                        excluded: [],
                      });
                      M("task");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      save(
                        {
                          ...s,
                          templates: s.templates.filter((x) => x.id !== t.id),
                        },
                        "Repeating task stopped. Existing dates were kept.",
                      )
                    }
                  >
                    Stop repeating
                  </button>
                </div>
              ))}
              {!s.templates.length && (
                <p>Choose repeat days when adding a task.</p>
              )}
            </details>
            <p className="workspace-note">
              Everyone in this room can edit the plan. Confirm assignments only after checking with the person.
            </p>
          </>
        )}
        {page === "people" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">THE PEOPLE BEHIND THE PLAN</span>
              <div className="heading-row">
                <div>
                  <h1>People who can help</h1>
                  <p>
                    Add a person and the times they’re free.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    C(undefined);
                    M("person");
                  }}
                >
                  <Plus size={17} />
                  Add a person
                </button>
              </div>
            </div>
            {s.caregivers.length > 0 && <div className="next-step"><span>People added. Now add what needs doing.</span><button className="primary" onClick={newTask}>Next: add a task <ArrowRight size={16}/></button></div>}
            <div className="people-list">
              {s.caregivers.map((c) => (
                <article className="person-card" key={c.id}>
                  <div className="person-heading">
                    <span
                      className="person-avatar"
                      style={{ background: c.color + "20", color: c.color }}
                    >
                      {c.name[0]}
                    </span>
                    <div className="grow">
                      <h2>{c.name}</h2>
                      <p>{c.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        C(c);
                        M("person");
                      }}
                    >
                      Edit availability <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="person-body">
                    <div>
                      <small>CAN HELP WITH</small>
                      <p>
                        {c.capabilities.length
                          ? c.capabilities.join(" · ")
                          : "Add what they can help with"}
                      </p>
                    </div>
                    <div>
                      <small>THIS WEEK</small>
                      <p>
                        <b>{hours(tasks, c.id).toFixed(1)} hours</b> assigned{" "}
                        <span className="muted">/ {c.maxHours} preferred</span>
                      </p>
                      <div className="workload-bar">
                        <div
                          style={{
                            width:
                              Math.min(
                                100,
                                (hours(tasks, c.id) / c.maxHours) * 100,
                              ) + "%",
                            background: c.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {!s.caregivers.length && (
                <div className="empty">
                  <Users size={32} />
                  <h2>Who can lend a hand?</h2>
                  <p>Add your first person and the times they’re available.</p>
                </div>
              )}
            </div>
            <p className="workspace-note">
              Hours include tasks waiting for a reply.
            </p>
          </>
        )}
        {page === "about" && (
          <section className="about-page">
            <span className="eyebrow">THE PURPOSE OF RELAY</span>
            <h1>
              Good intentions need
              <br />a workable plan.
            </h1>
            <p className="about-lead">
              Families often share rides, meals, errands, and time with someone
              they care about. When one person’s plans change, someone still has
              to figure out what happens next.
            </p>
            <div className="about-rule" />
            <h2>Relay helps answer one practical question.</h2>
            <blockquote>“Who can help now?”</blockquote>
            <p>
              It checks each person’s availability and abilities, avoids
              overlapping commitments, and moves flexible tasks when that makes
              room for something important. The family reviews the suggestion.
              The person helping accepts it.
            </p>
            <div className="about-points">
              <div>
                <Check size={20} />
                <p>
                  <b>Fewer uncovered tasks.</b>
                  <br />
                  Make gaps visible and find a workable next step.
                </p>
              </div>
              <div>
                <Users size={20} />
                <p>
                  <b>Responsibility shared more thoughtfully.</b>
                  <br />
                  Consider each person’s time and preferred hours.
                </p>
              </div>
              <div>
                <HeartHandshake size={20} />
                <p>
                  <b>People make the final decision.</b>
                  <br />A proposed assignment is never treated as a promise.
                </p>
              </div>
            </div>
            <details>
              <summary>What makes the scheduling work?</summary>
              <p>
                Relay uses a deterministic scheduling algorithm, not a chatbot.
                It evaluates valid combinations of people and times, compares
                partial plans, and favors coverage, fewer changes, and
                manageable workloads. It can show different solutions, and it
                says when a task cannot be covered.
              </p>
              <p>
                The interactive example runs this same engine. Its results are
                calculated from the fictional family’s availability and tasks.
              </p>
            </details>
            <details>
              <summary>What can I do with Relay?</summary>
              <p>
                Create and edit tasks, repeat them weekly, manage availability,
                generate schedules, handle cancellations, compare replacement
                plans, and record confirmations.
              </p>
              <p>
                Your plan is saved to your account and shared with room members.
                Updates appear while the plan is open. Relay does not send text
                messages or push notifications. It is for everyday, nonclinical assistance.
              </p>
            </details>
            <div className="project-credit">
              <span className="creator-initials">AC</span>
              <div>
                <b>Alessio Capelli</b>
                <p>Relay · Congressional App Challenge project</p>
              </div>
            </div>
            <button
              className="primary"
              onClick={() => {
                go("plan");
              }}
            >
              Back to my plan <ArrowRight size={17} />
            </button>
          </section>
        )}
        {page === "activity" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">RECENT CHANGES</span>
              <h1>What changed, and why.</h1>
            </div>
            <div className="activity-list">
              {s.activity.map((a) => (
                <article key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <b>{a.text}</b>
                    <small>{new Date(a.at).toLocaleString()}</small>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {page === "settings" && (
          <section className="settings-page">
            <span className="eyebrow">YOUR CARE PLAN</span>
            <h1>A few practical details.</h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                save(
                  {
                    ...s,
                    recipient: String(data.get("recipient")).trim(),
                    preferences: String(data.get("preferences")),
                  },
                  "Care profile saved.",
                );
              }}
            >
              <label>
                Who is the care plan for?
                <input name="recipient" required defaultValue={s.recipient} />
              </label>
              <label>
                Anything the family should keep in mind?
                <textarea name="preferences" defaultValue={s.preferences} />
              </label>
              <p className="field-help">
                These are notes for the family. Task times and availability
                guide the scheduling.
              </p>
              <button className="primary">Save details</button>
            </form>
            <div className="settings-divider">
              <h2>Your shared plan</h2>
              <p>
                Changes save automatically to this room. Download a copy for your records.
              </p>
              <button onClick={exportData}>
                <Download size={16} />
                Download a backup
              </button>
            </div>

          </section>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">relay.</span>
          <span>A project by Alessio Capelli</span>
        </div>
        <div className="footer-links">
          <button onClick={() => go("about")}>About</button>
          <button onClick={() => go("activity")}>Recent changes</button>
          <button onClick={() => go("settings")}>Settings</button>
        </div>
      </footer>
      {modal && (
        <div className="overlay" onClick={() => M(null)}>
          <section
            className={"dialog " + (modal === "repair" ? "repair-dialog" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "repair"
                ? "Review replacement plan"
                : modal === "setup"
                  ? "Start a care plan"
                  : "Care details"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close icon-button"
              aria-label="Close dialog"
              onClick={() => M(null)}
            >
              <X size={20} />
            </button>
            {modal === "task" && (
              <TaskEditor
                task={edit}
                repeatDays={template?.days}
                people={s.caregivers}
                onSave={saveTask}
                onClose={() => M(null)}
              />
            )}
            {modal === "person" && (
              <PersonEditor
                person={person}
                people={s.caregivers}
                onClose={() => M(null)}
                onSave={(p) => {
                  if (p.availability.some((w) => w.start >= w.end)) {
                    N("Availability needs an end time after its start.");
                    return;
                  }
                  save(
                    {
                      ...s,
                      caregivers: person
                        ? s.caregivers.map((c) => (c.id === p.id ? p : c))
                        : [...s.caregivers, p],
                    },
                    `${p.name}’s availability saved.`,
                  );
                  M(null);
                }}
              />
            )}
            {modal === "detail" && edit && (
              <>
                <span className="eyebrow">{edit.category.toUpperCase()}</span>
                <h2>{edit.name}</h2>
                <div className="detail-when">
                  {dayLabel(edit.date)} ·{" "}
                  {friendlyTime(edit.start ?? edit.earliest)}
                  <small>
                    {edit.duration} minutes ·{" "}
                    {edit.fixed ? "Fixed time" : "Flexible time"}
                  </small>
                </div>
                <div className="detail-person">
                  <span
                    className="person-avatar"
                    style={{
                      background: who(edit.caregiver)?.color + "20",
                      color: who(edit.caregiver)?.color,
                    }}
                  >
                    {who(edit.caregiver)?.name[0] || "?"}
                  </span>
                  <div className="grow">
                    <b>
                      {who(edit.caregiver)?.name || "This task needs someone"}
                    </b>
                    <p>
                      {needsHelp(edit)
                        ? "Find a new person to help."
                        : edit.status === "completed"
                          ? "This task is finished."
                          : edit.status === "cancelled"
                            ? "This task has been cancelled."
                            : ["proposed", "pending"].includes(edit.status)
                              ? "The plan is waiting for their reply."
                              : "They have accepted this task."}
                    </p>
                  </div>
                  <span
                    className={
                      "status " + (needsHelp(edit) ? "unassigned" : edit.status)
                    }
                  >
                    {needsHelp(edit) ? "Needs help" : statusText[edit.status]}
                  </span>
                </div>
                {issues.find((i) => i.task.id === edit.id) && (
                  <p className="warning">
                    {issues
                      .find((i) => i.task.id === edit.id)
                      ?.reasons.join(". ")}
                  </p>
                )}
                {edit.description && <p>{edit.description}</p>}
                {edit.notes && <p>{edit.notes}</p>}
                {["proposed", "pending"].includes(edit.status) &&
                  !needsHelp(edit) && (
                    <div className="response-box">
                      <small>CONFIRM AVAILABILITY</small>
                      <p>Record {who(edit.caregiver)?.name}’s response after checking with them.</p>
                      <div className="inline">
                        <button
                          className="primary"
                          onClick={() => respond(edit, "confirmed")}
                        >
                          <Check size={17} />Confirm
                        </button>
                        <button onClick={() => respond(edit, "declined")}>
                          Decline
                        </button>
                      </div>
                    </div>
                  )}
                {edit.status === "confirmed" && !needsHelp(edit) && (
                  <div className="detail-actions">
                    <button
                      className="primary"
                      onClick={() => respond(edit, "completed")}
                    >
                      <Check size={17} />
                      Mark as done
                    </button>
                    <button onClick={() => cancel(edit)}>
                      Cancel assignment
                    </button>
                  </div>
                )}
                {needsHelp(edit) && (
                  <button
                    className="primary full"
                    disabled={busy}
                    onClick={() => s.caregivers.length ? repair() : go("people")}
                  >
                    {busy ? "Finding a replacement…" : (s.caregivers.length ? "Find someone to help" : "Add people first")}
                    <ArrowRight size={17} />
                  </button>
                )}
                <details>
                  <summary>Edit or manage this task</summary>
                  <p className="field-help">
                    Editing a task clears its assignment so the updated time and
                    requirements can be checked again.
                  </p>
                  <div className="manage-actions">
                    <button
                      onClick={() => {
                        TE(undefined);
                        M("task");
                      }}
                    >
                      Edit task
                    </button>
                    <button
                      onClick={() => {
                        T({
                          ...edit,
                          id: uid(),
                          templateId: undefined,
                          caregiver: undefined,
                          start: undefined,
                          status: "unassigned",
                          name: edit.name + " (copy)",
                        });
                        TE(undefined);
                        M("task");
                      }}
                    >
                      Make a copy
                    </button>
                    <button onClick={() => respond(edit, "cancelled")}>
                      Cancel task
                    </button>
                    <button
                      className="danger-text"
                      onClick={() => {
                        if (confirm("Delete this task?")) {
                          save(
                            {
                              ...s,
                              tasks: s.tasks.filter((t) => t.id !== edit.id),
                            },
                            `${edit.name} deleted.`,
                          );
                          M(null);
                        }
                      }}
                    >
                      Delete task
                    </button>
                  </div>
                </details>
              </>
            )}
            {modal === "repair" && (
              <RepairReview
                plans={plans}
                before={before}
                people={simPeople}
                simulation={simulation}
                onApply={apply}
                onClose={() => M(null)}
              />
            )}
            {modal === "setup" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!setupName.trim()) return;
                  save(
                    {
                      ...s,
                      onboarded: true,
                      recipient: setupName.trim(),
                      tasks: [],
                      templates: [],
                      caregivers: [],
                      needs: [],
                      preferences: "",
                    },
                    `${setupName.trim()}’s plan is ready. Add the first person who can help.`,
                  );
                  M(null);
                  go("people");
                }}
              >
                <span className="eyebrow">START SMALL</span>
                <h2>Who are you caring for?</h2>
                <p>
                  A first name is enough.
                </p>
                <label>
                  Preferred name
                  <input
                    required
                    autoComplete="off"
                    value={setupName}
                    placeholder="e.g. Elena"
                    onChange={(e) => SN(e.target.value)}
                  />
                </label>
                <p className="field-help">
                  This starts a new plan in this browser. Your existing plan
                  will be replaced; you can undo this change.
                </p>
                <footer>
                  <button type="button" onClick={() => M(null)}>
                    Go back
                  </button>
                  <button className="primary">
                    Next: add people <ArrowRight size={16} />
                  </button>
                </footer>
              </form>
            )}
            {modal === "simulate" && (
              <>
                <span className="eyebrow">PLAN AHEAD</span>
                <h2>What if someone can’t make it?</h2>
                <p>Try an absence without changing your saved schedule.</p>
                <label>
                  Who is unavailable?
                  <select
                    value={simPerson}
                    onChange={(e) => SP(e.target.value)}
                  >
                    {s.caregivers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Which day?
                  <input
                    type="date"
                    min={week}
                    max={dateAdd(week, 6)}
                    value={simDate}
                    onChange={(e) => SD(e.target.value)}
                  />
                </label>
                <footer>
                  <button onClick={() => M(null)}>Go back</button>
                  <button
                    className="primary"
                    disabled={busy || !simPerson}
                    onClick={() => {
                      if (weekOf(simDate) !== week) {
                        N("Choose a date in the displayed week.");
                        return;
                      }
                      repair(true);
                    }}
                  >
                    {busy ? "Checking options…" : "See what could change"}
                    <ArrowRight size={16} />
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          {undo && (
            <button
              onClick={() => {
                S(undo);
                U(undefined);
                PL([]);
                N("Change undone.");
              }}
            >
              <RotateCcw size={14} />
              Undo
            </button>
          )}
          <button aria-label="Dismiss message" onClick={() => N("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

