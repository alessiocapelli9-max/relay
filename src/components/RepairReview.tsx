import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Caregiver, Task, dayLabel } from "../models";
import { active, alternatives, explain, hours } from "../engine/scheduler";
import { friendlyTime } from "./Walkthrough";
export function RepairReview({
  plans,
  before,
  people,
  simulation,
  onApply,
  onClose,
}: {
  plans: ReturnType<typeof alternatives>;
  before: Task[];
  people: Caregiver[];
  simulation: boolean;
  onApply: (i: number) => void;
  onClose: () => void;
}) {
  const [selected, select] = useState(0),
    plan = plans[selected];
  const describe = (t: Task) =>
    `${people.find((c) => c.id === t.caregiver)?.name || "No one assigned"} · ${dayLabel(t.date)}${t.start === undefined ? "" : ` at ${friendlyTime(t.start)}`}`;
  return (
    <>
      <span className="eyebrow">
        {simulation ? "WHAT-IF EXAMPLE" : "REVIEW A NEW PLAN"}
      </span>
      <h2>
        {plan
          ? "Here’s a way to keep care covered."
          : "This needs a human hand."}
      </h2>
      <p>
        {simulation
          ? "This is a preview. Your saved plan will not change."
          : "Review the changes below. Anyone taking on a changed task will still need to accept."}
      </p>
      {plan ? (
        <>
          <div className="repair-summary">
            <Check size={18} />
            <span>
              <b>
                {plan.tasks.filter(active).length} of{" "}
                {plan.tasks.filter((t) => t.status !== "cancelled").length}{" "}
                tasks covered.
              </b>{" "}
              {plan.changes.length}{" "}
              {plan.changes.length === 1 ? "change" : "changes"} to review.
            </span>
          </div>
          <div className="repair-changes">
            {plan.changes.length ? (
              plan.changes.map((t) => (
                <article key={t.id}>
                  <h3>{t.name}</h3>
                  <div className="before-after">
                    <div>
                      <small>BEFORE</small>
                      <p>{describe(before.find((x) => x.id === t.id)!)}</p>
                    </div>
                    <ArrowRight size={18} />
                    <div>
                      <small>NEW PLAN</small>
                      <p>{describe(t)}</p>
                    </div>
                  </div>
                  <p className="reason-text">{explain(t, people)}</p>
                </article>
              ))
            ) : (
              <p>No assignment changes are needed.</p>
            )}
          </div>
          {plan.tasks.some((t) => !active(t) && t.status !== "cancelled") && (
            <p className="warning">
              Some tasks still need help. Review availability or ask a backup
              caregiver.
            </p>
          )}
          <details>
            <summary>See each person’s hours</summary>
            <div className="hours-list">
              {people.map((c) => (
                <div key={c.id}>
                  <b>{c.name}</b>
                  <span>
                    {hours(plan.tasks, c.id).toFixed(1)}h / {c.maxHours}h
                    preferred
                  </span>
                </div>
              ))}
            </div>
          </details>
          {plans.length > 1 && (
            <details>
              <summary>
                Compare {plans.length - 1} other{" "}
                {plans.length === 2 ? "option" : "options"}
              </summary>
              <div className="option-list">
                {plans.map((p, i) => (
                  <button
                    className={selected === i ? "selected" : ""}
                    onClick={() => select(i)}
                    key={p.name}
                  >
                    <span>{p.name}</span>
                    <small>
                      {p.changes.length} changes ·{" "}
                      {p.tasks.filter(active).length} covered
                    </small>
                  </button>
                ))}
              </div>
            </details>
          )}
          <footer>
            <button onClick={onClose}>Keep the current plan</button>
            {!simulation && (
              <button className="primary" onClick={() => onApply(selected)}>
                Use this plan <ArrowRight size={16} />
              </button>
            )}
          </footer>
        </>
      ) : (
        <>
          <p>
            Relay couldn’t find a valid plan with the current availability and
            task requirements. Adjust these details or contact an approved
            backup.
          </p>
          <footer>
            <button onClick={onClose}>Back to the plan</button>
          </footer>
        </>
      )}
    </>
  );
}
