export type Frequency = "weekly" | "biweekly" | "monthly";

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  contributionAmount: number;
  frequency: Frequency;
  startDate: string;
  memberCount: number;
  currentCycle: number;
}

export interface Member extends User {
  position: number;
}

export interface Payout {
  id: number;
  cycle: number;
  recipientId: number;
  amount: number;
  status: "pending" | "released";
  createdAt: string;
  releasedAt: string | null;
  approvals: { userId: number; name: string; at: string }[];
  required: number;
}

export interface Cycle {
  cycle: number;
  dueDate: string;
  recipientId: number;
  payments: { userId: number; paid: boolean; proofNote: string | null; paidAt: string | null }[];
  paidCount: number;
  payout: Payout | null;
}
