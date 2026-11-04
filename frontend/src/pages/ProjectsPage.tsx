import React, { useState } from "react";
import { Project } from "../types";
import { FolderKanban, Plus, Search, Users, CheckCircle2 } from "lucide-react";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { t } from "../lib/i18n";

interface ProjectsPageProps {
  projects: Project[];
  onSelectProject: (key: string) => void;
  onOpenCreateModal: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  onSelectProject,
  onOpenCreateModal,
}) => {
  const [filter, setFilter] = useState("");

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex-1 bg-white dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text overflow-y-auto p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-jira-border dark:border-jira-dark-border mb-6">
        <div>
          <h1 className="text-2xl font-bold text-jira-text dark:text-jira-dark-text">{t.nav.projects}</h1>
          <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-1">
            {t.projects.subtitle}
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition active:scale-95"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>{t.nav.createProject}</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-72">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-jira-dark-subtle"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t.projects.searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-card focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition"
          />
        </div>
        <div className="text-xs text-jira-subtle dark:text-jira-dark-subtle font-medium">
          {t.projects.showingCount(filteredProjects.length, projects.length)}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProjects.map((project) => {
          const theme = getProjectTheme(project.key);
          const initials = getProjectInitials(project.name, project.key);

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.key)}
              className="group bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border hover:border-jira-blue dark:hover:border-blue-400 rounded-lg p-5 shadow-sm hover:shadow-card-hover transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-md bg-gradient-to-tr ${theme.bg} ${theme.text} flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform`}
                  >
                    {initials}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-jira-dark-surface text-jira-subtle dark:text-jira-dark-subtle text-xs font-mono font-bold">
                    {project.key}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-jira-text dark:text-jira-dark-text group-hover:text-jira-blue dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
                  {project.name}
                </h3>

                <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle line-clamp-2 mb-4 leading-relaxed">
                  {project.description || t.projects.defaultDesc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-between text-xs text-jira-subtle dark:text-jira-dark-subtle">
                <div className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span>{t.projects.membersCount(project.members?.length || 1)}</span>
                </div>

                <div className="flex items-center gap-1 font-semibold text-jira-text dark:text-jira-dark-text">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>{t.projects.itemsCount(project._count?.issues ?? 0)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 dark:border-jira-dark-border rounded-lg">
            <FolderKanban size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-jira-text dark:text-jira-dark-text">{t.projects.notFoundTitle}</p>
            <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-1 mb-4">
              {t.projects.notFoundDesc}
            </p>
            <button
              onClick={onOpenCreateModal}
              className="px-3.5 py-1.5 bg-jira-blue text-white text-xs font-semibold rounded hover:bg-jira-blue-hover transition"
            >
              {t.nav.createProject}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
