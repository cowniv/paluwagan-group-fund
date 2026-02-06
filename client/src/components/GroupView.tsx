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
