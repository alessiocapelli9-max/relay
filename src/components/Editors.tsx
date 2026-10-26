import { useState } from "react";
import {
  Task,
  Caregiver,
  categories,
  time,
  minutes,
  uid,
  today,
  dateAdd,
  weekOf,
} from "../models";
export function PersonEditor({
  person,
  people,
  onSave,
  onClose,
}: {
  person?: Caregiver;
  people: Caregiver[];
  onSave: (p: Caregiver) => void;
  onClose: () => void;
}) {
  const [p, S] = useState<Caregiver>(
    person || {
      id: uid(),
      name: "",
      role: "Family member",
      color: "#367d70",
      maxHours: 8,
      capabilities: [],
      preferences: [],
      availability: [],
      exceptions: [],
      backups: [],
    },
  );
  const patch = (v: Partial<Caregiver>) => S({ ...p, ...v });
  const [ex, E] = useState(today());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(p);
      }}
    >
      <h2>{person ? `About ${person.name}` : "Who can help?"}</h2>
      <div className="formgrid">
        <label>
          Name
          <input
            required
            value={p.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label>
          Relationship
          <input
            value={p.role}
            onChange={(e) => patch({ role: e.target.value })}
          />
        </label>
        <label>
          Preferred maximum hours / week
          <input
            type="number"
            min="1"
            max="100"
            required
            value={p.maxHours}
            onChange={(e) => patch({ maxHours: +e.target.value })}
          />
        </label>
        <label>
          Profile color
          <input
            type="color"
            value={p.color}
            onChange={(e) => patch({ color: e.target.value })}
          />
        </label>
      </div>
      <label>Can help with</label>
      <div className="chips">
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            className={p.capabilities.includes(c) ? "selected" : ""}
            aria-pressed={p.capabilities.includes(c)}
            onClick={() =>
              patch({
                capabilities: p.capabilities.includes(c)
                  ? p.capabilities.filter((x) => x !== c)
                  : [...p.capabilities, c],
              })
            }
          >
            {c}
          </button>
        ))}
      </div>
      {!p.capabilities.length && <p className="muted">Select the kinds of tasks this person can help with so Relay can assign matching tasks.</p>}
      <label>Weekly availability</label>
      {!p.availability.length && <p className="muted">Choose at least one day and time when this person can help before assigning tasks.</p>}
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, day) => {
        const w = p.availability.find((x) => x.day === day);
        return (
          <div className="availability" key={d}>
            <label className="check">
              <input
                type="checkbox"
                checked={!!w}
                onChange={() =>
                  patch({
                    availability: w
                      ? p.availability.filter((x) => x.day !== day)
                      : [...p.availability, { day, start: 540, end: 1080 }],
                  })
                }
              />
              {d}
            </label>
            {w && (
              <>
                <input
                  aria-label={`${d} start`}
                  type="time"
                  value={time(w.start)}
                  onChange={(e) =>
                    patch({
                      availability: p.availability.map((x) =>
                        x.day === day
                          ? { ...x, start: minutes(e.target.value) }
                          : x,
                      ),
                    })
                  }
                />
                <span>to</span>
                <input
                  aria-label={`${d} end`}
                  type="time"
                  value={time(w.end)}
                  onChange={(e) =>
                    patch({
                      availability: p.availability.map((x) =>
                        x.day === day
                          ? { ...x, end: minutes(e.target.value) }
                          : x,
                      ),
                    })
                  }
                />
              </>
            )}
          </div>
        );
      })}
      <details className="advanced-fields">
        <summary>Preferences, backups, and days off</summary>
        <label>Preferred tasks</label>
        <div className="chips">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              className={p.preferences.includes(c) ? "selected" : ""}
              onClick={() =>
                patch({
                  preferences: p.preferences.includes(c)
                    ? p.preferences.filter((x) => x !== c)
                    : [...p.preferences, c],
                })
              }
            >
              {c}
            </button>
          ))}
        </div>
        <label>Approved backups</label>
        <div className="chips">
          {people
            .filter((c) => c.id !== p.id)
            .map((c) => (
              <button
                type="button"
                key={c.id}
                className={p.backups.includes(c.id) ? "selected" : ""}
                onClick={() =>
                  patch({
                    backups: p.backups.includes(c.id)
                      ? p.backups.filter((x) => x !== c.id)
                      : [...p.backups, c.id],
                  })
                }
              >
                {c.name}
              </button>
            ))}
        </div>
        <label>Unavailable date</label>
        <div className="inline">
          <input type="date" value={ex} onChange={(e) => E(e.target.value)} />
          <button
            type="button"
            onClick={() =>
              patch({
                exceptions: [
                  ...p.exceptions,
                  { date: ex, start: 0, end: 1440 },
                ],
              })
            }
          >
            Add day off
          </button>
        </div>
        {p.exceptions.map((x, i) => (
          <button
            type="button"
            key={i}
            onClick={() =>
              patch({ exceptions: p.exceptions.filter((_, j) => j !== i) })
            }
          >
            {x.date} ×
          </button>
        ))}
      </details>
      <footer>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary">Save person</button>
      </footer>
    </form>
  );
}
