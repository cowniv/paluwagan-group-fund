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
