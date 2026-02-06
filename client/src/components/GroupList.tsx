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
