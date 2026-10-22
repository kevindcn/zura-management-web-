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
  dueDate?: string | null;
  position: number;
  statusId: string;
  status: Status;
  projectId: string;
  assigneeId?: string | null;
  assignee?: User | null;
  reporterId: string;
  reporter: User;
  parentId?: string | null;
  parent?: { id: string; key: string; title: string; type: IssueType } | null;
  children?: Issue[];
  comments?: Comment[];
  activities?: Activity[];
  _count?: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  user: User;
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
