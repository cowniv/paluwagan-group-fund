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
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${tab === t ? "border-brand font-medium text-brand" : "border-transparent text-slate-500"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "cycles" && (
        <div className="space-y-4">
          {group.cycles.map((c) => (
            <CycleCard key={c.cycle} cycle={c} group={group} me={me} nameOf={nameOf} onChange={reload} />
          ))}
        </div>
      )}
      {tab === "ledger" && <LedgerTab groupId={groupId} />}
      {tab === "overdue" && <OverdueTab groupId={groupId} />}
      {tab === "audit" && <AuditTab groupId={groupId} nameOf={nameOf} />}
    </div>
  );
}

function CycleCard({ cycle, group, me, nameOf, onChange }: { cycle: Cycle; group: GroupDetail; me: User; nameOf: (id: number) => string; onChange: () => void }) {
  const [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const myPayment = cycle.payments.find((p) => p.userId === me.id);
  const allPaid = cycle.paidCount === group.members.length;
  const payout = cycle.payout;
  const iApproved = payout?.approvals.some((a) => a.userId === me.id);
  const isCurrent = cycle.cycle === group.currentCycle;

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      setProof("");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className={`card ${isCurrent ? "border-brand" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Cycle {cycle.cycle} <span className="font-normal text-slate-500">· due {fmtDate(cycle.dueDate)} · pot goes to {nameOf(cycle.recipientId)}</span>
        </h2>
        <span className="text-xs text-slate-500">
          {cycle.paidCount}/{group.members.length} paid
        </span>
      </div>

      <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
        {cycle.payments.map((p) => (
          <li key={p.userId} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${p.paid ? "bg-emerald-500" : "bg-slate-300"}`} />
            {nameOf(p.userId)}
            {p.proofNote && <span className="truncate text-xs text-slate-400">({p.proofNote})</span>}
          </li>
        ))}
      </ul>

      {myPayment && !myPayment.paid && (
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="Proof note, e.g. GCash ref 1234" value={proof} onChange={(e) => setProof(e.target.value)} />
          <button className="btn shrink-0" onClick={() => act(() => api(`/groups/${group.id}/contributions`, { method: "POST", body: { cycle: cycle.cycle, proofNote: proof } }))}>
            Record my {peso(group.contributionAmount)}
          </button>
        </div>
      )}

      {!payout && allPaid && (
        <button className="btn-ghost" onClick={() => act(() => api(`/groups/${group.id}/payouts`, { method: "POST", body: { cycle: cycle.cycle } }))}>
          Request payout of {peso(group.pot)} to {nameOf(cycle.recipientId)}
        </button>
      )}

      {payout && (
        <div className={`rounded-lg p-3 text-sm ${payout.status === "released" ? "bg-emerald-50" : "bg-amber-50"}`}>
          <p className="font-medium">
            Payout {peso(payout.amount)} to {nameOf(payout.recipientId)} ·{" "}
            {payout.status === "released" ? `released ${fmtDate(payout.releasedAt!)}` : `pending (${payout.approvals.length}/${payout.required} approvals)`}
          </p>
