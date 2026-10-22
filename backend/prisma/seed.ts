import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting JiraLite database seed...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Users
  const alex = await prisma.user.upsert({
    where: { email: "alex.lead@jira-lite.local" },
    update: {},
    create: {
      email: "alex.lead@jira-lite.local",
      name: "Alex Morgan",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan&backgroundColor=0c66e4",
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "sarah.dev@jira-lite.local" },
    update: {},
    create: {
      email: "sarah.dev@jira-lite.local",
      name: "Sarah Connor",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Sarah%20Connor&backgroundColor=00875a",
    },
  });

  const david = await prisma.user.upsert({
    where: { email: "david.qa@jira-lite.local" },
    update: {},
    create: {
      email: "david.qa@jira-lite.local",
      name: "David Chen",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=David%20Chen&backgroundColor=6554c0",
    },
  });

  console.log("👤 Seeded users: Alex Morgan, Sarah Connor, David Chen");

  // 2. Create Project
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
        issueCounter: 5,
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
  }

  const statusMap = new Map(project.statuses.map((s) => [s.name, s.id]));

  // 3. Create Seed Issues
  const issuesData = [
    {
      key: "JIRA-1",
      number: 1,
      title: "Build Kanban Board with smooth drag-and-drop using @dnd-kit",
      description: "Allow developers to drag cards between columns and reorder items vertically within columns. Must support optimistic updates for instant UI response.",
      type: "STORY",
      priority: "HIGH",
      storyPoints: 5,
      statusId: statusMap.get("In Progress")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
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
      position: 1000,
      assigneeId: alex.id,
      reporterId: alex.id,
    },
    {
      key: "JIRA-3",
      number: 3,
      title: "Fix optimistic update glitch when dropping card at the bottom of column",
      description: "When inserting at the very end of a column, ensure position calculates as maxPosition + 1000 instead of NaN.",
      type: "BUG",
      priority: "HIGHEST",
      storyPoints: 2,
      statusId: statusMap.get("To Do")!,
      position: 1000,
      assigneeId: david.id,
      reporterId: sarah.id,
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
    },
    {
      key: "JIRA-5",
      number: 5,
      title: "Audit trail: Record issue activities and timeline changes",
      description: "Keep a transparent log of who changed status, modified title, or left comments on an issue.",
      type: "TASK",
      priority: "LOW",
      storyPoints: 2,
      statusId: statusMap.get("In Review")!,
      position: 1000,
      assigneeId: sarah.id,
      reporterId: alex.id,
    },
  ];

  for (const issueItem of issuesData) {
    const existing = await prisma.issue.findUnique({ where: { key: issueItem.key } });
    if (!existing) {
      const createdIssue = await prisma.issue.create({
        data: {
          ...issueItem,
          projectId: project.id,
        },
      });

      // Add a comment
      await prisma.comment.create({
        data: {
          body: `Initial scope verified for ${issueItem.key}. Working on validation.`,
          issueId: createdIssue.id,
          authorId: alex.id,
        },
      });

      // Add activity
      await prisma.activity.create({
        data: {
          action: "CREATED",
          field: "issue",
          newValue: issueItem.title,
          issueId: createdIssue.id,
          userId: alex.id,
        },
      });
    }
  }

  console.log("🎫 Seeded 5 initial Jira issues with comments & activities");
  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
