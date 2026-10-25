import { useState } from "react";
import {
  Task,
  Caregiver,
  categories,
  uid,
  today,
  time,
  minutes,
  dateAdd,
  weekOf,
} from "../models";
export function TaskForm({
  task,
  people,
  repeatDays,
  onSave,
  onClose,
}: {
  task?: Task;
  people: Caregiver[];
  repeatDays?: number[];
  onSave: (t: Task, days: number[]) => void;
  onClose: () => void;
}) {
  const [t, S] = useState<Task>(
    task || {
      id: uid(),
      name: "",
      description: "",
      category: "Companionship",
      date: today(),
      allowedDates: [today()],
      duration: 60,
      earliest: 900,
      latest: 1080,
      fixed: false,
      priority: "normal",
      required: ["Companionship"],
      preferred: "",
      buffer: 0,
      notes: "",
      status: "unassigned",
      excluded: [],
    },
  );
  const [days, D] = useState(repeatDays || []);
  const patch = (v: Partial<Task>) => S({ ...t, ...v });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          { ...t, latest: t.fixed ? t.earliest + t.duration : t.latest },
          days,
        );
      }}
    >
      <span className="eyebrow">
        {repeatDays ? "REPEATING TASK" : "A LITTLE HELP, PLANNED"}
      </span>
      <h2>{task ? "Edit this task." : "What needs doing?"}</h2>
      <p>Add the basics. Relay will help work out who can do it.</p>
      <label>
        Task name
        <input
          required
          placeholder="e.g. Pick up groceries"
          value={t.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>
      <div className="formgrid">
        <label>
          Type of help
          <select
            value={t.category}
            onChange={(e) =>
              patch({ category: e.target.value, required: [e.target.value] })
            }
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Day
          <input
            required
            type="date"
            value={t.date}
            onChange={(e) =>
              patch({ date: e.target.value, allowedDates: [e.target.value] })
            }
          />
        </label>
      </div>
      <label>Does it need to happen at a specific time?</label>
      <div className="chips">
        <button
          type="button"
          className={t.fixed ? "selected" : ""}
          onClick={() => patch({ fixed: true })}
        >
          Yes, a fixed time
        </button>
        <button
          type="button"
          className={!t.fixed ? "selected" : ""}
          onClick={() => patch({ fixed: false })}
        >
          No, it’s flexible
        </button>
      </div>
      <div className="formgrid">
        <label>
          {t.fixed ? "Start time" : "Any time after"}
          <input
            type="time"
            required
            value={time(t.earliest)}
            onChange={(e) => patch({ earliest: minutes(e.target.value) })}
          />
        </label>
        {!t.fixed && (
          <label>
            Finished by
            <input
              type="time"
              required
              value={time(t.latest)}
              onChange={(e) => patch({ latest: minutes(e.target.value) })}
            />
          </label>
        )}
        <label>
          How many minutes?
          <input
            type="number"
            min="15"
            max="720"
            required
            value={t.duration}
            onChange={(e) => patch({ duration: +e.target.value })}
          />
        </label>
      </div>
      <details
        className="advanced-fields"
        open={repeatDays !== undefined ? true : undefined}
      >
        <summary>Repeat, add notes, or adjust preferences</summary>
        {(!task || repeatDays) && (
          <>
            <label>Repeat each week on</label>
            <div className="days">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className={days.includes(i) ? "selected" : ""}
                  onClick={() =>
                    D(
                      days.includes(i)
                        ? days.filter((x) => x !== i)
                        : [...days, i],
                    )
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
        {!t.fixed && (
          <label>
            Can move to another day, up to
            <input
              type="date"
              min={t.date}
              max={dateAdd(weekOf(t.date), 6)}
              value={t.allowedDates.at(-1) || t.date}
              onChange={(e) =>
                patch({
                  allowedDates: Array.from({ length: 7 }, (_, i) =>
                    dateAdd(t.date, i),
                  ).filter(
                    (d) => d <= e.target.value && weekOf(d) === weekOf(t.date),
                  ),
                })
              }
            />
          </label>
        )}
        <div className="formgrid">
          <label>
            Preferred person
            <select
              value={t.preferred}
              onChange={(e) => patch({ preferred: e.target.value })}
            >
              <option value="">Anyone who can help</option>
              {people.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={t.priority}
              onChange={(e) =>
                patch({ priority: e.target.value as Task["priority"] })
              }
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Travel / preparation minutes
            <input
              type="number"
              min="0"
              max="120"
              value={t.buffer}
              onChange={(e) => patch({ buffer: +e.target.value })}
            />
          </label>
        </div>
        <p className="field-help">
          Extra time is reserved before and after the task.
        </p>
        <label>Skills needed</label>
        <div className="chips">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              className={t.required.includes(c) ? "selected" : ""}
              onClick={() =>
                patch({
                  required: t.required.includes(c)
                    ? t.required.filter((x) => x !== c)
                    : [...t.required, c],
                })
              }
            >
              {c}
            </button>
          ))}
        </div>
        <label>
          Description
          <textarea
            value={t.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
        <label>
          Notes for the person helping
          <textarea
            value={t.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
      </details>
      <footer>
        <button type="button" onClick={onClose}>
          Go back
        </button>
        <button className="primary">Save task</button>
      </footer>
    </form>
  );
}
