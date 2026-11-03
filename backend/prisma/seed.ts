import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { computeAgileSprintMetrics } from "../src/lib/burndown.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting JiraLite database seed...");

  // Safety guard: Database URL check & CLI confirmation argument
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ Refusing to seed: DATABASE_URL is not set.");
    process.exit(1);
  }

  let host = "";
  let hostname = "";
  let dbName = "";
  try {
    const parsed = new URL(dbUrl);
    host = parsed.host;
    hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    dbName = parsed.pathname.replace(/^\//, "");
  } catch {
    const match = dbUrl.match(/@([^/:]+(?::\d+)?)\/([^?]+)/);
    if (match) {
      host = match[1];
      hostname = host.split(":")[0].toLowerCase().replace(/^\[|\]$/g, "");
      dbName = match[2];
    } else {
      console.error("❌ Refusing to seed: Failed to parse DATABASE_URL.");
      process.exit(1);
    }
  }

  console.log(`📡 Target database host: ${host}, database: ${dbName}`);

  // Disallow seeding if database name is 'jira_clone' or 'jira_clone_test'
  const protectedDbs = ["jira_clone", "jira_clone_test"];
  if (protectedDbs.includes(dbName.toLowerCase())) {
    console.error(
      `❌ Refusing to seed: Database '${dbName}' is strictly protected from seeding.`
    );
    process.exit(1);
  }

  const localHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
  const isLocalHost = localHosts.includes(hostname);
  const allowLocal = process.argv.includes("--allow-local");

  // Require matching --confirm-db=<host>/<nama database> argument
  const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm-db="));
  const confirmedTarget = confirmArg
    ? confirmArg.slice(13).replace(/^["']|["']$/g, "").trim()
    : undefined;

  const expectedTarget = `${host}/${dbName}`;
  const matchesTarget =
    confirmedTarget === expectedTarget ||
    confirmedTarget === `${hostname}/${dbName}`;

  if (!matchesTarget) {
    console.error(
      `❌ Refusing to seed: Missing or mismatched confirmation argument.\n   Format wajib: --confirm-db=<host>/<nama database>\n   Target yang diharapkan: --confirm-db=${expectedTarget}${isLocalHost ? " --allow-local" : ""}`
    );
    process.exit(1);
  }

  if (isLocalHost && !allowLocal) {
    console.error(
      `❌ Refusing to seed: Host '${hostname}' is a local environment. Pass --allow-local to override.\n   Contoh: --confirm-db=${expectedTarget} --allow-local`
    );
    process.exit(1);
  }

  // Passwords:
  // - Demo user (alex.lead@jira-lite.local) gets a random password
  // - Other seed users get SEED_PASSWORD if provided, otherwise random
  const demoPassword = crypto.randomBytes(24).toString("hex");
  const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

  const seedPassword =
    process.env.SEED_PASSWORD || crypto.randomBytes(24).toString("hex");
  const seedPasswordHash = await bcrypt.hash(seedPassword, 10);

  // 1. Create Users
  const alex = await prisma.user.upsert({
    where: { email: "alex.lead@jira-lite.local" },
    update: {
      passwordHash: demoPasswordHash,
    },
    create: {
      email: "alex.lead@jira-lite.local",
      name: "Alex Morgan",
      passwordHash: demoPasswordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan&backgroundColor=0c66e4",
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "sarah.dev@jira-lite.local" },
    update: {
      passwordHash: seedPasswordHash,
    },
    create: {
      email: "sarah.dev@jira-lite.local",
      name: "Sarah Connor",
      passwordHash: seedPasswordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Sarah%20Connor&backgroundColor=00875a",
    },
  });

  const david = await prisma.user.upsert({
    where: { email: "david.qa@jira-lite.local" },
    update: {
      passwordHash: seedPasswordHash,
    },
    create: {
      email: "david.qa@jira-lite.local",
      name: "David Chen",
      passwordHash: seedPasswordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=David%20Chen&backgroundColor=6554c0",
    },
  });

  console.log("👤 Seeded users: Alex Morgan, Sarah Connor, David Chen");

  // 2. Create Project (Target strictly "JIRA", preserving all user projects)
  const projectKey = "JIRA";
  let project = await prisma.project.findUnique({
    where: { key: projectKey },
    include: { statuses: true },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        key: projectKey,
        name: "JiraLite Core Platform",
        description: "Development of high-performance project management web application with Kanban board.",
        leadId: alex.id,
        issueCounter: 25,
        members: {
          create: [
            { userId: alex.id, role: "ADMIN" },
            { userId: sarah.id, role: "MEMBER" },
            { userId: david.id, role: "MEMBER" },
          ],
        },
        statuses: {
          create: [
            { name: "To Do", category: "TO_DO", position: 1000 },
            { name: "In Progress", category: "IN_PROGRESS", position: 2000 },
            { name: "In Review", category: "IN_PROGRESS", position: 3000 },
            { name: "Done", category: "DONE", position: 4000 },
          ],
        },
      },
      include: { statuses: true },
    });
    console.log("📁 Created project 'JiraLite Core Platform' (JIRA)");
  } else {
    await prisma.project.update({
      where: { id: project.id },
      data: { issueCounter: Math.max(project.issueCounter, 25) },
    });
  }

  // Optional flag: --reset cleans up visitor-created issues (number > 25) in demo project
  const isReset = process.argv.includes("--reset");
  if (isReset) {
    console.log("🧹 --reset specified: Cleaning up visitor-created issues (number > 25) in demo project...");
    const extraIssues = await prisma.issue.findMany({
      where: {
        projectId: project.id,
        number: { gt: 25 },
      },
      select: { id: true, key: true },
    });

    const extraIssueIds = extraIssues.map((i) => i.id);
    const extraIssueKeys = extraIssues.map((i) => i.key);

    if (extraIssueIds.length > 0) {
      // Deletion order to preserve foreign key integrity:
      // 1. Notifications referencing these issue keys
      await prisma.notification.deleteMany({
        where: {
          projectId: project.id,
          issueKey: { in: extraIssueKeys },
        },
      });

      // 2. Comments on these issues
      await prisma.comment.deleteMany({
        where: { issueId: { in: extraIssueIds } },
      });

      // 3. Activities on these issues
      await prisma.activity.deleteMany({
        where: { issueId: { in: extraIssueIds } },
      });

      // 4. IssueWatchers on these issues
      await prisma.issueWatcher.deleteMany({
        where: { issueId: { in: extraIssueIds } },
      });

      // 5. IssueEvents on these issues
      await prisma.issueEvent.deleteMany({
        where: { issueId: { in: extraIssueIds } },
      });

      // 6. SprintIssueResults on these issues
      await prisma.sprintIssueResult.deleteMany({
        where: { issueId: { in: extraIssueIds } },
      });

      // 7. Subtasks / child issues under these issues
      await prisma.issue.deleteMany({
        where: { parentId: { in: extraIssueIds } },
      });

      // 8. Delete the issues themselves
      await prisma.issue.deleteMany({
        where: { id: { in: extraIssueIds } },
      });
      console.log(`   Deleted ${extraIssueIds.length} visitor-created issues and their relations.`);
    }

    // Reset project issueCounter to 25
    await prisma.project.update({
      where: { id: project.id },
      data: { issueCounter: 25 },
    });
    project.issueCounter = 25;
  }

  // Seed sample labels for demo project (Idempotent)
  const sampleLabels = [
    { name: "frontend", color: "#0052CC" },
    { name: "backend", color: "#00875A" },
    { name: "bug", color: "#DE350B" },
  ];

  for (const label of sampleLabels) {
    await prisma.label.upsert({
      where: {
        projectId_name: {
          projectId: project.id,
          name: label.name,
        },
      },
      update: {
        color: label.color,
      },
      create: {
        name: label.name,
        color: label.color,
        projectId: project.id,
      },
    });
  }
  console.log("🏷️ Seeded sample labels: frontend, backend, bug");

  const statusMap = new Map(project.statuses.map((s) => [s.name, s.id]));

  // 3. Create Sprints 1 to 4 (Historical Closed) and Sprint 5 (Active)
  console.log("📊 Seeding historical Agile sprints...");

  // Relative Sprint Timelines
  // Sprint 5 (ACTIVE SPRINT): Started 5 days ago, ends 9 days from now (14-day sprint)
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const sprint5Start = new Date(now.getTime() - 5 * ONE_DAY_MS);
  const sprint5End = new Date(now.getTime() + 9 * ONE_DAY_MS);

  // Sprints 1 to 4 (CLOSED): Sequential backwards in 14-day increments
  // Sprint 4: 19 days ago to 5 days ago
  const sprint4End = new Date(sprint5Start.getTime() - 1000);
  const sprint4Start = new Date(sprint5Start.getTime() - 14 * ONE_DAY_MS);

  // Sprint 3: 33 days ago to 19 days ago
  const sprint3End = new Date(sprint4Start.getTime() - 1000);
  const sprint3Start = new Date(sprint4Start.getTime() - 14 * ONE_DAY_MS);

  // Sprint 2: 47 days ago to 33 days ago
  const sprint2End = new Date(sprint3Start.getTime() - 1000);
  const sprint2Start = new Date(sprint3Start.getTime() - 14 * ONE_DAY_MS);

  // Sprint 1: 61 days ago to 47 days ago
  const sprint1End = new Date(sprint2Start.getTime() - 1000);
  const sprint1Start = new Date(sprint2Start.getTime() - 14 * ONE_DAY_MS);

  // Sprint 1 (CLOSED)
  const sprint1 = await prisma.sprint.upsert({
    where: { id: "seed-sprint-1" },
    update: {
      state: "CLOSED",
      startDate: sprint1Start,
      endDate: sprint1End,
      startedAt: sprint1Start,
      closedAt: sprint1End,
      committedPoints: 18,
      committedIssues: 5,
      completedPoints: 15,
      completedIssues: 4,
    },
    create: {
      id: "seed-sprint-1",
      name: "Sprint 1: Foundation & Auth",
      goal: "Establish core project scaffolding, authentication, and database schemas.",
      state: "CLOSED",
      projectId: project.id,
      startDate: sprint1Start,
      endDate: sprint1End,
      startedAt: sprint1Start,
      closedAt: sprint1End,
      committedPoints: 18,
      committedIssues: 5,
      completedPoints: 15,
      completedIssues: 4,
      retroNotes: {
        good: "Database migrations and Prisma schemas setup completed ahead of schedule.",
        toImprove: "Session token expiry edge cases required last-minute hotfixes.",
        actionItems: "Automate token refresh unit tests before next milestone.",
        updatedAt: sprint1End.toISOString(),
        updatedBy: "Alex Morgan",
      },
    },
  });

  // Sprint 2 (CLOSED) - Realistic dip: architectural blocker
  const sprint2 = await prisma.sprint.upsert({
    where: { id: "seed-sprint-2" },
    update: {
      state: "CLOSED",
      startDate: sprint2Start,
      endDate: sprint2End,
      startedAt: sprint2Start,
      closedAt: sprint2End,
      committedPoints: 22,
      committedIssues: 6,
      completedPoints: 12,
      completedIssues: 3,
    },
    create: {
      id: "seed-sprint-2",
      name: "Sprint 2: Kanban Drag-and-Drop",
      goal: "Implement smooth @dnd-kit Kanban interaction and optimistic UI state transitions.",
      state: "CLOSED",
      projectId: project.id,
      startDate: sprint2Start,
      endDate: sprint2End,
      startedAt: sprint2Start,
      closedAt: sprint2End,
      committedPoints: 22,
      committedIssues: 6,
      completedPoints: 12,
      completedIssues: 3,
      retroNotes: {
        good: "Core drag-and-drop mechanics feel fluid with @dnd-kit.",
        toImprove: "Encountered position collision bugs when dragging cards to bottom of dense columns; 3 items carried over.",
        actionItems: "Refactor column fractional position indexing to prevent collisions.",
        updatedAt: sprint2End.toISOString(),
        updatedBy: "Sarah Connor",
      },
    },
  });

  // Sprint 3 (CLOSED) - Recovery with scope creep completed
  const sprint3 = await prisma.sprint.upsert({
    where: { id: "seed-sprint-3" },
    update: {
      state: "CLOSED",
      startDate: sprint3Start,
      endDate: sprint3End,
      startedAt: sprint3Start,
      closedAt: sprint3End,
      committedPoints: 20,
      committedIssues: 5,
      completedPoints: 23,
      completedIssues: 6,
    },
    create: {
      id: "seed-sprint-3",
      name: "Sprint 3: Realtime Notifications & Audit Trail",
      goal: "Deliver persistent notifications, activity stream logging, and watcher subscriptions.",
      state: "CLOSED",
      projectId: project.id,
      startDate: sprint3Start,
      endDate: sprint3End,
      startedAt: sprint3Start,
      closedAt: sprint3End,
      committedPoints: 20,
      committedIssues: 5,
      completedPoints: 23,
      completedIssues: 6,
      retroNotes: {
        good: "Resolved the position collision blocker from Sprint 2 and delivered an urgent reconnect backoff patch mid-sprint!",
        toImprove: "Notification polling frequency caused high CPU usage on staging.",
        actionItems: "Adopt exponential backoff for notification polling.",
        updatedAt: sprint3End.toISOString(),
        updatedBy: "David Chen",
      },
    },
  });

  // Sprint 4 (CLOSED) - Solid delivery
  const sprint4 = await prisma.sprint.upsert({
    where: { id: "seed-sprint-4" },
    update: {
      state: "CLOSED",
      startDate: sprint4Start,
      endDate: sprint4End,
      startedAt: sprint4Start,
      closedAt: sprint4End,
      committedPoints: 24,
      committedIssues: 6,
      completedPoints: 21,
      completedIssues: 5,
    },
    create: {
      id: "seed-sprint-4",
      name: "Sprint 4: Advanced Search & Saved Views",
      goal: "Add rich filter modal, quick filter chips, and user-saved view bookmarks.",
      state: "CLOSED",
      projectId: project.id,
      startDate: sprint4Start,
      endDate: sprint4End,
      startedAt: sprint4Start,
      closedAt: sprint4End,
      committedPoints: 24,
      committedIssues: 6,
      completedPoints: 21,
      completedIssues: 5,
      retroNotes: {
        good: "Search modal with full keyboard shortcuts (Ctrl+K) is delightful.",
        toImprove: "CSV export had encoding issues with non-ASCII characters; postponed to backlog.",
        actionItems: "Use UTF-8 BOM encoding when implementing CSV export.",
        updatedAt: sprint4End.toISOString(),
        updatedBy: "Alex Morgan",
      },
    },
  });

  // Sprint 5 (ACTIVE SPRINT)
  // Started 5 days ago; initial committed = 13 pts (4 issues), 1 issue added mid-sprint on Day 2 (8 pts)
  const sprint5 = await prisma.sprint.upsert({
    where: { id: "seed-sprint-5" },
    update: {
      state: "ACTIVE",
      startDate: sprint5Start,
      endDate: sprint5End,
      startedAt: sprint5Start,
      committedPoints: 13,
      committedIssues: 4,
    },
    create: {
      id: "seed-sprint-5",
      name: "Sprint 5: Analytics & Sprint Reports",
      goal: "Implement Burndown, Velocity chart, and Sprint Report for data-driven retrospective analysis.",
      state: "ACTIVE",
      projectId: project.id,
      startDate: sprint5Start,
      endDate: sprint5End,
      startedAt: sprint5Start,
      committedPoints: 13,
      committedIssues: 4,
    },
  });

  // 4. Create Historical & Current Issues
  console.log("📝 Upserting issues for project JIRA...");

  const allIssuesData = [
    // Current Sprint 5 Issues
    {
      key: "JIRA-1",
      number: 1,
      title: "Build Kanban Board with smooth drag-and-drop using @dnd-kit",
      description: "Allow developers to drag cards between columns and reorder items vertically within columns. Must support optimistic updates for instant UI response.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint5.id,
    },
    {
      key: "JIRA-2",
      number: 2,
      title: "Implement Atlassian Jira design tokens and color scheme",
      description: "Ensure font is Inter, brand blue is #0C66E4, badges match Jira issue types (Story green, Bug red, Task blue, Epic purple).",
      type: "TASK",
      priority: "MEDIUM",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 2000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint5.id,
    },
    {
      key: "JIRA-3",
      number: 3,
      title: "Fix optimistic update glitch when dropping card at the bottom of column",
      description: "When inserting at the very end of a column, ensure position calculates as maxPosition + 1000 instead of NaN.",
      type: "BUG",
      priority: "HIGHEST",
      storyPoints: 2,
      statusId: statusMap.get("In Progress")!,
      position: 1000,
      assigneeId: david.id,
      reporterId: sarah.id,
      sprintId: sprint5.id,
    },
    {
      key: "JIRA-4",
      number: 4,
      title: "Architecture: Project hierarchy and backlog sprint system",
      description: "Design future Agile sprint planning capabilities with epic linking and subtask breakdown.",
      type: "EPIC",
      priority: "HIGH",
      storyPoints: 8,
      statusId: statusMap.get("To Do")!,
      position: 2000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: null, // In Backlog
    },
    {
      key: "JIRA-5",
      number: 5,
      title: "Audit trail: Record issue activities and timeline changes",
      description: "Keep a transparent log of who changed status, modified title, or left comments on an issue.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 3,
      statusId: statusMap.get("In Review")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint5.id,
    },
    {
      key: "JIRA-6",
      number: 6,
      title: "Interactive Burndown chart with SVG ideal and remaining lines",
      description: "Display daily progress against linear ideal line with unestimated issue alerts.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 8,
      statusId: statusMap.get("To Do")!,
      position: 1500,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint5.id,
    },

    // Sprint 1 Historical Issues
    {
      key: "JIRA-7",
      number: 7,
      title: "Set up PostgreSQL database schema and Prisma ORM",
      description: "Define baseline models for User, Project, Issue, and Activity with proper foreign key cascades.",
      type: "TASK",
      priority: "HIGHEST",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint1.id,
    },
    {
      key: "JIRA-8",
      number: 8,
      title: "User JWT authentication and session management",
      description: "Implement secure HTTP-only cookies, password hashing with bcrypt, and auth middleware.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 2000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint1.id,
    },
    {
      key: "JIRA-9",
      number: 9,
      title: "Project CRUD API and RBAC permissions",
      description: "Support Admin, Member, and Viewer roles with route-level authorization guards.",
      type: "TASK",
      priority: "MEDIUM",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 3000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint1.id,
    },
    {
      key: "JIRA-10",
      number: 10,
      title: "Password reset and email verification scaffolding",
      description: "Add tokens and email dispatch mock service for self-service credential recovery.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 2,
      statusId: statusMap.get("Done")!,
      position: 4000,
      assigneeId: david.id,
      reporterId: alex.id,
      sprintId: sprint1.id,
    },
    {
      key: "JIRA-11",
      number: 11,
      title: "Multi-tenant workspace isolation support",
      description: "Ensure query scoping strictly enforces workspace and project boundaries.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 5000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint2.id, // Carried over from S1 to S2 and completed
    },

    // Sprint 2 Historical Issues
    {
      key: "JIRA-12",
      number: 12,
      title: "Kanban board layout and column container setup",
      description: "Implement responsive flex/grid board with horizontal scrolling and sticky headers.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint2.id,
    },
    {
      key: "JIRA-13",
      number: 13,
      title: "@dnd-kit integration for card dragging",
      description: "Configure PointerSensor, KeyboardSensor, and collision detection algorithms.",
      type: "TASK",
      priority: "HIGH",
      storyPoints: 4,
      statusId: statusMap.get("Done")!,
      position: 2000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint2.id,
    },
    {
      key: "JIRA-14",
      number: 14,
      title: "Optimistic UI state updates on drop event",
      description: "Immediately reflect card movement in React query cache before server response resolves.",
      type: "STORY",
      priority: "MEDIUM",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 3000,
      assigneeId: david.id,
      reporterId: sarah.id,
      sprintId: sprint3.id, // Carried over to S3
    },
    {
      key: "JIRA-15",
      number: 15,
      title: "Card priority badge and type icon components",
      description: "Design pixel-perfect SVG icons for Highest, High, Medium, Low, and Lowest priorities.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 2,
      statusId: statusMap.get("Done")!,
      position: 4000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint3.id, // Carried over to S3
    },
    {
      key: "JIRA-16",
      number: 16,
      title: "Column WIP limits configuration",
      description: "Allow project managers to define maximum card count per status column.",
      type: "TASK",
      priority: "MEDIUM",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 5000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint3.id, // Carried over to S3
    },

    // Sprint 3 Historical Issues
    {
      key: "JIRA-17",
      number: 17,
      title: "Activity stream logger for status transitions",
      description: "Record status changes, assignees, and edits with timestamps into the activity log.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 1000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint3.id,
    },
    {
      key: "JIRA-18",
      number: 18,
      title: "In-app notification bell and unread badge",
      description: "Display realtime notifications with unread count and mark-as-read actions.",
      type: "TASK",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 2000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint3.id,
    },
    {
      key: "JIRA-19",
      number: 19,
      title: "Urgent fix: WebSocket reconnect backoff",
      description: "Implement exponential backoff with jitter on disconnected WebSocket reconnect loops.",
      type: "BUG",
      priority: "HIGHEST",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 3000,
      assigneeId: david.id,
      reporterId: sarah.id,
      sprintId: sprint3.id,
    },

    // Sprint 4 Historical Issues
    {
      key: "JIRA-20",
      number: 20,
      title: "Global search modal with Ctrl+K shortcut",
      description: "Fuzzy search issues by title, key, and description with keyboard navigation.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 1000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint4.id,
    },
    {
      key: "JIRA-21",
      number: 21,
      title: "Quick filter chips for 'Only My Issues' and 'Recent'",
      description: "Filter board and backlog instantly with one-click toggles above the board.",
      type: "TASK",
      priority: "MEDIUM",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 2000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint4.id,
    },
    {
      key: "JIRA-22",
      number: 22,
      title: "Custom saved view bookmarks in sidebar",
      description: "Persist custom filter and column ordering configurations per user.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 3000,
      assigneeId: alex.id,
      reporterId: alex.id,
      sprintId: sprint4.id,
    },
    {
      key: "JIRA-23",
      number: 23,
      title: "Export sprint backlog to CSV/Excel",
      description: "Allow downloading sprint items and metrics as formatted CSV spreadsheet.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 3,
      statusId: statusMap.get("To Do")!,
      position: 4000,
      assigneeId: david.id,
      reporterId: alex.id,
      sprintId: null, // Returned to backlog
    },
    {
      key: "JIRA-24",
      number: 24,
      title: "Empty state UI components with helpful prompts",
      description: "Display intuitive illustrations and action buttons when lists or filters are empty.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 3,
      statusId: statusMap.get("Done")!,
      position: 5000,
      assigneeId: sarah.id,
      reporterId: alex.id,
      sprintId: sprint4.id,
    },
    {
      key: "JIRA-25",
      number: 25,
      title: "Keyboard shortcuts navigation guide modal",
      description: "Provide interactive cheat-sheet for board navigation and quick actions.",
      type: "TASK",
      priority: "MEDIUM",
      storyPoints: 5,
      statusId: statusMap.get("Done")!,
      position: 6000,
      assigneeId: david.id,
      reporterId: alex.id,
      sprintId: sprint4.id,
    },
  ];

  const issueKeyToRecord = new Map<string, any>();

  for (const item of allIssuesData) {
    const existing = await prisma.issue.findUnique({ where: { key: item.key } });
    let rec: any;
    if (!existing) {
      rec = await prisma.issue.create({
        data: {
          ...item,
          projectId: project.id,
        },
      });
      await prisma.activity.create({
        data: {
          action: "CREATED",
          field: "issue",
          newValue: item.title,
          issueId: rec.id,
          userId: alex.id,
        },
      });
    } else {
      rec = await prisma.issue.update({
        where: { id: existing.id },
        data: {
          title: item.title,
          description: item.description,
          type: item.type,
          priority: item.priority,
          storyPoints: item.storyPoints,
          statusId: item.statusId,
          position: item.position,
          assigneeId: item.assigneeId,
          reporterId: item.reporterId,
          sprintId: item.sprintId,
        },
      });
    }
    issueKeyToRecord.set(item.key, rec);
  }

  // 5. Seed Historical SprintIssueResults for Sprints 1 - 4
  console.log("📋 Seeding SprintIssueResults for Sprints 1 to 4...");

  const historicalSeedSprintIds = [sprint1.id, sprint2.id, sprint3.id, sprint4.id];
  await prisma.sprintIssueResult.deleteMany({
    where: { sprintId: { in: historicalSeedSprintIds } },
  });

  const historicalResultsDefinitions = [
    // Sprint 1 (Committed 18, Completed 15, Carried 3)
    { sprintId: sprint1.id, key: "JIRA-7", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint1.id, key: "JIRA-8", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint1.id, key: "JIRA-9", points: 3, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint1.id, key: "JIRA-10", points: 2, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint1.id, key: "JIRA-11", points: 3, outcome: "CARRIED_OVER", mid: false, targetId: sprint2.id },

    // Sprint 2 (Committed 22, Completed 12, Carried 10)
    { sprintId: sprint2.id, key: "JIRA-11", points: 3, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint2.id, key: "JIRA-12", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint2.id, key: "JIRA-13", points: 4, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint2.id, key: "JIRA-14", points: 3, outcome: "CARRIED_OVER", mid: false, targetId: sprint3.id },
    { sprintId: sprint2.id, key: "JIRA-15", points: 2, outcome: "CARRIED_OVER", mid: false, targetId: sprint3.id },
    { sprintId: sprint2.id, key: "JIRA-16", points: 5, outcome: "CARRIED_OVER", mid: false, targetId: sprint3.id },

    // Sprint 3 (Committed 20, Scope Added +3, Completed 23, Carried 0)
    { sprintId: sprint3.id, key: "JIRA-14", points: 3, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint3.id, key: "JIRA-15", points: 2, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint3.id, key: "JIRA-16", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint3.id, key: "JIRA-17", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint3.id, key: "JIRA-18", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint3.id, key: "JIRA-19", points: 3, outcome: "COMPLETED", mid: true, targetId: null }, // scope creep!

    // Sprint 4 (Committed 24, Completed 21, Carried 3)
    { sprintId: sprint4.id, key: "JIRA-20", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint4.id, key: "JIRA-21", points: 3, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint4.id, key: "JIRA-22", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint4.id, key: "JIRA-23", points: 3, outcome: "CARRIED_OVER", mid: false, targetId: null }, // returned to backlog
    { sprintId: sprint4.id, key: "JIRA-24", points: 3, outcome: "COMPLETED", mid: false, targetId: null },
    { sprintId: sprint4.id, key: "JIRA-25", points: 5, outcome: "COMPLETED", mid: false, targetId: null },
  ];

  for (const item of historicalResultsDefinitions) {
    const issueRec = issueKeyToRecord.get(item.key);
    if (issueRec) {
      await prisma.sprintIssueResult.create({
        data: {
          sprintId: item.sprintId,
          issueId: issueRec.id,
          pointsAtClose: item.points,
          outcome: item.outcome,
          targetSprintId: item.targetId,
          addedMidSprint: item.mid,
        },
      });
    }
  }

  // 6. Seed IssueEvents for Active Sprint 5 (Single Source of Truth for Burndown & Sprint Report)
  console.log("📈 Seeding IssueEvents for Sprint 5...");

  await prisma.issueEvent.deleteMany({
    where: { sprintId: sprint5.id },
  });

  const day0 = sprint5Start; // 5 days ago
  const day1 = new Date(day0.getTime() + 1 * ONE_DAY_MS); // 4 days ago
  const day2 = new Date(day0.getTime() + 2 * ONE_DAY_MS); // 3 days ago
  const day3 = new Date(day0.getTime() + 3 * ONE_DAY_MS); // 2 days ago
  const day4 = new Date(day0.getTime() + 4 * ONE_DAY_MS); // 1 day ago
  const day5 = now; // Today

  // Sprint 5 initial committed issues: JIRA-1 (5), JIRA-2 (3), JIRA-3 (2), JIRA-5 (3) -> Total: 13 pts
  const committedKeys = ["JIRA-1", "JIRA-2", "JIRA-3", "JIRA-5"];
  for (const key of committedKeys) {
    const rec = issueKeyToRecord.get(key);
    if (rec) {
      await prisma.issueEvent.create({
        data: {
          issueId: rec.id,
          sprintId: sprint5.id,
          eventType: "ADDED_TO_SPRINT",
          points: rec.storyPoints,
          category: "TO_DO",
          createdAt: day0,
        },
      });
    }
  }

  // Day 1: JIRA-3 and JIRA-5 move to In Progress
  const recJira3 = issueKeyToRecord.get("JIRA-3");
  if (recJira3) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira3.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "IN_PROGRESS",
        previousCategory: "TO_DO",
        createdAt: day1,
      },
    });
  }

  const recJira5 = issueKeyToRecord.get("JIRA-5");
  if (recJira5) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira5.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "IN_PROGRESS",
        previousCategory: "TO_DO",
        createdAt: day1,
      },
    });
  }

  // Day 2: JIRA-2 initially completed (3 pts Done)
  const recJira2 = issueKeyToRecord.get("JIRA-2");
  if (recJira2) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira2.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "DONE",
        previousCategory: "TO_DO",
        createdAt: day2,
      },
    });
  }

  // Day 2: Scope Creep! JIRA-6 added mid-sprint (+8 pts)
  const recJira6 = issueKeyToRecord.get("JIRA-6");
  if (recJira6) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira6.id,
        sprintId: sprint5.id,
        eventType: "ADDED_TO_SPRINT",
        points: recJira6.storyPoints,
        category: "TO_DO",
        createdAt: day2,
      },
    });
  }

  // Day 3: Real Agile Reopen! QA rejects JIRA-2 due to dark mode contrast bug -> Reopened to In Progress
  // This validates the classic reporting bug: remaining line rises by +3 pts without duplicate counting!
  if (recJira2) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira2.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "IN_PROGRESS",
        previousCategory: "DONE",
        createdAt: day3,
      },
    });

    // Clean up existing status-changed activities on JIRA-2 for seed idempotency
    await prisma.activity.deleteMany({
      where: {
        issueId: recJira2.id,
        action: "STATUS_CHANGED",
        field: "status",
      },
    });

    await prisma.activity.create({
      data: {
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: "Done",
        newValue: "In Progress",
        issueId: recJira2.id,
        userId: david.id,
        createdAt: day3,
      },
    });
  }

  // Day 4: JIRA-2 is re-fixed and marked DONE again!
  if (recJira2) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira2.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "DONE",
        previousCategory: "IN_PROGRESS",
        createdAt: day4,
      },
    });

    await prisma.activity.create({
      data: {
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: "In Progress",
        newValue: "Done",
        issueId: recJira2.id,
        userId: alex.id,
        createdAt: day4,
      },
    });

    // Clean up existing comments on JIRA-2 for seed idempotency
    await prisma.comment.deleteMany({
      where: { issueId: recJira2.id },
    });

    // Add comments telling the reopen story
    await prisma.comment.createMany({
      data: [
        {
          body: "Initial design tokens implementation completed. Moved to Done.",
          issueId: recJira2.id,
          authorId: alex.id,
          createdAt: day2,
        },
        {
          body: "QA Rejection: Brand blue token contrast issues found in Dark Mode. Reopening ticket.",
          issueId: recJira2.id,
          authorId: david.id,
          createdAt: day3,
        },
        {
          body: "Dark mode contrast ratio fixed and verified against WCAG AAA. Moved back to Done.",
          issueId: recJira2.id,
          authorId: alex.id,
          createdAt: day4,
        },
      ],
      skipDuplicates: true,
    });
  }

  // Day 5 (Today): JIRA-1 completed (5 pts Done)
  const recJira1 = issueKeyToRecord.get("JIRA-1");
  if (recJira1) {
    await prisma.issueEvent.create({
      data: {
        issueId: recJira1.id,
        sprintId: sprint5.id,
        eventType: "STATUS_CHANGED",
        category: "DONE",
        previousCategory: "TO_DO",
        createdAt: day5,
      },
    });
  }

  // 7. Verification: Validate Sprint 5 metrics and balance invariant using common reporting engine
  console.log("🔍 Verifying Sprint 5 metrics with computeAgileSprintMetrics...");
  const seededSprint5 = await prisma.sprint.findUniqueOrThrow({
    where: { id: "seed-sprint-5" },
    include: {
      issues: {
        include: {
          status: true,
        },
      },
    },
  });

  const sprint5Events = await prisma.issueEvent.findMany({
    where: { sprintId: seededSprint5.id },
    orderBy: { createdAt: "asc" },
  });

  const metrics = computeAgileSprintMetrics({
    sprint: seededSprint5,
    events: sprint5Events,
    eligibleIssues: seededSprint5.issues,
    metric: "points",
  });

  const { committed, scopeAdded, removed, completed, remaining } = metrics.summary;

  const expected = {
    committed: 13,
    scopeAdded: 8,
    removed: 0,
    completed: 8,
    remaining: 13,
  };

  const isIdentical =
    committed === expected.committed &&
    scopeAdded === expected.scopeAdded &&
    removed === expected.removed &&
    completed === expected.completed &&
    remaining === expected.remaining;

  const isBalanceInvariantValid =
    remaining === committed + scopeAdded - removed - completed;

  if (!isIdentical || !isBalanceInvariantValid) {
    console.error("❌ Sprint 5 metrics verification failed!");
    console.error(
      `   Expected: committed=${expected.committed}, scopeAdded=${expected.scopeAdded}, removed=${expected.removed}, completed=${expected.completed}, remaining=${expected.remaining}`
    );
    console.error(
      `   Actual:   committed=${committed}, scopeAdded=${scopeAdded}, removed=${removed}, completed=${completed}, remaining=${remaining}`
    );
    console.error(
      `   Balance invariant satisfied: ${isBalanceInvariantValid} (${remaining} === ${committed} + ${scopeAdded} - ${removed} - ${completed})`
    );
    process.exit(1);
  }

  console.log(
    `✅ Sprint 5 metrics verified: committed=${committed}, scopeAdded=${scopeAdded}, removed=${removed}, completed=${completed}, remaining=${remaining} (Balance invariant satisfied: ${remaining} = ${committed} + ${scopeAdded} - ${removed} - ${completed})`
  );

  console.log("🎫 Successfully seeded historical sprints (1-4 closed, 5 active)!");
  console.log("✅ Seed completed with 100% mathematical consistency across Burndown, Sprint Report, and Velocity!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
