import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, peso } from "../api";
import type { Frequency, GroupSummary } from "../types";

export default function GroupList({ onOpen }: { onOpen: (id: number) => void }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<GroupSummary[]>("/groups").then(setGroups).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My groups</h1>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ New group"}
        </button>
      </div>

      {showForm && (
        <CreateGroupForm
          onCreated={(id) => {
            setShowForm(false);
            load();
            onOpen(id);
          }}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups.length === 0 ? (
        <p className="card text-sm text-slate-500">You're not in any paluwagan yet. Create one and invite your friends.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => onOpen(g.id)} className="card text-left transition hover:border-brand">
              <h2 className="font-semibold">{g.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {peso(g.contributionAmount)} {g.frequency} · {g.memberCount} members
              </p>
              <p className="mt-3 text-xs font-medium text-brand">
                Cycle {g.currentCycle} of {g.memberCount} · pot {peso(g.contributionAmount * g.memberCount)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupForm({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(500);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [emails, setEmails] = useState("ben@example.com\ncarla@example.com");
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const memberEmails = emails.split(/[\s,]+/).filter(Boolean);
      const res = await api<{ id: number }>("/groups", {
        method: "POST",
        body: { name, contributionAmount: amount, frequency, startDate, memberEmails, shuffle },
      });
      onCreated(res.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 grid gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Group name
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Barkada Ipon 2026" required />
      </label>
      <label className="text-sm">
        Contribution per cycle (₱)
        <input className="input mt-1" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
      </label>
      <label className="text-sm">
        Schedule
        <select className="input mt-1" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
