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
