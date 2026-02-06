import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, peso } from "../api";
import type { AuditItem, Cycle, GroupDetail, LedgerEntry, OverdueItem, User } from "../types";

type Tab = "cycles" | "ledger" | "overdue" | "audit";

export default function GroupView({ groupId, me, onBack }: { groupId: number; me: User; onBack: () => void }) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [tab, setTab] = useState<Tab>("cycles");
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api<GroupDetail>(`/groups/${groupId}`).then(setGroup).catch((e) => setError(e.message));
  }, [groupId]);
  useEffect(reload, [reload]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!group) return <p className="text-sm text-slate-500">Loading…</p>;

  const nameOf = (id: number) => group.members.find((m) => m.id === id)?.name ?? "?";

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-brand">← All groups</button>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-slate-500">
            {peso(group.contributionAmount)} {group.frequency} · pot {peso(group.pot)} · payouts need {group.requiredApprovals} approvals
          </p>
        </div>
        <ol className="flex flex-wrap gap-1 text-xs">
          {group.members.map((m) => (
            <li key={m.id} className={`rounded-full px-2 py-1 ${m.position === group.currentCycle ? "bg-brand text-white" : "bg-brand-light text-brand"}`}>
              {m.position}. {m.name}
            </li>
          ))}
        </ol>
      </div>

      <nav className="mb-4 flex gap-1 border-b border-slate-200">
        {(["cycles", "ledger", "overdue", "audit"] as Tab[]).map((t) => (
          <button
