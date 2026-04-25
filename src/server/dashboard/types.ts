export interface DashboardGroupSummary {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  memberCount: number;
  // Positive: others owe you. Negative: you owe. Zero: settled.
  balancePaise: number;
  lastActivityAt: Date;
}

export interface DashboardPending {
  // Settlements awaiting your confirmation as the receiver.
  settlementsAwaitingConfirmation: number;
  // Expense edit proposals in your groups that you haven't voted on yet.
  expenseEditVotesPending: number;
}

export interface DashboardData {
  netBalancePaise: number;
  groups: DashboardGroupSummary[];
  pending: DashboardPending;
}
