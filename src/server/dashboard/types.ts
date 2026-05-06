export interface DashboardGroupMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DashboardGroupSummary {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  memberCount: number;
  // Positive: others owe you. Negative: you owe. Zero: settled.
  balancePaise: string;
  lastActivityAt: Date;
  // Card preview — first 4 members (sorted by joinedAt) plus the title/date of
  // the most-recent active expense, used by GroupCard for the avatar row and
  // last-expense line. `null` when the group has no expenses yet.
  members: DashboardGroupMember[];
  lastExpense: { title: string; date: Date } | null;
}

export interface DashboardPending {
  // Settlements awaiting your confirmation as the receiver.
  settlementsAwaitingConfirmation: number;
  // Expense edit proposals in your groups that you haven't voted on yet.
  expenseEditVotesPending: number;
}

export interface DashboardData {
  netBalancePaise: string;
  settledThisMonthPaise: string;
  groups: DashboardGroupSummary[];
  pending: DashboardPending;
}
