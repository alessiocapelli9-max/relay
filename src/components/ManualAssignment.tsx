import { useState } from "react";
import { Caregiver, Task, dayLabel } from "../models";
import { assignmentBlockers, candidates } from "../engine/scheduler";
import { friendlyTime } from "./Walkthrough";

export function ManualAssignment({task, people, schedule, onAssign, onPeople}: {
  task: Task; people: Caregiver[]; schedule: Task[];
  onAssign: (personId: string, date: string, start: number) => void;
  onPeople: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [slot, setSlot] = useState("");
  const options = candidates(task, people, schedule);
  const eligible = people.filter(p => options.some(o => o.caregiver === p.id));
  const times = options.filter(o => o.caregiver === personId).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const chosen = times.find(o => `${o.date}:${o.start}` === slot);
  const unchanged = chosen?.caregiver === task.caregiver && chosen?.date === task.date && chosen?.start === task.start;
  const unavailable = people.filter(p => !eligible.includes(p));
  return <details className="manual-assignment">
    <summary>{task.caregiver ? "Choose a different person or time" : "Choose someone yourself"}</summary>
    {eligible.length ? <form onSubmit={e => {e.preventDefault(); if (chosen && !unchanged) onAssign(chosen.caregiver, chosen.date, chosen.start);}}>
      <div className="formgrid">
        <label>Person<select required value={personId} onChange={e => {
          setPersonId(e.target.value);
          const first = options.find(o => o.caregiver === e.target.value);
          setSlot(first ? `${first.date}:${first.start}` : "");
        }}><option value="">Choose someone</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Available time<select required disabled={!personId} value={slot} onChange={e => setSlot(e.target.value)}>
          {!personId && <option value="">Choose a person first</option>}
          {times.map(o => <option key={`${o.date}:${o.start}`} value={`${o.date}:${o.start}`}>{dayLabel(o.date)} at {friendlyTime(o.start)}</option>)}
        </select></label>
      </div>
      <p className="field-help">These options match the task’s requirements and everyone’s availability.</p>
      <button className="primary" disabled={!chosen || unchanged}>{unchanged ? "Already assigned" : chosen ? `Assign ${people.find(p => p.id === personId)?.name}` : "Assign person"}</button>
    </form> : <p>No one currently meets this task’s requirements and available times.</p>}
    {!!unavailable.length && <details><summary>Why others aren’t available</summary><ul>{assignmentBlockers(task, unavailable, schedule).map(b => <li key={b.person!.id}><b>{b.person!.name}:</b> {b.reason}</li>)}</ul></details>}
    {!eligible.length && <button onClick={onPeople}>{people.length ? "Edit people’s availability and abilities" : "Add a person"}</button>}
  </details>;
}
