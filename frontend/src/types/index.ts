export type IssueType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
export type PriorityLevel = "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
export type StatusCategory = "TO_DO" | "IN_PROGRESS" | "DONE";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Status {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
  projectId: string;
}

export interface Comment {
  id: string;
  body: string;
  issueId: string;
  authorId: string;
  author: User;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  issueId: string;
  userId: string;
  user: User;
  createdAt: string;
}

export interface Issue {
  id: string;
  key: string;
  number: number;
  type: IssueType;
  title: string;
  description?: string | null;
  priority: PriorityLevel;
  storyPoints?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  position: number;
  statusId: string;
  status: Status;
  projectId: string;
  project?: { id: string; key: string; name: string } | null;
  assigneeId?: string | null;
  assignee?: User | null;
  reporterId: string;
  reporter: User;
  parentId?: string | null;
  parent?: { id: string; key: string; title: string; type: IssueType } | null;
  sprintId?: string | null;
  sprint?: { id: string; name: string; state: SprintStatus } | null;
  labels?: Label[];
  children?: Issue[];
  comments?: Comment[];
  activities?: Activity[];
  watchers?: Array<{ id: string; user: User }>;
  isWatching?: boolean;
  watcherCount?: number;
  _count?: {
    comments: number;
    children?: number;
    watchers?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color?: string | null;
  projectId: string;
}

export type SprintStatus = "FUTURE" | "ACTIVE" | "CLOSED";

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  state: SprintStatus;
  projectId: string;
  issues?: Issue[];
  _count?: {
    issues: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type ProjectRole = "ADMIN" | "MEMBER" | "VIEWER";

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  user: User;
  createdAt?: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  leadId: string;
  lead: User;
  issueCounter: number;
  statuses: Status[];
  members: ProjectMember[];
  _count?: {
    issues: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  issueKey?: string;
  projectId?: string;
  createdAt: string;
  isRead: boolean;
  type: "ASSIGNED" | "STATUS_CHANGED" | "COMMENT" | "SPRINT";
  title?: string;
}

export interface SavedView {
  id: string;
  name: string;
  query?: string | null;
  type?: string | null;
  priority?: string | null;
  statusId?: string | null;
  assignee?: string | null;
  isShared: boolean;
  projectId: string;
  userId: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ==========================================
// REPORTING TYPES (BURNDOWN, VELOCITY, SPRINT REPORT)
// ==========================================

export interface BurndownDay {
  date: string;
  dayIndex: number;
  ideal: number;
  scope: number;
  done: number | null;
  remaining: number | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface BurndownSummary {
  committed: number;
  completed: number;
  remaining: number;
  scopeAdded: number;
}

export interface BurndownResponse {
  sprint: {
    id: string;
    name: string;
    state: SprintStatus;
  };
  metric: "points" | "issues";
  unestimated: number;
  summary: BurndownSummary;
  days: BurndownDay[];
}

export interface VelocitySprintItem {
  id: string;
  name: string;
  closedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  committedPoints: number;
  completedPoints: number;
  completionRate: number | null;
}

export interface VelocityResponse {
  sprints: VelocitySprintItem[];
  averageVelocity: number;
  recommendedCapacity: number | null;
  insufficientData: boolean;
  emptyMessage?: string;
  recommendationMessage?: string | null;
}

export interface SprintReportIssue {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: PriorityLevel;
  storyPoints?: number | null;
  status: Status;
  assignee?: User | null;
  outcome?: string;
  targetDestination?: string;
  addedMidSprint?: boolean;
}

export interface RetroNotes {
  good?: string;
  toImprove?: string;
  actionItems?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SprintReportResponse {
  sprint: {
    id: string;
    name: string;
    goal?: string | null;
    state: SprintStatus;
    startDate?: string | null;
    endDate?: string | null;
    startedAt?: string | null;
    closedAt?: string | null;
    retroNotes?: RetroNotes | null;
  };
  summary: {
    committedPoints: number;
    committedIssues: number;
    completedPoints: number;
    completedIssues: number;
    completionRate: number | null;
    scopeAddedPoints: number;
    scopeAddedIssues: number;
    carriedOverPoints: number;
    carriedOverIssues: number;
  };
  completedIssues: SprintReportIssue[];
  notCompletedIssues: SprintReportIssue[];
  addedMidSprintIssues: SprintReportIssue[];
  miniBurndown?: BurndownResponse;
  isPreview: boolean;
}


