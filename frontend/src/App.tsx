import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "./store/auth";
import { useToastStore } from "./store/toast";
import { useProjectStore } from "./store/project";
import { can, getUserRole } from "./lib/permissions";
import { api, isSessionExpired, isSessionExpiredError } from "./lib/api";
import { Project, Issue, Status } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { BoardPage } from "./pages/BoardPage";
import { ListPage } from "./pages/ListPage";
import { BacklogPage } from "./pages/BacklogPage";
import { SummaryPage } from "./pages/SummaryPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { CreateIssueModal } from "./components/CreateIssueModal";
import { ToastContainer } from "./components/ToastContainer";
import { BoardSkeleton } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";
import { FolderKanban, Loader2 } from "lucide-react";
import { t } from "./lib/i18n";

export function App() {
  const { isAuthenticated, isLoading, initialize, logout } = useAuthStore();
  const toast = useToastStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);
  const [activeView, setActiveView] = useState<"summary" | "board" | "list" | "projects" | "backlog" | "reports" | "settings">("board");
  const [targetSprintReportId, setTargetSprintReportId] = useState<string | null>(null);

  // Deep linked or notification selected issue key
  const [selectedIssueKeyForDetail, setSelectedIssueKeyForDetail] = useState<string | null>(null);

  // Modals & search
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  // Initialize Auth
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle Session Expiry (401)
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener("jira_session_expired", handleSessionExpired);
    return () => window.removeEventListener("jira_session_expired", handleSessionExpired);
  }, [logout]);

  // Load Projects once authenticated
  const loadProjects = async (autoSelectKey?: string) => {
    try {
      const res = await api.projects.list();
      setProjects(res.projects);

      if (res.projects.length > 0) {
        const target = autoSelectKey
          ? res.projects.find((p) => p.key === autoSelectKey)
          : res.projects[0];
        if (target) {
          loadProjectDetail(target.key);
        }
      } else {
        setCurrentProject(null);
        useProjectStore.getState().setCurrentProject(null);
        setIssues([]);
      }
    } catch (err) {
      if (isSessionExpired() || isSessionExpiredError(err) || !useAuthStore.getState().isAuthenticated) {
        return;
      }
      console.error("Failed to load projects:", err);
      toast.error("Failed to load projects list.");
    }
  };

  const loadProjectDetail = async (key: string) => {
    try {
      setLoadingProject(true);

      // Clear search query params when switching projects to avoid stale cross-project filters
      const url = new URL(window.location.href);
      if (url.search) {
        url.search = "";
        window.history.replaceState({}, "", url.toString());
      }

      const res = await api.projects.get(key);
      setCurrentProject(res.project);
      useProjectStore.getState().setCurrentProject(res.project);

      // Fetch issues for this project
      const issuesRes = await api.issues.list(key);
      setIssues(issuesRes.issues);
      setActiveView("board");
    } catch (err) {
      if (isSessionExpired() || isSessionExpiredError(err) || !useAuthStore.getState().isAuthenticated) {
        return;
      }
      console.error("Failed to load project details:", err);
      toast.error(`Failed to load project details for ${key}.`);
    } finally {
      setLoadingProject(false);
    }
  };

  const refreshIssues = async () => {
    if (!currentProject) return;
    try {
      const issuesRes = await api.issues.list(currentProject.key);
      setIssues(issuesRes.issues);
    } catch (err) {
      console.error("Failed to refresh issues:", err);
    }
  };

  // Realtime board sync: periodically poll issues to reflect changes from teammates
  useEffect(() => {
    if (!isAuthenticated || !currentProject) return;

    let isSubscribed = true;

    const interval = setInterval(async () => {
      try {
        const issuesRes = await api.issues.list(currentProject.key);
        if (!isSubscribed) return;

        setIssues((prev) => {
          const prevSig = prev
            .map(
              (i) =>
                `${i.id}_${i.statusId}_${i.position}_${i.updatedAt}_${
                  i._count?.comments || 0
                }_${i.startDate || ""}_${i.dueDate || ""}_${i.priority}_${
                  i.assigneeId || ""
                }`
            )
            .join("|");
          const nextSig = issuesRes.issues
            .map(
              (i) =>
                `${i.id}_${i.statusId}_${i.position}_${i.updatedAt}_${
                  i._count?.comments || 0
                }_${i.startDate || ""}_${i.dueDate || ""}_${i.priority}_${
                  i.assigneeId || ""
                }`
            )
            .join("|");

          if (prevSig !== nextSig) {
            return issuesRes.issues;
          }
          return prev;
        });
      } catch (err) {
        // Silently ignore background board polling error
      }
    }, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, currentProject]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  const { user } = useAuthStore();

  // Global Keyboard Shortcuts (C for Create, / for Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        !!activeElement?.isContentEditable ||
        !!activeElement?.closest("[contenteditable='true']");

      if (!isInput) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          const userRole = getUserRole(currentProject, user?.id);
          if (currentProject && can(userRole, "issue:create")) {
            setIsCreateIssueOpen(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProject, user]);

  // Handle Drag & Drop move
  const handleMoveIssue = async (
    issueKey: string,
    statusId: string,
    position: number,
    updatedIssues: Issue[]
  ) => {
    // 1. Optimistic update
    setIssues(updatedIssues);

    // 2. Network call to backend
    try {
      const res = await api.issues.move(issueKey, { statusId, position });
      setIssues((prev) =>
        prev.map((i) => (i.key === issueKey ? res.issue : i))
      );
    } catch (err) {
      console.error("Move issue failed:", err);
      // Re-fetch issues on failure
      if (currentProject) {
        const fallback = await api.issues.list(currentProject.key);
        setIssues(fallback.issues);
      }
      throw err;
    }
  };

  // Quick inline creation in a column
  const handleQuickCreate = async (statusId: string, title: string) => {
    if (!currentProject) return;
    try {
      const res = await api.issues.create(currentProject.key, {
        title,
        type: "TASK",
        priority: "MEDIUM",
        statusId,
      });
      setIssues((prev) => [...prev, res.issue]);
      toast.success(t.toast.createdSuccess(res.issue.key));
    } catch (err: any) {
      toast.error(err.message || "Failed to create work item.");
    }
  };

  // Modal issue create submit
  const handleSubmitCreateIssue = async (data: any) => {
    if (!currentProject) return;
    try {
      const res = await api.issues.create(currentProject.key, data);
      setIssues((prev) => [...prev, res.issue]);
      toast.success(t.toast.createdSuccess(res.issue.key));
    } catch (err: any) {
      toast.error(err.message || "Failed to create work item.");
      throw err;
    }
  };

  // Issue update
  const handleIssueUpdated = useCallback((updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
  }, []);

  // Issue delete
  const handleIssueDeleted = useCallback((key: string) => {
    setIssues((prev) => prev.filter((i) => i.key !== key));
    toast.success(t.toast.deletedSuccess(key));
  }, [toast]);

  // Status added
  const handleStatusAdded = (newStatus: Status) => {
    if (!currentProject) return;
    const updatedStatuses = [...currentProject.statuses, newStatus].sort(
      (a, b) => a.position - b.position
    );
    const updatedProject = {
      ...currentProject,
      statuses: updatedStatuses,
    };
    setCurrentProject(updatedProject);
    useProjectStore.getState().setCurrentProject(updatedProject);
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  // Status deleted
  const handleStatusDeleted = (statusId: string) => {
    if (!currentProject) return;
    const updatedStatuses = currentProject.statuses.filter((s) => s.id !== statusId);
    const updatedProject = {
      ...currentProject,
      statuses: updatedStatuses,
    };
    setCurrentProject(updatedProject);
    useProjectStore.getState().setCurrentProject(updatedProject);
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  // Statuses reordered
  const handleStatusesReordered = (newStatuses: Status[]) => {
    if (!currentProject) return;
    const updatedProject = {
      ...currentProject,
      statuses: newStatuses,
    };
    setCurrentProject(updatedProject);
    useProjectStore.getState().setCurrentProject(updatedProject);
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  // Project creation submit
  const handleCreateProject = async (data: {
    name: string;
    key: string;
    description?: string;
  }) => {
    try {
      const res = await api.projects.create(data);
      toast.success(`Project '${res.project.name}' created successfully!`);
      await loadProjects(res.project.key);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project.");
    }
  };

  // Handle opening issue detail from notification or search
  const handleOpenIssueFromNav = (issueKey: string) => {
    setSelectedIssueKeyForDetail(issueKey);
    setActiveView("board");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] dark:bg-jira-dark-bg flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-jira-blue flex items-center justify-center text-white shadow-md">
          <Loader2 size={22} className="animate-spin" />
        </div>
        <p className="text-xs font-semibold text-jira-subtle dark:text-slate-400">{t.common.loading}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text">
      {/* Top Navigation */}
      <Navbar
        currentProject={currentProject}
        projects={projects}
        onSelectProject={(key) => loadProjectDetail(key)}
        onCreateIssueClick={() => setIsCreateIssueOpen(true)}
        onProjectsClick={() => setActiveView("projects")}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
        onOpenIssue={handleOpenIssueFromNav}
      />

      {/* Main Content Area: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        {currentProject && (
          <Sidebar
            currentProject={currentProject}
            activeView={activeView === "projects" ? "board" : activeView}
            onSelectView={(v) => setActiveView(v)}
          />
        )}

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {activeView === "projects" ? (
            <ProjectsPage
              projects={projects}
              onSelectProject={(key) => loadProjectDetail(key)}
              onOpenCreateModal={() => setIsCreateProjectOpen(true)}
            />
          ) : currentProject ? (
            loadingProject ? (
              <BoardSkeleton />
            ) : activeView === "summary" ? (
              <SummaryPage
                project={currentProject}
                issues={issues}
                onSwitchView={(v) => setActiveView(v)}
                onSubmitCreateIssue={handleSubmitCreateIssue}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
                initialSelectedIssueKey={selectedIssueKeyForDetail}
                onClearInitialIssueKey={() => setSelectedIssueKeyForDetail(null)}
              />
            ) : activeView === "board" ? (
              <BoardPage
                key={currentProject.key}
                project={currentProject}
                issues={issues}
                onMoveIssue={handleMoveIssue}
                onQuickCreate={handleQuickCreate}
                onSubmitCreateIssue={handleSubmitCreateIssue}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
                isCreateModalOpen={isCreateIssueOpen}
                setIsCreateModalOpen={setIsCreateIssueOpen}
                initialSelectedIssueKey={selectedIssueKeyForDetail}
                onClearInitialIssueKey={() => setSelectedIssueKeyForDetail(null)}
                onSwitchView={(v) => setActiveView(v)}
              />
            ) : activeView === "list" ? (
              <ListPage
                project={currentProject}
                issues={issues}
                onSwitchView={(v) => setActiveView(v)}
                onSubmitCreateIssue={handleSubmitCreateIssue}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
                initialSelectedIssueKey={selectedIssueKeyForDetail}
                onClearInitialIssueKey={() => setSelectedIssueKeyForDetail(null)}
              />
            ) : activeView === "backlog" ? (
              <BacklogPage
                project={currentProject}
                issues={issues}
                onSwitchView={(v, sprintReportId) => {
                  setActiveView(v);
                  if (sprintReportId) setTargetSprintReportId(sprintReportId);
                }}
                onSubmitCreateIssue={handleSubmitCreateIssue}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
                onRefreshIssues={refreshIssues}
                initialSelectedIssueKey={selectedIssueKeyForDetail}
                onClearInitialIssueKey={() => setSelectedIssueKeyForDetail(null)}
              />
            ) : activeView === "reports" ? (
              <ReportsPage
                project={currentProject}
                initialSprintId={targetSprintReportId}
                onOpenIssueDetail={(key) => setSelectedIssueKeyForDetail(key)}
              />
            ) : activeView === "settings" ? (
              <ProjectSettingsPage
                project={currentProject}
                onProjectUpdated={(updatedProject) => {
                  setCurrentProject(updatedProject);
                  useProjectStore.getState().setCurrentProject(updatedProject);
                  setProjects((prev) =>
                    prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
                  );
                }}
                onProjectDeleted={(deletedKey) => {
                  setProjects((prev) => prev.filter((p) => p.key !== deletedKey));
                  setCurrentProject(null);
                  useProjectStore.getState().setCurrentProject(null);
                  setActiveView("projects");
                }}
                onSwitchView={(v) => setActiveView(v)}
              />
            ) : (
              <BoardPage
                project={currentProject}
                issues={issues}
                onMoveIssue={handleMoveIssue}
                onQuickCreate={handleQuickCreate}
                onSubmitCreateIssue={handleSubmitCreateIssue}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
                onStatusAdded={handleStatusAdded}
                onStatusDeleted={handleStatusDeleted}
                onStatusesReordered={handleStatusesReordered}
                isCreateModalOpen={isCreateIssueOpen}
                setIsCreateModalOpen={setIsCreateIssueOpen}
                initialSelectedIssueKey={selectedIssueKeyForDetail}
                onClearInitialIssueKey={() => setSelectedIssueKeyForDetail(null)}
                onSwitchView={(v) => setActiveView(v)}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-jira-dark-bg">
              <EmptyState
                icon={FolderKanban}
                title="No Project Selected"
                description="Select a project from the top navigation or create a new project to start managing work."
                actionLabel="Create Project"
                onAction={() => setIsCreateProjectOpen(true)}
              />
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmitCreate={handleCreateProject}
      />

      {/* Global Create Issue Modal */}
      {currentProject && activeView !== "board" && (
        <CreateIssueModal
          isOpen={isCreateIssueOpen}
          onClose={() => setIsCreateIssueOpen(false)}
          project={currentProject}
          onIssueCreated={() => loadProjectDetail(currentProject.key)}
          onSubmitCreate={handleSubmitCreateIssue}
        />
      )}

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default App;
