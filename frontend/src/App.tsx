import React, { useState, useEffect } from "react";
import { useAuthStore } from "./store/auth";
import { useToastStore } from "./store/toast";
import { api } from "./lib/api";
import { Project, Issue } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { BoardPage } from "./pages/BoardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
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
  const [activeView, setActiveView] = useState<"board" | "projects" | "backlog" | "settings">("board");

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
      toast.error("Sesi Anda telah berakhir. Silakan masuk kembali.");
    };

    window.addEventListener("jira_session_expired", handleSessionExpired);
    return () => window.removeEventListener("jira_session_expired", handleSessionExpired);
  }, [logout, toast]);

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
        setIssues([]);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      toast.error("Gagal memuat daftar project.");
    }
  };

  const loadProjectDetail = async (key: string) => {
    try {
      setLoadingProject(true);
      const res = await api.projects.get(key);
      setCurrentProject(res.project);

      // Fetch issues for this project
      const issuesRes = await api.issues.list(key);
      setIssues(issuesRes.issues);
      setActiveView("board");
    } catch (err) {
      console.error("Failed to load project details:", err);
      toast.error(`Gagal memuat detail project ${key}.`);
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  // Global Keyboard Shortcuts (C for Create, / for Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (!isInput) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          if (currentProject) {
            setIsCreateIssueOpen(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProject]);

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
      toast.error(err.message || "Gagal membuat item.");
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
      toast.error(err.message || "Gagal membuat item.");
      throw err;
    }
  };

  // Issue update
  const handleIssueUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  // Issue delete
  const handleIssueDeleted = (key: string) => {
    setIssues((prev) => prev.filter((i) => i.key !== key));
    toast.success(t.toast.deletedSuccess(key));
  };

  // Project creation submit
  const handleCreateProject = async (data: {
    name: string;
    key: string;
    description?: string;
  }) => {
    try {
      const res = await api.projects.create(data);
      toast.success(`Project ${res.project.name} berhasil dibuat!`);
      await loadProjects(res.project.key);
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat project.");
    }
  };

  // Handle opening issue detail from notification or search
  const handleOpenIssueFromNav = (issueKey: string) => {
    setSelectedIssueKeyForDetail(issueKey);
    setActiveView("board");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-jira-blue flex items-center justify-center text-white shadow-md">
          <Loader2 size={22} className="animate-spin" />
        </div>
        <p className="text-xs font-semibold text-jira-subtle">{t.common.loading}</p>
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
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
            ) : activeView === "board" ? (
              <BoardPage
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
              />
            ) : activeView === "backlog" ? (
              <div className="p-8 text-center max-w-lg mx-auto my-auto select-none">
                <div className="w-14 h-14 rounded-2xl bg-blue-50/80 border border-blue-100 text-jira-blue flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                  📋
                </div>
                <h2 className="text-base font-bold text-jira-text">
                  Sprint &amp; Backlog
                </h2>
                <p className="text-xs text-jira-subtle mt-1.5 leading-relaxed">
                  Perencanaan sprint dan partisi backlog terintegrasi langsung dengan skema database saat ini.
                  Papan Kanban aktif Anda dapat digunakan secara real-time.
                </p>
                <button
                  onClick={() => setActiveView("board")}
                  className="mt-4 px-4 py-2 bg-jira-blue text-white text-xs font-semibold rounded-md hover:bg-jira-blue-hover transition shadow-sm"
                >
                  Kembali ke Papan Kanban
                </button>
              </div>
            ) : (
              <div className="p-8 max-w-2xl mx-auto w-full overflow-y-auto">
                <h2 className="text-lg font-bold text-jira-text mb-4">
                  {t.sidebar.settings}
                </h2>
                <div className="bg-white border border-jira-border rounded-lg p-5 space-y-4 text-xs shadow-card">
                  <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-bold text-jira-subtle uppercase text-[10px] tracking-wider">
                        Nama Project
                      </span>
                      <p className="text-sm font-bold text-jira-text mt-0.5">
                        {currentProject.name}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-jira-subtle uppercase text-[10px] tracking-wider">
                        Key Project
                      </span>
                      <p className="font-mono text-sm font-bold text-jira-blue mt-0.5">
                        {currentProject.key}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-jira-subtle uppercase text-[10px] tracking-wider">
                      Deskripsi
                    </span>
                    <p className="text-xs text-jira-text mt-1 leading-relaxed">
                      {currentProject.description || "Tidak ada deskripsi"}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-jira-subtle uppercase text-[10px] tracking-wider">
                      Alur Status (Workflow)
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {currentProject.statuses.map((s) => (
                        <span
                          key={s.id}
                          className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold text-jira-text text-xs"
                        >
                          {s.name} ({s.category})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-jira-subtle uppercase text-[10px] tracking-wider">
                      Anggota Project ({currentProject.members.length})
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      {currentProject.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 bg-slate-50 border border-jira-border px-2.5 py-1 rounded-md"
                          title={`${m.user.name} (${m.role})`}
                        >
                          <img
                            src={
                              m.user.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                m.user.name
                              )}`
                            }
                            alt={m.user.name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-xs font-semibold text-jira-text">
                            {m.user.name}
                          </span>
                          <span className="text-[10px] bg-blue-100 text-jira-blue px-1.5 py-0.2 rounded font-bold">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <EmptyState
                icon={FolderKanban}
                title="Belum Ada Project yang Dipilih"
                description="Pilih salah satu project Anda dari navbar atau buat project baru untuk mulai mengelola pekerjaan."
                actionLabel="Buat Project Pertama"
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
