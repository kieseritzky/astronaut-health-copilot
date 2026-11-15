import { useEffect, useMemo, useRef, useState } from "react";
import logoImage from "../logo.svg";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BatteryCharging,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  CloudOff,
  HeartPulse,
  History,
  House,
  Link2,
  Menu,
  MessageSquareText,
  Moon,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  Signal,
  Siren,
  Stethoscope,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type Level = "Green" | "Yellow" | "Orange" | "Red";
type TabId = "dashboard" | "checkup" | "symptoms" | "emergency" | "library" | "crew" | "earth";
type ReadingKey = "hr" | "spo2" | "sys" | "dia" | "temp" | "rr";
type Readings = Partial<Record<ReadingKey, number>>;
type HealthEntry = {
  id: string;
  day: number;
  level: Level;
  readings: Readings;
  source: string;
  timestamp: string;
};
type Report = {
  id: string;
  timestamp: string;
  level: Level;
  summary: string;
};
type LogEntry = { timestamp: string; summary: string; hash: string; previousHash: string };
type Profile = { name: string; allergies: string; medication: string };

const LEVELS: Level[] = ["Green", "Yellow", "Orange", "Red"];
const LEVEL_STYLES: Record<Level, { text: string; border: string; dot: string; tint: string }> = {
  Green: { text: "text-emerald-300", border: "border-emerald-400/40", dot: "bg-emerald-400", tint: "bg-emerald-400/10" },
  Yellow: { text: "text-amber-300", border: "border-amber-400/40", dot: "bg-amber-400", tint: "bg-amber-400/10" },
  Orange: { text: "text-orange-300", border: "border-orange-400/40", dot: "bg-orange-400", tint: "bg-orange-400/10" },
  Red: { text: "text-rose-300", border: "border-rose-400/40", dot: "bg-rose-400", tint: "bg-rose-400/10" },
};

const NAV: { id: TabId; title: string; subtitle: string; icon: typeof House }[] = [
  { id: "dashboard", title: "Flight deck", subtitle: "Mission overview", icon: House },
  { id: "checkup", title: "Daily checkup", subtitle: "Measurements", icon: Activity },
  { id: "symptoms", title: "Symptom triage", subtitle: "I feel unwell", icon: Stethoscope },
  { id: "emergency", title: "Emergency", subtitle: "Crew rescue steps", icon: Siren },
  { id: "library", title: "Medical library", subtitle: "Causes and care", icon: BookOpen },
  { id: "crew", title: "Crew records", subtitle: "Profile and history", icon: Users },
  { id: "earth", title: "Ground link", subtitle: "Reports to Earth", icon: Radio },
];

const READING_META: Record<ReadingKey, { label: string; unit: string; device: string; how: string }> = {
  hr: { label: "Heart rate", unit: "BPM", device: "Pulse oximeter", how: "Clip it on a fingertip and keep still until the number stops changing." },
  spo2: { label: "Blood oxygen", unit: "%", device: "Pulse oximeter", how: "Warm hands can improve a pulse oximeter reading." },
  sys: { label: "Blood pressure · top", unit: "mmHg", device: "Blood pressure monitor", how: "Sit still and use the cuff as directed by its manufacturer." },
  dia: { label: "Blood pressure · bottom", unit: "mmHg", device: "Blood pressure monitor", how: "Record the lower number from the same blood pressure reading." },
  temp: { label: "Temperature", unit: "°C", device: "Digital thermometer", how: "Use the thermometer as directed and wait for its signal." },
  rr: { label: "Breaths per minute", unit: "/min", device: "On-screen timer", how: "Count breaths for 30 seconds, then double the count." },
};
const READING_ORDER: ReadingKey[] = ["hr", "spo2", "sys", "dia", "temp", "rr"];

const CONDITIONS: Record<string, { symptoms: string[]; redFlags: string[]; readings: ReadingKey[] }> = {
  Head: {
    symptoms: ["Headache", "Dizziness", "Blurred vision", "Fainting or confusion"],
    redFlags: ["Fainting or confusion"],
    readings: ["hr", "sys", "dia", "temp"],
  },
  Chest: {
    symptoms: ["Mild chest tightness", "Fast heartbeat", "Short of breath", "Crushing chest pain", "Cannot speak full sentences", "Blue lips"],
    redFlags: ["Crushing chest pain", "Cannot speak full sentences", "Blue lips"],
    readings: ["spo2", "hr", "sys", "dia", "rr"],
  },
  Stomach: {
    symptoms: ["Nausea", "Cramps", "Not eating or drinking", "Vomiting blood"],
    redFlags: ["Vomiting blood"],
    readings: ["temp", "hr"],
  },
  "Arms & legs": {
    symptoms: ["Weakness", "Pain", "Swelling", "Cannot move a limb"],
    redFlags: ["Cannot move a limb"],
    readings: ["hr", "sys", "dia"],
  },
};

const EMERGENCY_STEPS: Record<string, string[]> = {
  "Crew member is unresponsive": [
    "Make sure the area is safe. Call the commander out loud now.",
    "Tap their shoulders and call their name. Do they respond?",
    "Look at the chest for 10 seconds. Are they breathing normally?",
    "If they are not breathing normally, send someone for the emergency kit and defibrillator and start CPR only as trained.",
    "If they are breathing, keep them secured, stay with them, and repeat the check every minute.",
    "Write down the time, what you saw, and what you did.",
  ],
  "Chest pain": [
    "Stop activity and help the crew member sit or secure themselves.",
    "Call the commander and ask a second crew member to assist.",
    "Use available monitoring equipment and follow the mission medical protocol.",
    "Give medication only as directed by the mission medical protocol.",
    "If they collapse, switch to the unresponsive crew member protocol.",
    "Record the time, symptoms, measurements, and actions taken.",
  ],
  "Trouble breathing": [
    "Help the crew member sit upright and secure themselves.",
    "Call the commander. Check cabin air alarms and follow the spacecraft safety procedure.",
    "Use available monitoring equipment and follow the mission medical protocol.",
    "Use emergency oxygen only as directed by the mission medical protocol.",
    "If breathing stops, switch to the unresponsive crew member protocol.",
    "Record the time, symptoms, measurements, and actions taken.",
  ],
};

const LIBRARY: Record<string, { watch: string; causes: string; action: string; crew: string }> = {
  "Heart & circulation": {
    watch: "Heart rate, blood pressure, chest pain, or fainting.",
    causes: "Stress, dehydration, fluid shifts, poor sleep, or too little exercise.",
    action: "Rest and follow the mission medical protocol. Report chest pain, fainting, or a very high or low pulse promptly.",
    crew: "Stay nearby, keep the person secured, note when symptoms began, and locate the required equipment.",
  },
  Breathing: {
    watch: "Oxygen level, breaths per minute, cough, or chest tightness.",
    causes: "Infection, cabin air concerns, dust, stress, or heart problems.",
    action: "Follow cabin air procedures and the mission medical protocol. Report breathing difficulty promptly.",
    crew: "Stay close, check alarms, and help the person follow mission procedures.",
  },
  "Mind & sleep": {
    watch: "Sleep hours, mood, reaction time, speech, or concentration.",
    causes: "Isolation, workload, light and sleep schedule, or mission stress.",
    action: "Protect sleep time, talk with a crewmate or support team, and report a steady decline.",
    crew: "Check in kindly, share tasks, and tell the commander if someone seems confused or unsafe.",
  },
  Radiation: {
    watch: "Daily dose, total dose, nausea, or unusual fatigue after an event.",
    causes: "Solar storms and cosmic rays beyond Earth's magnetic shield.",
    action: "Follow the mission radiation plan, use the designated shelter during an alert, and log symptoms.",
    crew: "Help everyone reach the designated shelter and report to the commander.",
  },
  "Bones & muscles": {
    watch: "Strength, exercise, back or leg pain, or new weakness.",
    causes: "Low gravity changes the workload on bones and muscles.",
    action: "Follow the scheduled exercise plan and report new pain or weakness.",
    crew: "Encourage routine exercise, help with tasks when needed, and report injuries.",
  },
  "Food & water": {
    watch: "Fluid intake, appetite, nausea, or body mass changes.",
    causes: "Dehydration, motion sickness, stress, or food fatigue.",
    action: "Follow the mission nutrition plan and report repeated vomiting or inability to drink.",
    crew: "Offer support, keep track of concerning changes, and tell the commander if symptoms persist.",
  },
};

const EMERGENCY_ACTION: Record<Level, string> = {
  Green: "Continue routine checkups and follow your mission plan.",
  Yellow: "Pause, repeat the measurement as directed by your mission protocol, and tell the commander if symptoms worsen.",
  Orange: "Tell the commander promptly and ask a crewmate to stay with you. Follow the mission medical protocol.",
  Red: "Open Emergency and follow the mission emergency protocol now. Do not wait for an Earth response.",
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initialValue));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Could not save ${key} to local storage.`, error);
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function getLevel(readings: Readings): { level: Level; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const flag = (severity: number, message: string) => {
    score = Math.max(score, severity);
    reasons.push(message);
  };
  if (readings.hr !== undefined) {
    if (readings.hr > 120 || readings.hr < 40) flag(3, "Heart rate is far outside the reference range entered in this demo.");
    else if (readings.hr > 100 || readings.hr < 50) flag(1, "Heart rate is outside the reference range entered in this demo.");
  }
  if (readings.spo2 !== undefined) {
    if (readings.spo2 < 90) flag(3, "Blood oxygen is very low in this demo's rule set.");
    else if (readings.spo2 < 94) flag(2, "Blood oxygen is low in this demo's rule set.");
  }
  if (readings.sys !== undefined) {
    if (readings.sys >= 180 || readings.sys < 80 || (readings.dia !== undefined && readings.dia >= 120)) {
      flag(3, "Blood pressure is far outside the reference range entered in this demo.");
    } else if (readings.sys >= 140 || (readings.dia !== undefined && readings.dia >= 90) || readings.sys < 90) {
      flag(1, "Blood pressure is outside the reference range entered in this demo.");
    }
  }
  if (readings.temp !== undefined) {
    if (readings.temp >= 39.5 || readings.temp < 35) flag(3, "Temperature is far outside the reference range entered in this demo.");
    else if (readings.temp >= 38) flag(1, "Temperature is elevated in this demo's rule set.");
  }
  if (readings.rr !== undefined) {
    if (readings.rr > 24 || readings.rr < 10) flag(3, "Breathing rate is far outside the reference range entered in this demo.");
    else if (readings.rr > 20) flag(1, "Breathing rate is elevated in this demo's rule set.");
  }
  return { level: LEVELS[score], reasons: reasons.length ? reasons : ["No entered reading crossed this demo's simple rule thresholds."] };
}

function makeMissionData() {
  return Array.from({ length: 90 }, (_, index) => {
    const day = index + 1;
    const drift = day < 35 ? 0 : (day - 35) / 55;
    const wave = Math.sin(day * 2.13) * 0.14 + Math.cos(day * 0.77) * 0.09;
    return {
      day,
      wellbeing: Math.max(0.25, 0.2 + drift * 1.65 + wave),
      sleep: 7 - drift * 1.6 + Math.sin(day) * 0.25,
      hrv: 55 - drift * 20 + Math.cos(day * 1.3) * 3,
      reaction: 280 + drift * 70 + Math.sin(day * 0.8) * 12,
      radiation: 0.6 + ((day * 17) % 11) / 100 + (day >= 60 && day <= 62 ? 2.5 : 0),
    };
  });
}
const MISSION = makeMissionData();

function IconButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "border-sky-300/30 bg-sky-400 text-slate-950 hover:bg-sky-300",
    secondary: "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
    danger: "border-rose-300/30 bg-rose-500 text-white hover:bg-rose-400",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass rounded-xl p-5 ${className}`}>{children}</section>;
}

function LevelBadge({ level, compact = false }: { level: Level; compact?: boolean }) {
  const style = LEVEL_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border ${style.border} ${style.tint} ${style.text} ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} font-bold`}>
      <i className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {level}
    </span>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">{eyebrow}</p>
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
    </div>
  );
}

function Ring({ value, label, color = "#7dd3fc", size = 118 }: { value: number; label: string; color?: string; size?: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(139,159,209,.16)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * clampedValue) / 100} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display-font text-2xl font-bold text-white">{Math.round(clampedValue)}%</span>
        <span className="text-[9px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function Dashboard({
  day,
  setDay,
  level,
  checkedToday,
  onCheckup,
}: {
  day: number;
  setDay: (day: number) => void;
  level: Level;
  checkedToday: boolean;
  onCheckup: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setDay(day >= 90 ? 1 : day + 1), 900);
    return () => window.clearInterval(timer);
  }, [day, playing, setDay]);
  const mission = MISSION[day - 1];
  const readiness = Math.max(28, Math.round(100 - mission.wellbeing * 23));
  const chartPoints = MISSION.map((row, index) => `${index * (540 / 89)},${130 - row.wellbeing * 35}`).join(" ");
  const activePoints = MISSION.slice(0, day).map((row, index) => `${index * (540 / 89)},${130 - row.wellbeing * 35}`).join(" ");
  const signals = [
    { label: "Sleep", value: `${mission.sleep.toFixed(1)} h`, icon: Moon, trend: mission.sleep > 6 ? "Within routine" : "Below routine", good: mission.sleep > 6 },
    { label: "HRV", value: `${Math.round(mission.hrv)} ms`, icon: HeartPulse, trend: day < 35 ? "Near baseline" : "Drifting", good: day < 35 },
    { label: "Reaction time", value: `${Math.round(mission.reaction)} ms`, icon: Activity, trend: day < 35 ? "Near baseline" : "Drifting", good: day < 35 },
  ];
  const accent = level === "Red" ? "#fb7185" : level === "Orange" ? "#fb923c" : level === "Yellow" ? "#fbbf24" : "#34d399";

  return (
    <div>
      {!checkedToday && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock3 size={17} className="text-amber-200" />
            <div><p className="text-sm font-bold text-amber-100">Daily check-in due</p></div>
          </div>
          <IconButton variant="secondary" onClick={onCheckup} className="border-amber-200/20 text-amber-100">Start checkup <ChevronRight size={15} /></IconButton>
        </div>
      )}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-sky-300/20 bg-[linear-gradient(115deg,rgba(24,44,88,.78),rgba(14,24,52,.88)_48%,rgba(54,34,81,.62))] p-5 sm:p-7">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border border-sky-200/10 bg-sky-300/[0.04] shadow-[0_0_80px_rgba(70,150,255,.1)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.23em] text-sky-200"><span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_#7dd3fc]" />Deep space health monitor</div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className={`display-font text-4xl font-bold sm:text-5xl ${LEVEL_STYLES[level].text}`}>{level}</h2>
              <LevelBadge level={level} />
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-300">Mission day {day} of 90 · Crew readiness based on mission signals.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <IconButton onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause mission" : "Play mission"}</IconButton>
              <IconButton variant="secondary" onClick={() => { setPlaying(false); setDay(1); }}><RotateCcw size={15} /> Restart</IconButton>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/25 p-4">
            <Ring value={readiness} label="Readiness" color={accent} />
            <div className="max-w-32"><p className="text-xs font-bold uppercase tracking-wider text-slate-300">Crew status</p><p className="mt-1 text-xs leading-5 text-slate-500">Score from the health trend.</p><div className="mt-3"><LevelBadge level={level} compact /></div></div>
          </div>
        </div>
        <div className="relative mt-7 flex items-center gap-4">
          <Sun size={15} className="text-sky-300" />
          <div className="relative h-1.5 flex-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-orange-400" style={{ width: `${((day - 1) / 89) * 100}%` }} />
            <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white shadow-[0_0_12px_#7dd3fc]" style={{ left: `${((day - 1) / 89) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-orange-200">Mars</span>
          <span className="w-16 text-right text-[11px] text-slate-400">Day {day}/90</span>
        </div>
        <input aria-label="Mission day" type="range" min="1" max="90" value={day} onChange={(event) => setDay(Number(event.target.value))} className="absolute bottom-1 left-0 h-1 w-full cursor-pointer opacity-0" />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Mission distance", value: `${Math.round((day / 90) * 78)}M km`, note: "Travel progress", icon: Activity },
          { label: "Earth signal delay", value: `${((day / 90) * 13.8).toFixed(1)} min`, note: "One-way estimate", icon: Radio },
          { label: "Radiation total", value: `${MISSION.slice(0, day).reduce((sum, item) => sum + item.radiation, 0).toFixed(1)} mSv`, note: "Simulated dose", icon: Shield },
          { label: "Days to arrival", value: `${90 - day}`, note: "Mars transfer", icon: Clock3 },
        ].map((item) => {
          const Icon = item.icon;
          return <Card key={item.label} className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="display-font mt-2 text-2xl font-bold text-white">{item.value}</p><p className="mt-1 text-[11px] text-slate-500">{item.note}</p></div><span className="rounded-lg border border-sky-300/10 bg-sky-300/[0.07] p-2 text-sky-200"><Icon size={16} /></span></div></Card>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-500">90-day observation</p><h3 className="mt-1 text-lg font-bold text-white">Wellbeing drift</h3></div>
            <span className="flex items-center gap-1 text-xs text-amber-200"><ArrowUpRight size={14} />Trend simulation</span>
          </div>
          <div className="h-44 overflow-hidden">
            <svg viewBox="0 0 540 150" preserveAspectRatio="none" className="h-full w-full">
              {[25, 55, 90].map((y) => <line key={y} x1="0" x2="540" y1={y} y2={y} stroke="rgba(148,163,184,.15)" strokeDasharray="4 5" />)}
              <polyline points={chartPoints} fill="none" stroke="rgba(148,163,184,.34)" strokeWidth="2" />
              <polyline points={activePoints} fill="none" stroke="#7dd3fc" strokeWidth="2.7" />
            </svg>
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-500"><span>Day 1</span><span>Day 30</span><span>Day 60</span><span>Day 90</span></div>
          
        </Card>
        <Card>
          <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-500">On-board telemetry</p><h3 className="mt-1 text-lg font-bold text-white">Signal health</h3></div>
          <div className="space-y-4">
            {signals.map(({ label, value, icon: Icon, trend, good }) => <div key={label} className="flex items-center gap-3"><div className="rounded-lg bg-white/[0.04] p-2 text-sky-200"><Icon size={16} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-200">{label}</span><span className="display-font text-sm font-bold text-white">{value}</span></div><div className="mt-1.5 h-1 rounded-full bg-white/[0.08]"><div className={`h-full rounded-full ${good ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.max(14, 100 - mission.wellbeing * 23)}%` }} /></div><p className={`mt-1 text-[10px] ${good ? "text-emerald-200/70" : "text-amber-200/70"}`}>{trend}</p></div></div>)}
          </div>
          <div className="mt-5 border-t border-white/[0.07] pt-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mission timeline</h4><span className="text-[10px] text-slate-500">90 days</span></div><div className="flex items-start justify-between gap-1">
            {[["Launch", 1], ["Baseline", 14], ["Solar event", 60], ["Mars", 90]].map(([label, at]) => <div key={label} className="flex-1 text-center"><div className={`mx-auto mb-2 h-2.5 w-2.5 rounded-full ${day >= Number(at) ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.55)]" : "border border-slate-500 bg-slate-800"}`} /><p className="text-[9px] text-slate-500">{label}</p><p className="text-[9px] text-slate-600">D{at}</p></div>)}
          </div></div>
        </Card>
      </div>
      
    </div>
  );
}

function Checkup({
  day,
  onSubmit,
  lastCheckup,
}: {
  day: number;
  onSubmit: (readings: Readings, source: string) => void;
  lastCheckup: HealthEntry | undefined;
}) {
  const [values, setValues] = useState<Partial<Record<ReadingKey, string>>>({});
  const [result, setResult] = useState<{ level: Level; reasons: string[] } | null>(null);
  const [reactionText, setReactionText] = useState("Run five rounds to establish a personal demo baseline.");
  const [reactionReady, setReactionReady] = useState(false);
  const [reactionActive, setReactionActive] = useState(false);
  const reactionStart = useRef(0);
  const reactionTimes = useRef<number[]>([]);
  const reactionTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
  }, []);

  const parsed = useMemo(() => Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value.trim() !== "")
      .map(([key, value]) => [key, Number(value)]),
  ) as Readings, [values]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (Object.keys(parsed).length === 0 || Object.values(parsed).some((value) => value === undefined || !Number.isFinite(value))) {
      setResult({ level: "Yellow", reasons: ["Enter at least one valid measurement before continuing."] });
      return;
    }
    const assessment = getLevel(parsed);
    setResult(assessment);
    onSubmit(parsed, "Daily checkup");
  }

  function nextReactionRound() {
    setReactionReady(false);
    setReactionActive(true);
    reactionTimer.current = window.setTimeout(() => {
      reactionStart.current = performance.now();
      setReactionReady(true);
    }, 850 + Math.random() * 1300);
  }

  function startReaction() {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
    reactionTimes.current = [];
    setReactionText("Wait for the signal...");
    nextReactionRound();
  }

  function reactToSignal() {
    if (!reactionActive) return;
    if (!reactionReady) {
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current);
      setReactionActive(false);
      setReactionText("Too early. Start again when you are ready.");
      return;
    }
    reactionTimes.current.push(performance.now() - reactionStart.current);
    if (reactionTimes.current.length < 5) {
      setReactionText(`Round ${reactionTimes.current.length} of 5 recorded.`);
      nextReactionRound();
      return;
    }
    const average = Math.round(reactionTimes.current.reduce((sum, value) => sum + value, 0) / 5);
    setReactionReady(false);
    setReactionActive(false);
    setReactionText(`Demo result: ${average} ms average across five rounds. This is not a clinical test.`);
  }

  return (
    <div>
      <SectionTitle eyebrow="Crew wellness · day check" title="Daily checkup" description="" />
      {lastCheckup && <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100/80"><BadgeCheck size={18} /><span>Last check-in saved for mission day {lastCheckup.day} ({new Date(lastCheckup.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).</span></div>}
      <form onSubmit={submit} className="space-y-3">
        {READING_ORDER.map((key) => {
          const item = READING_META[key];
          return <label key={key} className="glass flex flex-wrap items-center gap-4 rounded-xl p-4 sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/10 bg-sky-300/[0.06] text-sky-200"><Activity size={18} /></span>
            <span className="min-w-48 flex-1"><span className="block text-sm font-bold text-white">{item.label} <span className="ml-1 text-[10px] font-medium text-slate-500">{item.device}</span></span><span className="mt-1 block text-xs text-slate-500">{item.how}</span></span>
            <span className="flex items-center gap-2"><input aria-label={item.label} type="number" step="any" value={values[key] ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))} placeholder="—" className="w-28 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-right text-sm text-white placeholder:text-slate-700" /><span className="w-10 text-[10px] text-slate-500">{item.unit}</span></span>
          </label>;
        })}
        <div className="flex flex-wrap items-center gap-3 pt-2"><IconButton type="submit"><Check size={16} /> Check my readings</IconButton><span className="text-xs text-slate-500">Measurements are stored on this device.</span></div>
      </form>
      {result && <div className={`mt-5 rounded-xl border ${LEVEL_STYLES[result.level].border} ${LEVEL_STYLES[result.level].tint} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Demo assessment · mission day {day}</p><h3 className={`mt-1 text-xl font-bold ${LEVEL_STYLES[result.level].text}`}>{result.level} status</h3></div><LevelBadge level={result.level} /></div>
        <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-300">{result.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">{EMERGENCY_ACTION[result.level]} These rules are for demonstration only and do not diagnose or replace a qualified professional or mission protocol.</p>
      </div>}
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Optional cognitive check</p><h3 className="mt-1 text-lg font-bold text-white">Reaction test</h3><p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">Tap the test area when it changes to cyan. Complete five rounds.</p></div><IconButton variant="secondary" onClick={startReaction}><Play size={14} /> Start test</IconButton></div>
        <button type="button" onClick={reactToSignal} aria-live="polite" className={`mt-4 flex h-24 w-full items-center justify-center rounded-xl border text-sm font-bold transition-colors ${reactionReady ? "border-cyan-200 bg-cyan-300 text-slate-950" : "border-white/10 bg-slate-950/50 text-slate-400"}`}>{reactionReady ? "Tap now" : reactionText}</button>
        <p className="mt-2 text-[11px] text-slate-500">{reactionText}</p>
      </Card>
    </div>
  );
}

function SymptomTriage({ onEmergency }: { onEmergency: () => void }) {
  const [region, setRegion] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const isRedFlag = region ? selected.some((item) => CONDITIONS[region].redFlags.includes(item)) : false;
  const toggle = (symptom: string) => setSelected((current) => current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]);
  const regions = Object.keys(CONDITIONS);
  return (
    <div>
      <SectionTitle eyebrow="Guided check-in" title="I feel unwell" description="Choose the area and symptoms you notice." />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h3 className="text-lg font-bold text-white">Where do you feel unwell?</h3>
          <div className="relative mx-auto mt-5 flex h-[330px] max-w-[330px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-[radial-gradient(circle,rgba(53,110,174,.13),transparent_65%)]">
            <svg viewBox="0 0 180 300" className="h-[280px] w-auto">
              <ellipse cx="90" cy="42" rx="26" ry="31" fill="#192a4a" stroke="#76caff" strokeOpacity=".7" strokeWidth="2" />
              <path d="M66 79 Q90 67 114 79 L129 167 L115 180 L110 139 L108 218 L72 218 L70 139 L65 180 L51 167 Z" fill="#152744" stroke="#76caff" strokeOpacity=".65" strokeWidth="2" />
              <path d="M65 89 L34 167 L45 173 L72 117 M115 89 L146 167 L135 173 L108 117 M76 216 L70 282 L85 282 L92 220 M104 216 L110 282 L95 282 L88 220" fill="#152744" stroke="#76caff" strokeOpacity=".65" strokeWidth="2" strokeLinejoin="round" />
              <rect x="73" y="106" width="34" height="48" rx="8" fill="rgba(125,211,252,.08)" stroke="rgba(125,211,252,.26)" />
              <path d="M83 125h14M90 118v14" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {regions.map((item) => {
              const style: React.CSSProperties = item === "Head" ? { top: "11%", left: "50%" } : item === "Chest" ? { top: "38%", left: "50%" } : item === "Stomach" ? { top: "54%", left: "50%" } : { top: "76%", left: "50%" };
              return <button key={item} type="button" onClick={() => { setRegion(item); setSelected([]); }} style={style} className={`absolute -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-bold transition ${region === item ? "border-sky-200 bg-sky-300 text-slate-950" : "border-sky-200/30 bg-slate-950/80 text-sky-100 hover:border-sky-200/70"}`}>{item}</button>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{regions.map((item) => <button key={item} type="button" onClick={() => { setRegion(item); setSelected([]); }} className={`rounded-lg border px-3 py-2 text-xs ${region === item ? "border-sky-300/40 bg-sky-300/10 text-sky-100" : "border-white/10 text-slate-400 hover:bg-white/[0.04]"}`}>{item}</button>)}</div>
        </Card>
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Symptom checklist</p>
          <h3 className="mt-1 text-lg font-bold text-white">{region ? `${region}: what do you notice?` : "Select an area to continue"}</h3>
          {region ? <>
            <div className="mt-4 space-y-2">{CONDITIONS[region].symptoms.map((symptom) => <label key={symptom} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${selected.includes(symptom) ? "border-sky-300/30 bg-sky-300/[0.06] text-white" : "border-white/[0.07] text-slate-400 hover:bg-white/[0.025]"}`}><input type="checkbox" checked={selected.includes(symptom)} onChange={() => toggle(symptom)} className="accent-sky-300" />{symptom}{CONDITIONS[region].redFlags.includes(symptom) && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-rose-300">urgent sign</span>}</label>)}</div>
            {isRedFlag ? <div className="mt-4 rounded-lg border border-rose-300/30 bg-rose-400/[0.08] p-4"><div className="flex items-center gap-2 text-sm font-bold text-rose-200"><ShieldAlert size={16} />Urgent sign selected</div><p className="mt-2 text-xs leading-5 text-slate-300">This demo flags the selected item. Follow mission emergency procedures and notify the commander promptly.</p><IconButton variant="danger" onClick={onEmergency} className="mt-3"><Siren size={15} /> Open emergency steps</IconButton></div> : <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-xs leading-5 text-slate-400">{selected.length ? `Consider reviewing these measurements: ${CONDITIONS[region].readings.map((item) => READING_META[item].label.toLowerCase()).join(", ")}.` : "Select any symptoms that apply. If you feel unsafe or symptoms are severe, contact the commander."}</p></div>}
          </> : <div className="mt-5 rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">Choose a highlighted area or one of the region buttons.</div>}
        </Card>
      </div>
    </div>
  );
}

function Emergency({ alarmRequest }: { alarmRequest: number }) {
  const [emergency, setEmergency] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [voice, setVoice] = useState(false);
  const [complete, setComplete] = useState(false);
  const [sirenEnabled, setSirenEnabled] = useState(true);
  const [alarmTest, setAlarmTest] = useState(false);
  const [audioError, setAudioError] = useState("");
  const steps = emergency ? EMERGENCY_STEPS[emergency] : [];
  const audioRef = useRef<{ context: AudioContext; oscillator: OscillatorNode; timer: number } | null>(null);
  const alarmTimer = useRef<number | null>(null);

  function stopSiren() {
    const audio = audioRef.current;
    if (!audio) return;
    audioRef.current = null;
    window.clearInterval(audio.timer);
    audio.oscillator.stop();
    void audio.context.close().catch((error: unknown) => {
      setAudioError(error instanceof Error ? `Could not stop the alarm audio: ${error.message}` : "Could not stop the alarm audio.");
    });
  }

  function startSiren() {
    if (audioRef.current) return;
    if (!window.AudioContext) {
      setAudioError("This browser does not support the audio alarm. The visual emergency alert is still active.");
      return;
    }
    try {
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 620;
      gain.gain.value = 0.1;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      let highTone = false;
      const timer = window.setInterval(() => {
        highTone = !highTone;
        oscillator.frequency.setValueAtTime(highTone ? 920 : 620, context.currentTime);
      }, 450);
      audioRef.current = { context, oscillator, timer };
      setAudioError("");
      if (context.state === "suspended") {
        void context.resume().catch((error: unknown) => {
          setAudioError(error instanceof Error ? `The browser blocked alarm audio: ${error.message}` : "The browser blocked alarm audio.");
        });
      }
    } catch (error) {
      setAudioError(error instanceof Error ? `Could not start the alarm audio: ${error.message}` : "Could not start the alarm audio.");
    }
  }

  useEffect(() => () => {
    if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
    const audio = audioRef.current;
    if (audio) {
      window.clearInterval(audio.timer);
      audio.oscillator.stop();
      void audio.context.close();
      audioRef.current = null;
    }
  }, []);

  function speak(text: string) {
    if (voice && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }
  function choose(item: string) {
    if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
    setAlarmTest(false);
    setSirenEnabled(true);
    startSiren();
    setEmergency(item);
    setStep(0);
    setComplete(false);
    speak(EMERGENCY_STEPS[item][0]);
  }
  function returnToProtocols() {
    setEmergency(null);
    setAlarmTest(false);
    setComplete(false);
    setAudioError("");
    if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
    stopSiren();
    window.speechSynthesis?.cancel();
  }
  function runAlarmTest(duration?: number) {
    if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
    setAlarmTest(true);
    setSirenEnabled(true);
    startSiren();
    if (duration !== undefined) {
      alarmTimer.current = window.setTimeout(() => {
        setAlarmTest(false);
        stopSiren();
        alarmTimer.current = null;
      }, duration);
    }
  }
  function stopAlarmTest() {
    if (alarmTimer.current !== null) window.clearTimeout(alarmTimer.current);
    alarmTimer.current = null;
    setAlarmTest(false);
    stopSiren();
  }
  useEffect(() => {
    if (alarmRequest > 0) runAlarmTest();
  }, [alarmRequest]);
  function toggleSiren() {
    const next = !sirenEnabled;
    setSirenEnabled(next);
    if (next) startSiren();
    else stopSiren();
  }
  function advance() {
    if (step >= steps.length - 1) {
      setComplete(true);
      return;
    }
    const next = step + 1;
    setStep(next);
    speak(steps[next]);
  }
  const alarmActive = Boolean(emergency) || alarmTest;
  return (
    <div>
      {alarmActive && <div className="emergency-alarm-frame" aria-hidden="true" />}
      <SectionTitle eyebrow="Immediate response" title="Emergency protocol" description="" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/25 bg-rose-500/[0.09] p-4">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-400/15 text-rose-200"><Siren size={18} /></span><div><p className="text-sm font-bold text-rose-100">Alert the commander now.</p><p className="text-xs text-rose-100/60"></p></div></div>
        <button type="button" onClick={() => setVoice(!voice)} className="flex items-center gap-2 rounded-lg border border-rose-200/20 px-3 py-2 text-xs font-semibold text-rose-100">{voice ? <Activity size={14} /> : <MessageSquareText size={14} />} Voice {voice ? "on" : "off"}</button>
      </div>
      {alarmTest && !emergency && <div className="codered-banner" role="alert"><span className="codered-lamp" /><strong>EMERGENCY</strong><span className="flex-1 text-xs text-rose-50/90">Red screen and siren active · stop it here or choose a protocol.</span><button type="button" onClick={toggleSiren} className="inline-flex items-center gap-1.5 rounded-md border border-rose-100/20 bg-black/15 px-2.5 py-1.5 text-[10px] font-bold text-rose-50">{sirenEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}{sirenEnabled ? "Siren on" : "Siren off"}</button><button type="button" onClick={stopAlarmTest} className="inline-flex items-center gap-1.5 rounded-md border border-rose-100/20 bg-black/15 px-2.5 py-1.5 text-[10px] font-bold text-rose-50"><X size={13} />Stop test</button></div>}
      {audioError && <p role="status" className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">{audioError}</p>}
      {!emergency ? <>
        <div className="grid gap-3 md:grid-cols-3">{Object.keys(EMERGENCY_STEPS).map((item) => <button type="button" onClick={() => choose(item)} key={item} className="glass group rounded-xl p-5 text-left transition hover:border-rose-300/40 hover:bg-rose-400/[0.04]"><span className="mb-4 inline-flex rounded-lg border border-rose-300/15 bg-rose-300/[0.06] p-2.5 text-rose-200"><AlertTriangle size={18} /></span><h3 className="text-base font-bold text-white">{item}</h3><p className="mt-2 text-xs leading-5 text-slate-500">Open the step-by-step mission demo response.</p><span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-rose-200">View protocol <ChevronRight size={14} /></span></button>)}</div>
        <Card className="mt-4"><h3 className="text-sm font-bold text-white">Alarm test</h3><p className="mt-1 text-xs leading-5 text-slate-400">Preview the red screen alert and siren for two seconds.</p><IconButton variant="secondary" onClick={() => runAlarmTest(2000)} className="mt-3"><Siren size={15} /> Test alarm</IconButton></Card>
      </> : <Card className="border-rose-300/20">
        <div className="codered-banner" role="alert">
          <span className="codered-lamp" />
          <strong>CODE RED</strong>
          <span className="flex-1 text-xs text-rose-50/90">Commander alerted. Follow the mission emergency protocol.</span>
          <div className="codered-progress" role="progressbar" aria-label="Emergency steps completed" aria-valuenow={Math.min(step, steps.length)} aria-valuemin={0} aria-valuemax={steps.length}><i style={{ width: `${Math.min(100, (step / steps.length) * 100)}%` }} /></div>
          <span className="text-[10px] text-rose-100">{Math.min(step, steps.length)}/{steps.length} steps</span>
          <button type="button" onClick={toggleSiren} className="inline-flex items-center gap-1.5 rounded-md border border-rose-100/20 bg-black/15 px-2.5 py-1.5 text-[10px] font-bold text-rose-50">{sirenEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}{sirenEnabled ? "Siren on" : "Siren off"}</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><button type="button" className="mb-3 text-xs text-slate-500 hover:text-white" onClick={returnToProtocols}>← All emergencies</button><h3 className="text-xl font-bold text-white">{emergency}</h3></div><span className="rounded-full border border-rose-300/20 bg-rose-400/[0.08] px-3 py-1.5 text-xs text-rose-200">Step {Math.min(step + 1, steps.length)} of {steps.length}</span></div>
        <div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-500/[0.08] p-5 sm:p-7" aria-live="polite"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200/60">Current action</p><p className="mt-3 text-lg font-semibold leading-8 text-white sm:text-xl">{complete ? "Protocol steps reviewed. Continue monitoring and follow the mission commander’s direction." : steps[step]}</p></div>
        <div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Follow mission training and approved medical procedures.</span><IconButton variant="danger" onClick={advance}>{complete ? <Check size={15} /> : <ChevronRight size={16} />}{complete ? "Reviewed" : step === steps.length - 1 ? "Finish" : "Next step"}</IconButton></div>
      </Card>}
    </div>
  );
}

function HealthLibrary() {
  const [topic, setTopic] = useState(Object.keys(LIBRARY)[0]);
  const entry = LIBRARY[topic];
  const rows = [
    { label: "What to watch", value: entry.watch, icon: Activity },
    { label: "Common factors", value: entry.causes, icon: CircleHelp },
    { label: "What to do", value: entry.action, icon: BadgeCheck },
    { label: "How crew can help", value: entry.crew, icon: Users },
  ];
  return <div><SectionTitle eyebrow="Reference notes" title="Medical library" description="" />
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <div className="space-y-2">{Object.keys(LIBRARY).map((item) => <button key={item} type="button" onClick={() => setTopic(item)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-semibold transition ${topic === item ? "border-sky-300/30 bg-sky-300/[0.08] text-sky-100" : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-white"}`}>{item}<ChevronRight size={14} /></button>)}</div>
      <Card><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Crew reference</p><h3 className="mt-1 text-xl font-bold text-white">{topic}</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{rows.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/[0.07] text-sky-200"><Icon size={15} /></span><h4 className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h4><p className="mt-2 text-sm leading-6 text-slate-300">{value}</p></div>)}</div></Card>
    </div>
  </div>;
}

function CrewRecords({
  profile,
  setProfile,
  history,
}: {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  history: HealthEntry[];
}) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  return <div><SectionTitle eyebrow="Local crew data" title="Crew records" description="" />
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card><div className="mb-5 flex items-center gap-3"><span className="rounded-xl border border-sky-300/10 bg-sky-300/[0.07] p-3 text-sky-200"><Users size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crew profile</p><h3 className="text-lg font-bold text-white">Astronaut details</h3></div></div>
        <label className="mb-4 block text-xs font-semibold text-slate-400">Name or crew ID<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white" placeholder="Astronaut 1" /></label>
        <label className="mb-4 block text-xs font-semibold text-slate-400">Allergies<input value={draft.allergies} onChange={(event) => setDraft({ ...draft, allergies: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white" placeholder="Optional" /></label>
        <label className="mb-4 block text-xs font-semibold text-slate-400">Regular medication<input value={draft.medication} onChange={(event) => setDraft({ ...draft, medication: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white" placeholder="Optional" /></label>
        <IconButton variant="secondary" className="w-full" onClick={() => setProfile(draft)}><Save size={14} /> Save profile</IconButton>
      </Card>
      <Card><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Personal timeline</p><h3 className="text-lg font-bold text-white">Recent checkups</h3></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">{history.length} saved</span></div>
        {history.length ? <div className="thin-scrollbar max-h-[450px] overflow-auto"><table className="w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#0d142d] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Mission day</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Readings</th></tr></thead><tbody>{[...history].reverse().map((entry) => <tr key={entry.id} className="border-t border-white/[0.06]"><td className="px-3 py-3 text-slate-400">Day {entry.day}<span className="mt-1 block text-[10px] text-slate-600">{new Date(entry.timestamp).toLocaleDateString()}</span></td><td className="px-3 py-3"><LevelBadge level={entry.level} compact /></td><td className="px-3 py-3 text-slate-400">{Object.entries(entry.readings).map(([key, value]) => `${READING_META[key as ReadingKey].label}: ${value}`).join(" · ")}</td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed border-white/10 px-4 py-12 text-center"><History size={22} className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-400">No checkups saved yet.</p><p className="mt-1 text-xs text-slate-600">Submitted readings will appear here.</p></div>}
      </Card>
    </div>
  </div>;
}

async function hashEntry(previousHash: string, timestamp: string, summary: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure SHA-256 hashing is unavailable in this browser context.");
  const bytes = new TextEncoder().encode(`${previousHash}${timestamp}${summary}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function GroundLink({
  linkUp,
  setLinkUp,
  reports,
  setReports,
  log,
  setLog,
}: {
  linkUp: boolean;
  setLinkUp: (up: boolean) => void;
  reports: Report[];
  setReports: (reports: Report[]) => void;
  log: LogEntry[];
  setLog: (entries: LogEntry[]) => void;
}) {
  const [verification, setVerification] = useState<"idle" | "checking" | "intact" | "broken" | "unavailable">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!log.length) {
        setVerification("intact");
        return;
      }
      setVerification("checking");
      try {
        let previous = "0".repeat(64);
        for (const entry of log) {
          const expected = await hashEntry(previous, entry.timestamp, entry.summary);
          if (expected !== entry.hash || entry.previousHash !== previous) {
            if (active) setVerification("broken");
            return;
          }
          previous = entry.hash;
        }
        if (active) setVerification("intact");
      } catch {
        if (active) setVerification("unavailable");
      }
    }
    void verify();
    return () => { active = false; };
  }, [log]);

  async function addDemoLog(summary: string) {
    const timestamp = new Date().toISOString();
    const previousHash = log.at(-1)?.hash ?? "0".repeat(64);
    try {
      const hash = await hashEntry(previousHash, timestamp, summary);
      setLog([...log, { timestamp, summary, hash, previousHash }]);
      setMessage("");
    } catch (error) {
      console.error("Could not create integrity hash.", error);
      setMessage(error instanceof Error ? error.message : "Could not create a SHA-256 log entry.");
    }
  }

  function toggleLink() {
    const next = !linkUp;
    setLinkUp(next);
    if (next && reports.length) {
      setReports([]);
      setMessage(`${reports.length} demo report${reports.length === 1 ? "" : "s"} marked as sent.`);
    }
  }

  function tamperDemoEntry() {
    if (!log.length) {
      setMessage("Create a demo log entry before testing verification.");
      return;
    }
    setLog(log.map((entry, index) => index === 0 ? { ...entry, summary: `${entry.summary} (edited)` } : entry));
    setMessage("Entry edited. The integrity check should now flag the chain.");
  }

  const verifyColor = verification === "intact" ? "text-emerald-200" : verification === "broken" ? "text-rose-200" : "text-amber-200";
  return <div><SectionTitle eyebrow="Communications" title="Earth link" description="" />
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <Card><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Deep-space communications</p><h3 className="mt-1 text-lg font-bold text-white">Link status</h3><p className="mt-2 max-w-md text-xs leading-5 text-slate-400">At mission distance, messages can take nearly 14 minutes one way. The crew should follow onboard procedures without waiting for Earth.</p></div><span className={`rounded-xl border p-3 ${linkUp ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200" : "border-rose-300/20 bg-rose-300/[0.07] text-rose-200"}`}>{linkUp ? <Cloud size={20} /> : <CloudOff size={20} />}</span></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${linkUp ? "bg-emerald-400" : "bg-rose-400"}`} /><span className="font-semibold text-white">{linkUp ? "Connected" : "Offline · reports queued"}</span></div><IconButton variant="secondary" onClick={toggleLink}>{linkUp ? <CloudOff size={15} /> : <Link2 size={15} />}{linkUp ? "Simulate outage" : "Restore link"}</IconButton></div>
        </Card>
        <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Outbound queue</p><h3 className="mt-1 text-lg font-bold text-white">Mission reports</h3></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">{reports.length} waiting</span></div>
          {reports.length ? <div className="mt-4 space-y-2">{reports.map((report) => <div key={report.id} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><span className="mt-0.5 text-amber-200"><Clock3 size={15} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><LevelBadge level={report.level} compact /><span className="text-[10px] text-slate-600">{new Date(report.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{report.summary}</p></div></div>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">No reports are waiting to be sent.</p>}
        </Card>
      </div>
      <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Local integrity check</p><h3 className="mt-1 text-lg font-bold text-white">Hash-chained log</h3></div><span className={`text-xs font-semibold ${verifyColor}`}>{verification === "checking" ? "Checking…" : verification === "intact" ? "Chain intact" : verification === "broken" ? "Integrity check failed" : "Verification unavailable"}</span></div>
        <div className="mt-4 flex flex-wrap gap-2"><IconButton variant="secondary" onClick={() => void addDemoLog("Manual log entry")}><Plus size={14} /> Add demo entry</IconButton><IconButton variant="secondary" onClick={tamperDemoEntry}><AlertTriangle size={14} /> Test integrity</IconButton><IconButton variant="secondary" onClick={() => { setLog([]); setMessage("Demo log cleared."); }}><X size={14} /> Clear log</IconButton></div>
        {message && <p role="status" className="mt-3 text-xs text-sky-200">{message}</p>}
        <div className="thin-scrollbar mt-4 max-h-[390px] overflow-auto">{log.length ? [...log].reverse().map((entry) => <div key={entry.timestamp + entry.hash} className="border-t border-white/[0.06] py-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-300">{entry.summary}</span><span className="text-[10px] text-slate-600">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><code className="mt-1 block break-all text-[9px] text-slate-600">{entry.hash}</code></div>) : <p className="py-8 text-center text-xs text-slate-600">No log entries yet.</p>}</div>
      </Card>
    </div>
  </div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alarmRequest, setAlarmRequest] = useState(0);
  const [day, setDay] = useState(1);
  const [environment, setEnvironment] = useState("Spacecraft");
  const [history, setHistory] = useLocalStorage<HealthEntry[]>("astro-health-history", []);
  const [profile, setProfile] = useLocalStorage<Profile>("astro-health-profile", { name: "Astronaut 1", allergies: "", medication: "" });
  const [reports, setReports] = useLocalStorage<Report[]>("astro-health-reports", []);
  const [linkUp, setLinkUp] = useLocalStorage("astro-health-link-up", true);
  const [log, setLog] = useLocalStorage<LogEntry[]>("astro-health-log", []);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");

  const todayEntry = history.find((entry) => entry.day === day && entry.source === "Daily checkup");
  const level: Level = todayEntry?.level ?? LEVELS[Math.min(3, Math.floor(MISSION[day - 1].wellbeing / 0.85))];

  async function saveHealthEntry(readings: Readings, source: string) {
    const assessment = getLevel(readings);
    const entry: HealthEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      day,
      level: assessment.level,
      readings,
      source,
      timestamp: new Date().toISOString(),
    };
    setHistory([...history, entry].slice(-40));
    const report: Report = {
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      summary: `${source}: ${Object.entries(readings).map(([key, value]) => `${READING_META[key as ReadingKey].label} ${value}`).join(", ")} · ${entry.level}`,
    };
    if (!linkUp) {
      setReports([...reports, report]);
      return;
    }
    try {
      const previousHash = log.at(-1)?.hash ?? "0".repeat(64);
      const hash = await hashEntry(previousHash, entry.timestamp, report.summary);
      setLog([...log, { timestamp: entry.timestamp, summary: report.summary, hash, previousHash }]);
      setStorageNotice("");
    } catch (error) {
      console.error("Could not verify the local report log.", error);
      setReports([...reports, report]);
      setStorageNotice("Secure hashing is unavailable; this report was kept in the local queue instead.");
    }
  }

  function selectTab(id: TabId) {
    setActiveTab(id);
    setMobileNavOpen(false);
    if (id === "emergency") setAlarmRequest((request) => request + 1);
  }

  const currentNav = NAV.find((item) => item.id === activeTab) ?? NAV[0];
  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080d1ef2] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button type="button" aria-label="Toggle navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"><Menu size={18} /></button>
          <div className="h-12 w-[110px] shrink-0 overflow-hidden sm:h-[54px] sm:w-[128px] lg:h-[58px] lg:w-[152px]"><img src={logoImage} alt="Astronaut Health Copilot" className="h-full w-full object-cover object-[center_40%] invert" /></div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 border-l border-white/10 pl-4 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_#34d399]" /><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Elapsed</p><p className="display-font text-xs font-bold text-slate-200">D{String(day).padStart(3, "0")} / 090</p></div></div>
            <div className="hidden items-center gap-2 border-l border-white/10 pl-4 md:flex"><Signal size={15} className={linkUp ? "text-emerald-300" : "text-rose-300"} /><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Earth link</p><p className="text-xs font-semibold text-slate-200">{linkUp ? "Connected" : "Offline"}</p></div></div>
            <label className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 sm:flex"><span className="text-[9px] uppercase tracking-wider text-slate-500">Env</span><select value={environment} onChange={(event) => setEnvironment(event.target.value)} style={{ colorScheme: "dark" }} className="max-w-28 bg-transparent text-xs text-slate-100 outline-none"><option value="Spacecraft">Spacecraft</option><option value="Space station">Space station</option><option value="Lunar base">Lunar base</option></select></label>
            <button type="button" aria-label="Open emergency protocol" onClick={() => selectTab("emergency")} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(244,63,94,.14)] transition hover:bg-rose-400 sm:px-4"><Siren size={14} /> Emergency</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[238px_minmax(0,1fr)]">
        <aside className={`${mobileNavOpen ? "block" : "hidden"} fixed inset-x-0 top-[68px] z-20 border-b border-white/10 bg-[#080d1efc] px-3 py-3 lg:sticky lg:top-[68px] lg:block lg:h-[calc(100vh-68px)] lg:border-0 lg:bg-transparent lg:px-4 lg:py-6`}>
          <div className="mb-4 hidden px-3 text-[9px] font-bold uppercase tracking-[0.23em] text-slate-600 lg:block">Mission console</div>
          <nav aria-label="Main navigation" className="thin-scrollbar grid max-h-[calc(100vh-90px)] grid-cols-2 gap-2 overflow-auto lg:flex lg:flex-col">
            {NAV.map(({ id, title, subtitle, icon: Icon }) => <button key={id} type="button" onClick={() => selectTab(id)} aria-current={activeTab === id ? "page" : undefined} className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${activeTab === id ? "border-sky-300/25 bg-gradient-to-r from-sky-400/10 to-violet-400/[0.04] text-white" : "border-transparent bg-white/[0.02] text-slate-400 hover:border-white/[0.07] hover:bg-white/[0.04] hover:text-slate-200"} ${id === "emergency" && activeTab !== id ? "text-rose-200/80" : ""}`}><Icon size={17} className={`shrink-0 ${activeTab === id ? "text-sky-200" : id === "emergency" ? "text-rose-300" : "text-slate-500"}`} /><span className="min-w-0"><span className="block truncate text-xs font-bold">{title}</span><span className="mt-0.5 hidden truncate text-[10px] text-slate-600 sm:block">{subtitle}</span></span>{activeTab === id && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300 shadow-[0_0_8px_#7dd3fc]" />}</button>)}
          </nav>
          <div className="mt-6 hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 lg:block"><div className="flex items-center gap-2 text-sky-200"><BatteryCharging size={15} /><span className="text-[10px] font-bold uppercase tracking-wider">System status</span></div><div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>Local storage</span><span className="text-emerald-300">Ready</span></div><div className="mt-2 h-1 rounded-full bg-white/10"><div className="h-full w-[82%] rounded-full bg-sky-300/70" /></div></div>
        </aside>
        <main className="min-w-0 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-600">{currentNav.subtitle}</p><p className="mt-1 text-xs text-slate-400">{currentNav.title} <span className="text-slate-700">/</span> {environment}</p></div><div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5"><span className={`h-1.5 w-1.5 rounded-full ${linkUp ? "bg-emerald-400" : "bg-amber-400"}`} /><span className="text-[10px] text-slate-400">{linkUp ? "Systems nominal" : `${reports.length} queued`}</span></div></div>
          {storageNotice && <p role="status" className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">{storageNotice}</p>}
          {activeTab === "dashboard" && <Dashboard day={day} setDay={setDay} level={level} checkedToday={!!todayEntry} onCheckup={() => selectTab("checkup")} />}
          {activeTab === "checkup" && <Checkup day={day} onSubmit={saveHealthEntry} lastCheckup={todayEntry} />}
          {activeTab === "symptoms" && <SymptomTriage onEmergency={() => selectTab("emergency")} />}
          {activeTab === "emergency" && <Emergency alarmRequest={alarmRequest} />}
          {activeTab === "library" && <HealthLibrary />}
          {activeTab === "crew" && <CrewRecords profile={profile} setProfile={setProfile} history={history} />}
          {activeTab === "earth" && <GroundLink linkUp={linkUp} setLinkUp={setLinkUp} reports={reports} setReports={setReports} log={log} setLog={setLog} />}
          
        </main>
      </div>
    </div>
  );
}
