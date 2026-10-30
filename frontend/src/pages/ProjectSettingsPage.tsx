import React, { useState, useEffect } from "react";
import { Project, ProjectMember, User, ProjectRole } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { useAuthStore } from "../store/auth";
import { usePermission } from "../lib/permissions";
import { useThemeStore, ThemeMode } from "../store/theme";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { t } from "../lib/i18n";
import {
  Users,
  Settings,
  GitCommit,
  AlertTriangle,
  Search,
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Lock,
  Calendar,
  Save,
  Loader2,
  X,
  Crown,
  ChevronDown,
  Bell,
  Info,
  Sun,
  Moon,
  Monitor,
  Palette,
  Check,
} from "lucide-react";

interface ProjectSettingsPageProps {
  project: Project;
  onProjectUpdated: (updated: Project) => void;
  onProjectDeleted: (key: string) => void;
  onSwitchView: (view: "board" | "list" | "backlog" | "settings") => void;
}

export const ProjectSettingsPage: React.FC<ProjectSettingsPageProps> = ({
  project,
  onProjectUpdated,
  onProjectDeleted,
  onSwitchView,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { theme: currentTheme, setTheme } = useThemeStore();
  const { isAdmin } = usePermission("project:settings", project);
  const isLead = project.leadId === user?.id;

  const [activeTab, setActiveTab] = useState<"members" | "general" | "workflow" | "appearance" | "danger">("members");

  // General tab state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Members tab state
  const [members, setMembers] = useState<ProjectMember[]>(project.members || []);
  const [memberSearch, setMemberSearch] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<ProjectRole>("MEMBER");
  const [addingMember, setAddingMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Member to remove state
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Role changing state tracking
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [adminConfirmationAcknowledged, setAdminConfirmationAcknowledged] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<{ member: ProjectMember; newRole: ProjectRole } | null>(null);

  // Danger zone state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);

  // Synchronize state when project prop changes
  useEffect(() => {
    setName(project.name);
    setDescription(project.description || "");
    setMembers(project.members || []);
  }, [project]);

  // Load available users when add member modal opens
  useEffect(() => {
    if (isAddMemberOpen) {
      setLoadingUsers(true);
      api.projects
        .getAvailableUsers(project.key)
        .then((res) => {
          setAvailableUsers(res.users);
        })
        .catch((err) => {
          console.error("Failed to load users:", err);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [isAddMemberOpen, project.key]);

  // Filter members by search input
  const filteredMembers = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.user.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.role.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Handle Save General Info
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Only Admins can modify project details.");
      return;
    }

    try {
      setSavingGeneral(true);
      const res = await api.projects.update(project.key, {
        name: name.trim(),
        description: description.trim() || null,
      });

      onProjectUpdated(res.project);
      toast.success(t.projectSettings.general.saveSuccess);
    } catch (err: any) {
      console.error("Failed to update project:", err);
      toast.error(err.message || "Failed to update project details.");
    } finally {
      setSavingGeneral(false);
    }
  };

  // Handle Change Member Role
  const handleChangeRole = async (targetUserId: string, newRole: ProjectRole) => {
    if (!isAdmin) {
      toast.error("Only Admins can modify member roles.");
      return;
    }

    try {
      setUpdatingRoleId(targetUserId);
      const res = await api.projects.updateMemberRole(project.key, targetUserId, newRole);

      const updatedMembers = members.map((m) =>
        m.userId === targetUserId ? { ...m, role: res.member.role } : m
      );
      setMembers(updatedMembers);
      onProjectUpdated({ ...project, members: updatedMembers });
      toast.success(t.projectSettings.members.changeRoleSuccess);
    } catch (err: any) {
      console.error("Failed to change member role:", err);
      toast.error(err.message || "Failed to update member role.");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Security check before changing role to ADMIN
  const handleRoleDropdownChange = (member: ProjectMember, newRole: ProjectRole) => {
    if (newRole === "ADMIN" && member.role !== "ADMIN") {
      setPromoteTarget({ member, newRole });
    } else {
      handleChangeRole(member.userId, newRole);
    }
  };

  const handleConfirmPromoteAdmin = async () => {
    if (!promoteTarget) return;
    await handleChangeRole(promoteTarget.member.userId, promoteTarget.newRole);
    setPromoteTarget(null);
  };

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      toast.error("Please enter or select a user email.");
      return;
    }

    try {
      setAddingMember(true);
      const res = await api.projects.addMember(project.key, {
        email: addEmail.trim().toLowerCase(),
        role: addRole,
      });

      const updatedMembers = [...members, res.member];
      setMembers(updatedMembers);
      onProjectUpdated({ ...project, members: updatedMembers });

      toast.success(t.projectSettings.members.addMemberSuccess);
      setIsAddMemberOpen(false);
      setAddEmail("");
      setAddRole("MEMBER");
    } catch (err: any) {
      console.error("Failed to add member:", err);
      toast.error(err.message || "Failed to add member to project.");
    } finally {
      setAddingMember(false);
    }
  };

  // Handle Remove Member
  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      setRemovingMember(true);
      await api.projects.removeMember(project.key, memberToRemove.userId);

      const updatedMembers = members.filter((m) => m.userId !== memberToRemove.userId);
      setMembers(updatedMembers);
      onProjectUpdated({ ...project, members: updatedMembers });

      toast.success(t.projectSettings.members.removeMemberSuccess);
      setMemberToRemove(null);
    } catch (err: any) {
      console.error("Failed to remove member:", err);
      toast.error(err.message || "Failed to remove member from project.");
    } finally {
      setRemovingMember(false);
    }
  };

  // Handle Delete Project
  const handleDeleteProject = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== project.key.toUpperCase()) {
      toast.error(`Type '${project.key}' exactly to confirm deletion.`);
      return;
    }

    try {
      setDeletingProject(true);
      await api.projects.delete(project.key);
      toast.success(t.projectSettings.danger.deleteSuccess);
      setIsDeleteModalOpen(false);
      onProjectDeleted(project.key);
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      toast.error(err.message || "Failed to delete project.");
      setDeletingProject(false);
    }
  };

  return (
    <div className="flex-1 bg-[#FAFBFC] dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text overflow-y-auto transition-colors">
      <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="flex items-center justify-between pb-4 border-b border-jira-border dark:border-jira-dark-border">
          <div>
            <div className="flex items-center gap-2 text-xs text-jira-subtle dark:text-jira-dark-subtle mb-1">
              <span
                onClick={() => onSwitchView("board")}
                className="hover:text-jira-blue dark:hover:text-blue-400 cursor-pointer transition font-medium"
              >
                {project.name} ({project.key})
              </span>
              <span>/</span>
              <span className="font-semibold text-jira-text dark:text-jira-dark-text">{t.projectSettings.title}</span>
            </div>
            <h1 className="text-2xl font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-2.5">
              <Settings className="text-jira-blue" size={24} />
              <span>{t.projectSettings.title}</span>
            </h1>
            <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-1">{t.projectSettings.subtitle}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-jira-border dark:border-jira-dark-border">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
              activeTab === "members"
                ? "border-jira-blue text-jira-blue bg-white dark:bg-jira-dark-surface dark:text-blue-400 rounded-t-md shadow-2xs"
                : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100/70 dark:hover:bg-jira-dark-hover rounded-t-md"
            }`}
          >
            <Users size={15} />
            <span>{t.projectSettings.tabs.members}</span>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-slate-100 dark:bg-jira-dark-card text-slate-600 dark:text-jira-dark-subtle font-bold tabular-nums leading-none">
              {members.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
              activeTab === "general"
                ? "border-jira-blue text-jira-blue bg-white dark:bg-jira-dark-surface dark:text-blue-400 rounded-t-md shadow-2xs"
                : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100/70 dark:hover:bg-jira-dark-hover rounded-t-md"
            }`}
          >
            <Settings size={15} />
            <span>{t.projectSettings.tabs.general}</span>
          </button>

          <button
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
              activeTab === "workflow"
                ? "border-jira-blue text-jira-blue bg-white dark:bg-jira-dark-surface dark:text-blue-400 rounded-t-md shadow-2xs"
                : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100/70 dark:hover:bg-jira-dark-hover rounded-t-md"
            }`}
          >
            <GitCommit size={15} />
            <span>{t.projectSettings.tabs.workflow}</span>
          </button>

          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
              activeTab === "appearance"
                ? "border-jira-blue text-jira-blue bg-white dark:bg-jira-dark-surface dark:text-blue-400 rounded-t-md shadow-2xs"
                : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100/70 dark:hover:bg-jira-dark-hover rounded-t-md"
            }`}
          >
            <Palette size={15} />
            <span>{t.projectSettings.tabs.appearance}</span>
          </button>

          <button
            onClick={() => setActiveTab("danger")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
              activeTab === "danger"
                ? "border-red-600 text-red-600 bg-white dark:bg-jira-dark-surface rounded-t-md shadow-2xs"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 rounded-t-md"
            }`}
          >
            <AlertTriangle size={15} />
            <span>{t.projectSettings.tabs.danger}</span>
          </button>
        </div>

        {/* TAB 1: MEMBERS & RBAC */}
        {activeTab === "members" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Card Header & Controls */}
            <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg p-5 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-2">
                    <ShieldCheck className="text-jira-blue" size={18} />
                    <span>{t.projectSettings.members.title}</span>
                  </h2>
                  <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-0.5">{t.projectSettings.members.desc}</p>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    className="flex items-center gap-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3.5 py-2 rounded-md shadow-sm transition active:scale-95 flex-shrink-0"
                  >
                    <UserPlus size={15} />
                    <span>{t.projectSettings.members.addMember}</span>
                  </button>
                )}
              </div>

              {/* Search Filter */}
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-jira-dark-subtle" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={t.projectSettings.members.searchMembers}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition"
                />
              </div>

              {/* Members Table */}
              <div className="border border-jira-border dark:border-jira-dark-border rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-jira-dark-card/60 border-b border-jira-border dark:border-jira-dark-border text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase tracking-wider">
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4 hidden md:table-cell">Joined Date</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-jira-dark-border">
                    {filteredMembers.map((member) => {
                      const isMemberLead = member.userId === project.leadId;
                      const isCurrentUser = member.userId === user?.id;

                      return (
                        <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-jira-dark-hover transition-colors">
                          {/* User info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  member.user.avatarUrl ||
                                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                    member.user.name
                                  )}`
                                }
                                alt={member.user.name}
                                className="w-8 h-8 rounded-full border border-jira-border dark:border-jira-dark-border object-cover flex-shrink-0"
                              />
                              <div className="truncate">
                                <div className="font-semibold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5 truncate">
                                  <span>{member.user.name}</span>
                                  {isMemberLead && (
                                    <span className="flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 px-1.5 py-0.2 rounded font-bold">
                                      <Crown size={11} className="text-amber-500 fill-amber-500" />
                                      {t.projectSettings.members.roleLead}
                                    </span>
                                  )}
                                  {isCurrentUser && (
                                    <span className="text-[10px] bg-slate-100 dark:bg-jira-dark-card text-slate-600 dark:text-jira-dark-subtle px-1.5 py-0.2 rounded font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle truncate">
                                  {member.user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Dropdown */}
                          <td className="py-3 px-4">
                            {isMemberLead ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-300 rounded font-bold text-xs">
                                <Shield size={13} className="text-amber-600 dark:text-amber-400" />
                                <span>ADMIN</span>
                              </div>
                            ) : isAdmin ? (
                              <div className="relative inline-block">
                                <select
                                  value={member.role}
                                  disabled={updatingRoleId === member.userId}
                                  onChange={(e) =>
                                    handleRoleDropdownChange(member, e.target.value as ProjectRole)
                                  }
                                  className={`appearance-none bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md px-2.5 py-1 pr-7 text-xs font-bold outline-none cursor-pointer focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition ${
                                    member.role === "ADMIN"
                                      ? "text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/30"
                                      : member.role === "MEMBER"
                                      ? "text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30"
                                      : "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-jira-dark-border bg-slate-50/50 dark:bg-jira-dark-card/50"
                                  }`}
                                >
                                  <option value="ADMIN">ADMIN</option>
                                  <option value="MEMBER">MEMBER</option>
                                  <option value="VIEWER">VIEWER</option>
                                </select>
                                <ChevronDown
                                  size={13}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-jira-subtle dark:text-jira-dark-subtle"
                                />
                              </div>
                            ) : (
                              <span
                                className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${
                                  member.role === "ADMIN"
                                    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                                    : member.role === "MEMBER"
                                    ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                    : "bg-slate-100 dark:bg-jira-dark-card text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {member.role}
                              </span>
                            )}
                          </td>

                          {/* Joined date */}
                          <td className="py-3 px-4 text-jira-subtle dark:text-jira-dark-subtle hidden md:table-cell">
                            {member.createdAt
                              ? new Date(member.createdAt).toLocaleDateString("en-US", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>

                          {/* Action button */}
                          <td className="py-3 px-4 text-right">
                            {!isMemberLead && isAdmin && (
                              <button
                                onClick={() => setMemberToRemove(member)}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
                                title={`Remove ${member.user.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-jira-subtle dark:text-jira-dark-subtle">
                          No members match search query "{memberSearch}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RBAC Guide Cards */}
            <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg p-5 shadow-card space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-jira-dark-border">
                <Shield className="text-jira-blue" size={17} />
                <h3 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">
                  {t.projectSettings.rbacGuide.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Admin Role Card */}
                <div className="bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/40 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-xs">
                    <ShieldAlert size={16} className="text-purple-600 dark:text-purple-400" />
                    <span>{t.projectSettings.rbacGuide.adminTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-jira-dark-subtle leading-relaxed">
                    {t.projectSettings.rbacGuide.adminDesc}
                  </p>
                  <ul className="text-[10px] text-slate-600 dark:text-jira-dark-subtle space-y-1 pt-1 font-medium">
                    <li className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200">
                      <CheckCircle2 size={12} className="text-purple-600 dark:text-purple-400" />
                      Manage project settings and workflow statuses
                    </li>
                    <li className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200">
                      <CheckCircle2 size={12} className="text-purple-600 dark:text-purple-400" />
                      Invite, change roles, and remove team members
                    </li>
                    <li className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200">
                      <CheckCircle2 size={12} className="text-purple-600 dark:text-purple-400" />
                      Start, complete, and plan Sprints
                    </li>
                  </ul>
                </div>

                {/* Member Role Card */}
                <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs">
                    <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                    <span>{t.projectSettings.rbacGuide.memberTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-jira-dark-subtle leading-relaxed">
                    {t.projectSettings.rbacGuide.memberDesc}
                  </p>
                  <ul className="text-[10px] text-slate-600 dark:text-jira-dark-subtle space-y-1 pt-1 font-medium">
                    <li className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                      <CheckCircle2 size={12} className="text-blue-600 dark:text-blue-400" />
                      Create, update, and manage work items
                    </li>
                    <li className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                      <CheckCircle2 size={12} className="text-blue-600 dark:text-blue-400" />
                      Move cards across Kanban columns and change statuses
                    </li>
                    <li className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                      <CheckCircle2 size={12} className="text-blue-600 dark:text-blue-400" />
                      Post comments and manage own work logs
                    </li>
                  </ul>
                </div>

                {/* Viewer Role Card */}
                <div className="bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                    <Eye size={16} className="text-slate-600 dark:text-slate-400" />
                    <span>{t.projectSettings.rbacGuide.viewerTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-jira-dark-subtle leading-relaxed">
                    {t.projectSettings.rbacGuide.viewerDesc}
                  </p>
                  <ul className="text-[10px] text-slate-600 dark:text-jira-dark-subtle space-y-1 pt-1 font-medium">
                    <li className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={12} className="text-slate-500 dark:text-slate-400" />
                      View Board, List, Backlog, and Timelines
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={12} className="text-slate-500 dark:text-slate-400" />
                      Read issue descriptions and comment threads
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-400">
                      <Lock size={12} />
                      Cannot edit or create project data
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL DETAILS */}
        {activeTab === "general" && (
          <form
            onSubmit={handleSaveGeneral}
            className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg p-6 shadow-card space-y-5 animate-in fade-in duration-150"
          >
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.projectSettings.general.name}</h2>
              <input
                type="text"
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1.5 w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition disabled:bg-slate-50 dark:disabled:bg-jira-dark-bg disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5">
                  <Lock size={13} className="text-jira-subtle dark:text-jira-dark-subtle" />
                  <span>{t.projectSettings.general.key}</span>
                </label>
                <div className="mt-1.5 px-3 py-2 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs font-mono font-bold text-jira-blue dark:text-blue-400 flex items-center justify-between">
                  <span>{project.key}</span>
                  <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle font-normal font-sans">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">{t.projectSettings.general.keyHelp}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5">
                  <Crown size={13} className="text-amber-500" />
                  <span>Project Lead (Owner)</span>
                </label>
                <div className="mt-1.5 px-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md flex items-center gap-2">
                  <img
                    src={
                      project.lead.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        project.lead.name
                      )}`
                    }
                    alt={project.lead.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="text-xs font-semibold text-jira-text dark:text-jira-dark-text">{project.lead.name}</span>
                  <span className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle truncate">({project.lead.email})</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text">
                {t.projectSettings.general.desc}
              </label>
              <textarea
                rows={4}
                disabled={!isAdmin}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this project..."
                className="mt-1.5 w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition disabled:bg-slate-50 dark:disabled:bg-jira-dark-bg disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>

            {isAdmin && (
              <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex justify-end">
                <button
                  type="submit"
                  disabled={savingGeneral}
                  className="flex items-center gap-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {savingGeneral ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{t.projectSettings.general.saveChanges}</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 3: WORKFLOW STATUSES */}
        {activeTab === "workflow" && (
          <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg p-6 shadow-card space-y-4 animate-in fade-in duration-150">
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-2">
                <GitCommit className="text-jira-blue" size={17} />
                <span>Workflow Statuses</span>
              </h2>
              <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                Statuses used to track the lifecycle of work items across the Kanban board.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {project.statuses.map((status, index) => {
                const badgeColor =
                  status.category === "DONE"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300"
                    : status.category === "IN_PROGRESS"
                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300"
                    : "bg-slate-50 dark:bg-jira-dark-card border-slate-200 dark:border-jira-dark-border text-slate-800 dark:text-slate-200";

                return (
                  <div
                    key={status.id}
                    className={`border rounded-lg p-4 space-y-2 flex flex-col justify-between ${badgeColor}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-jira-dark-subtle font-mono">
                          Stage {index + 1}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-white/70 dark:bg-jira-dark-surface border border-black/5 dark:border-white/5">
                          {status.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold mt-1 text-jira-text dark:text-jira-dark-text">{status.name}</h4>
                    </div>
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-jira-dark-subtle font-medium">
                      <span>Position: #{status.position}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: THEME & APPEARANCE */}
        {activeTab === "appearance" && (
          <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg p-6 shadow-card space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-2">
                <Palette className="text-jira-blue" size={18} />
                <span>{t.projectSettings.appearance.title}</span>
              </h2>
              <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                {t.projectSettings.appearance.subtitle}
              </p>
            </div>

            {/* Theme Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Light Mode Option */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`group relative text-left rounded-lg p-4 border-2 transition-all flex flex-col justify-between ${
                  currentTheme === "light"
                    ? "border-jira-blue bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-jira-blue/20"
                    : "border-jira-border dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle bg-slate-50/60 dark:bg-jira-dark-card/60"
                }`}
              >
                <div className="space-y-3">
                  {/* Visual Mini Mockup */}
                  <div className="w-full h-24 rounded-md border border-slate-200 bg-[#FAFBFC] p-2 flex flex-col gap-1.5 overflow-hidden shadow-2xs select-none">
                    <div className="h-4 bg-white border border-slate-200 rounded flex items-center px-1.5 gap-1">
                      <div className="w-2 h-2 rounded bg-blue-600" />
                      <div className="w-8 h-1.5 bg-slate-200 rounded" />
                    </div>
                    <div className="flex-1 flex gap-1.5">
                      <div className="w-1/3 bg-slate-100 rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-slate-300 rounded" />
                        <div className="h-3 bg-white border border-slate-200 rounded shadow-2xs" />
                        <div className="h-3 bg-white border border-slate-200 rounded shadow-2xs" />
                      </div>
                      <div className="w-1/3 bg-slate-100 rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-slate-300 rounded" />
                        <div className="h-3 bg-white border border-slate-200 rounded shadow-2xs" />
                      </div>
                      <div className="w-1/3 bg-slate-100 rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-slate-300 rounded" />
                        <div className="h-3 bg-white border border-slate-200 rounded shadow-2xs" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5">
                        <Sun size={15} className="text-amber-500" />
                        {t.projectSettings.appearance.light}
                      </span>
                      {currentTheme === "light" && (
                        <span className="text-[10px] font-bold text-jira-blue dark:text-blue-400 bg-white dark:bg-jira-dark-card border border-jira-blue/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={10} strokeWidth={3} />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1 leading-relaxed">
                      {t.projectSettings.appearance.lightDesc}
                    </p>
                  </div>
                </div>
              </button>

              {/* Dark Mode Option */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`group relative text-left rounded-lg p-4 border-2 transition-all flex flex-col justify-between ${
                  currentTheme === "dark"
                    ? "border-jira-blue bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-jira-blue/20"
                    : "border-jira-border dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle bg-slate-50/60 dark:bg-jira-dark-card/60"
                }`}
              >
                <div className="space-y-3">
                  {/* Visual Mini Mockup */}
                  <div className="w-full h-24 rounded-md border border-[#333C44] bg-[#1D2125] p-2 flex flex-col gap-1.5 overflow-hidden shadow-2xs select-none">
                    <div className="h-4 bg-[#22272B] border border-[#333C44] rounded flex items-center px-1.5 gap-1">
                      <div className="w-2 h-2 rounded bg-blue-500" />
                      <div className="w-8 h-1.5 bg-[#333C44] rounded" />
                    </div>
                    <div className="flex-1 flex gap-1.5">
                      <div className="w-1/3 bg-[#161A1D] rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-[#333C44] rounded" />
                        <div className="h-3 bg-[#282E33] border border-[#333C44] rounded shadow-2xs" />
                        <div className="h-3 bg-[#282E33] border border-[#333C44] rounded shadow-2xs" />
                      </div>
                      <div className="w-1/3 bg-[#161A1D] rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-[#333C44] rounded" />
                        <div className="h-3 bg-[#282E33] border border-[#333C44] rounded shadow-2xs" />
                      </div>
                      <div className="w-1/3 bg-[#161A1D] rounded p-1 space-y-1">
                        <div className="w-8 h-1 bg-[#333C44] rounded" />
                        <div className="h-3 bg-[#282E33] border border-[#333C44] rounded shadow-2xs" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5">
                        <Moon size={15} className="text-blue-400" />
                        {t.projectSettings.appearance.dark}
                      </span>
                      {currentTheme === "dark" && (
                        <span className="text-[10px] font-bold text-jira-blue dark:text-blue-400 bg-white dark:bg-jira-dark-card border border-jira-blue/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={10} strokeWidth={3} />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1 leading-relaxed">
                      {t.projectSettings.appearance.darkDesc}
                    </p>
                  </div>
                </div>
              </button>

              {/* System Default Option */}
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`group relative text-left rounded-lg p-4 border-2 transition-all flex flex-col justify-between ${
                  currentTheme === "system"
                    ? "border-jira-blue bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-jira-blue/20"
                    : "border-jira-border dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle bg-slate-50/60 dark:bg-jira-dark-card/60"
                }`}
              >
                <div className="space-y-3">
                  {/* Visual Mini Mockup - Split preview */}
                  <div className="w-full h-24 rounded-md border border-slate-300 dark:border-[#333C44] flex overflow-hidden shadow-2xs select-none">
                    {/* Left light half */}
                    <div className="w-1/2 bg-[#FAFBFC] p-2 flex flex-col gap-1.5 border-r border-slate-200">
                      <div className="h-4 bg-white border border-slate-200 rounded flex items-center px-1 gap-1">
                        <div className="w-1.5 h-1.5 rounded bg-blue-600" />
                        <div className="w-5 h-1 bg-slate-200 rounded" />
                      </div>
                      <div className="flex-1 bg-slate-100 rounded p-1 space-y-1">
                        <div className="w-6 h-1 bg-slate-300 rounded" />
                        <div className="h-3 bg-white border border-slate-200 rounded" />
                      </div>
                    </div>
                    {/* Right dark half */}
                    <div className="w-1/2 bg-[#1D2125] p-2 flex flex-col gap-1.5">
                      <div className="h-4 bg-[#22272B] border border-[#333C44] rounded flex items-center px-1 gap-1">
                        <div className="w-1.5 h-1.5 rounded bg-blue-400" />
                        <div className="w-5 h-1 bg-[#333C44] rounded" />
                      </div>
                      <div className="flex-1 bg-[#161A1D] rounded p-1 space-y-1">
                        <div className="w-6 h-1 bg-[#333C44] rounded" />
                        <div className="h-3 bg-[#282E33] border border-[#333C44] rounded" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5">
                        <Monitor size={15} className="text-purple-500" />
                        {t.projectSettings.appearance.system}
                      </span>
                      {currentTheme === "system" && (
                        <span className="text-[10px] font-bold text-jira-blue dark:text-blue-400 bg-white dark:bg-jira-dark-card border border-jira-blue/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={10} strokeWidth={3} />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1 leading-relaxed">
                      {t.projectSettings.appearance.systemDesc}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-jira-dark-border text-xs text-jira-subtle dark:text-jira-dark-subtle flex items-center gap-2">
              <Info size={14} className="text-jira-blue flex-shrink-0" />
              <span>{t.projectSettings.appearance.note}</span>
            </div>
          </div>
        )}

        {/* TAB 5: DANGER ZONE */}
        {activeTab === "danger" && (
          <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-6 shadow-card space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-red-900 dark:text-red-300">{t.projectSettings.danger.title}</h2>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                  {t.projectSettings.danger.desc}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-red-200/60 dark:border-red-900/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-red-800 dark:text-red-400">
                {isLead
                  ? "This action requires typing the project key to confirm."
                  : t.projectSettings.danger.leadOnly}
              </span>

              {isLead ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationText("");
                    setIsDeleteModalOpen(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition active:scale-95"
                >
                  {t.projectSettings.danger.deleteButton}
                </button>
              ) : (
                <button
                  disabled
                  className="bg-slate-200 dark:bg-jira-dark-card text-slate-400 dark:text-slate-600 text-xs font-semibold px-4 py-2 rounded-md cursor-not-allowed"
                >
                  {t.projectSettings.danger.deleteButton} (Lead Only)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Add Member */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-modal border border-jira-border dark:border-jira-dark-border w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-jira-border dark:border-jira-dark-border">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-jira-blue" />
                <h3 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">
                  {t.projectSettings.members.addMember}
                </h3>
              </div>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              {/* Quick Select Available User */}
              {availableUsers.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text block mb-1">
                    Select Registered User (Quick Pick)
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-jira-border dark:border-jira-dark-border rounded-md divide-y divide-slate-100 dark:divide-jira-dark-border">
                    {availableUsers.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setAddEmail(u.email)}
                        className={`w-full text-left p-2 flex items-center gap-2 hover:bg-blue-50/50 dark:hover:bg-jira-dark-hover transition text-xs ${
                          addEmail.toLowerCase() === u.email.toLowerCase()
                            ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-bold"
                            : "text-jira-text dark:text-jira-dark-text"
                        }`}
                      >
                        <img
                          src={
                            u.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              u.name
                            )}`
                          }
                          alt={u.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="truncate flex-1">{u.name}</span>
                        <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle truncate">{u.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text block mb-1">
                  User Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="e.g. alex@company.local"
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition"
                />

                {/* Email Verification Status */}
                {(() => {
                  const matchedUser = availableUsers.find(
                    (u) => u.email.toLowerCase() === addEmail.trim().toLowerCase()
                  );
                  if (matchedUser) {
                    return (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 px-2 py-1 rounded">
                        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Registered account: {matchedUser.name}</span>
                      </div>
                    );
                  }
                  if (addEmail.trim()) {
                    return (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-jira-dark-subtle bg-slate-50 dark:bg-jira-dark-card px-2 py-1 rounded border border-slate-200/60 dark:border-jira-dark-border">
                        <Shield size={12} className="text-slate-400 flex-shrink-0" />
                        <span>The system will verify the user account upon adding.</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text block mb-1">
                  Role (RBAC)
                </label>
                <select
                  value={addRole}
                  onChange={(e) => {
                    setAddRole(e.target.value as ProjectRole);
                    setAdminConfirmationAcknowledged(false);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs font-semibold text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition"
                >
                  <option value="MEMBER">MEMBER — Active collaboration & issue tracking</option>
                  <option value="ADMIN">ADMIN — Full project administration & sprint control</option>
                  <option value="VIEWER">VIEWER — Read-only observation access</option>
                </select>
              </div>

              {/* Dynamic Security Preview */}
              {addRole === "ADMIN" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 rounded-lg p-3 space-y-2 text-xs animate-in fade-in duration-100">
                  <div className="flex items-start gap-2 text-amber-900 dark:text-amber-300 font-bold">
                    <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>Security Notice: Admin Access Privileges</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    The <strong>ADMIN</strong> role has full administrative privileges: managing members, modifying project workflows, controlling sprints, and deleting issues. Assign only to trusted personnel.
                  </p>
                  <label className="flex items-start gap-2 pt-1 cursor-pointer select-none border-t border-amber-200/60 dark:border-amber-800/40">
                    <input
                      type="checkbox"
                      checked={adminConfirmationAcknowledged}
                      onChange={(e) => setAdminConfirmationAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-jira-blue focus:ring-jira-blue"
                    />
                    <span className="text-[11px] text-amber-950 dark:text-amber-200 font-semibold">
                      I understand and approve granting full administrative access to this user.
                    </span>
                  </label>
                </div>
              )}

              {addRole === "MEMBER" && (
                <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg p-2.5 flex items-center gap-2 text-[11px] text-blue-800 dark:text-blue-300 animate-in fade-in duration-100">
                  <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span><strong>MEMBER</strong>: Active collaborator. Can create, move, and edit issues without access to destructive settings.</span>
                </div>
              )}

              {addRole === "VIEWER" && (
                <div className="bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded-lg p-2.5 flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 animate-in fade-in duration-100">
                  <Eye size={15} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />
                  <span><strong>VIEWER</strong>: Read-only access. Account cannot create, edit, or delete project data.</span>
                </div>
              )}

              {/* In-app Notification Notice */}
              <div className="p-2 bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded text-[11px] text-jira-subtle dark:text-jira-dark-subtle flex items-center gap-2">
                <Bell size={13} className="text-jira-blue flex-shrink-0" />
                <span>The user will automatically receive a notification in their account.</span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    addingMember ||
                    !addEmail.trim() ||
                    (addRole === "ADMIN" && !adminConfirmationAcknowledged)
                  }
                  className="flex items-center gap-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-1.5 rounded-md shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingMember ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  <span>Add to Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG: Promote to ADMIN */}
      <ConfirmDialog
        isOpen={!!promoteTarget}
        title="Confirm Admin Role Promotion"
        description={
          promoteTarget
            ? `Are you sure you want to promote ${promoteTarget.member.user.name} to ADMIN? This user will have full administrative access to manage members, project settings, and workflow statuses.`
            : ""
        }
        confirmLabel="Yes, Grant Admin Access"
        isDestructive={false}
        isLoading={updatingRoleId === promoteTarget?.member.userId}
        onConfirm={handleConfirmPromoteAdmin}
        onCancel={() => setPromoteTarget(null)}
      />

      {/* CONFIRM DIALOG: Remove Member */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        title={t.projectSettings.members.confirmRemoveTitle}
        description={
          memberToRemove
            ? t.projectSettings.members.confirmRemoveDesc(memberToRemove.user.name)
            : ""
        }
        confirmLabel="Yes, Remove Member"
        isDestructive={true}
        isLoading={removingMember}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />

      {/* MODAL: Delete Project */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-modal border border-red-300 dark:border-red-900/50 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 pb-3 border-b border-red-100 dark:border-red-900/40">
              <AlertTriangle size={20} />
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300">Confirm Permanent Project Deletion</h3>
            </div>

            <p className="text-xs text-jira-text dark:text-jira-dark-text leading-relaxed">
              This action <strong>cannot be undone</strong>. All work items, sprints, comments, and attachments in project <strong>{project.name}</strong> will be permanently deleted.
            </p>

            <div>
              <label className="text-xs font-bold text-jira-text dark:text-jira-dark-text block mb-1">
                Type <span className="font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 py-0.5 rounded">{project.key}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={project.key}
                className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs font-mono font-bold text-jira-text dark:text-jira-dark-text outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded-md transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteConfirmationText.trim().toUpperCase() !== project.key.toUpperCase() ||
                  deletingProject
                }
                onClick={handleDeleteProject}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-md shadow-sm transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingProject ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>Delete Project Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
