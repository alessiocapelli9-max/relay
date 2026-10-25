export type Status =
  | "proposed"
  | "pending"
  | "confirmed"
  | "declined"
  | "completed"
  | "cancelled"
  | "unassigned";
export const categories = [
  "Driving",
  "Errands",
  "Meals",
  "Household",
  "Companionship",
];
export type Window = { day: number; start: number; end: number };
export type Caregiver = {
  id: string;
  name: string;
  role: string;
  color: string;
  maxHours: number;
  capabilities: string[];
  preferences: string[];
  availability: Window[];
  exceptions: { date: string; start: number; end: number }[];
  backups: string[];
};
export type Task = {
  id: string;
  templateId?: string;
  name: string;
  description: string;
  category: string;
  date: string;
  allowedDates: string[];
  duration: number;
  earliest: number;
  latest: number;
  fixed: boolean;
  priority: "high" | "normal";
  required: string[];
  preferred: string;
  buffer: number;
  notes: string;
  caregiver?: string;
  start?: number;
  status: Status;
  excluded: string[];
};
export type Template = Omit<
  Task,
  | "date"
  | "allowedDates"
  | "templateId"
  | "caregiver"
  | "start"
  | "status"
  | "excluded"
> & { days: number[] };
export type State = {
  version: 1;
  onboarded: boolean;
  recipient: string;
  needs: string[];
  preferences: string;
  recurring: boolean;
  caregivers: Caregiver[];
  tasks: Task[];
  templates: Template[];
  activity: { id: string; at: string; text: string; read: boolean }[];
};
export const uid = () => crypto.randomUUID();
export const dateAdd = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDate(d);
};
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const weekOf = (date: string) => {
  const d = new Date(date + "T12:00:00");
  return dateAdd(date, -((d.getDay() + 6) % 7));
};
export const today = () => localDate(new Date());
export const time = (m: number = 0) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const dayLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
