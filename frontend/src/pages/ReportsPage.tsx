import React, { useState, useEffect, useMemo } from "react";
import { Project, Sprint, BurndownResponse, VelocityResponse, SprintReportResponse, IssueType, PriorityLevel } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { can, getUserRole } from "../lib/permissions";
import { useAuthStore } from "../store/auth";
import { t } from "../lib/i18n";
import { IssueTypeIcon } from "../components/IssueTypeIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { CustomSelect, CustomSelectOption } from "../components/CustomSelect";
import {
  TrendingUp,
  BarChart3,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Layers,
  Calendar,
  Download,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Save,
  Flag,
} from "lucide-react";

interface ReportsPageProps {
  project: Project;
  initialSprintId?: string | null;
  onOpenIssueDetail?: (issueKey: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  project,
  initialSprintId,
  onOpenIssueDetail,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const userRole = getUserRole(project, user?.id);
  const canEditRetro = can(userRole, "issue:edit");

  // Tabs: burndown | velocity | sprintReport
  const [activeTab, setActiveTab] = useState<"burndown" | "velocity" | "sprintReport">(
    initialSprintId ? "sprintReport" : "burndown"
  );

  // Sprints list for dropdowns
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(true);

  // Selected sprint for burndown & sprint report
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");

  // Burndown state
  const [burndownMetric, setBurndownMetric] = useState<"points" | "issues">("points");
  const [burndownData, setBurndownData] = useState<BurndownResponse | null>(null);
  const [loadingBurndown, setLoadingBurndown] = useState(false);
  const [burndownHoverIndex, setBurndownHoverIndex] = useState<number | null>(null);

  // Velocity state
  const [velocitySprintsCount, setVelocitySprintsCount] = useState<number>(6);
  const [velocityData, setVelocityData] = useState<VelocityResponse | null>(null);
  const [loadingVelocity, setLoadingVelocity] = useState(false);
  const [velocityHoverIndex, setVelocityHoverIndex] = useState<number | null>(null);

  // Sprint Report state
  const [reportData, setReportData] = useState<SprintReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [retroGood, setRetroGood] = useState("");
  const [retroToImprove, setRetroToImprove] = useState("");
  const [retroActionItems, setRetroActionItems] = useState("");
  const [savingRetro, setSavingRetro] = useState(false);

  // Load sprints on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSprints = async () => {
      try {
        setLoadingSprints(true);
        const res = await api.sprints.list(project.key);
        if (!isMounted) return;
        setSprints(res.sprints || []);

        if (res.sprints && res.sprints.length > 0) {
          if (initialSprintId && res.sprints.some((s) => s.id === initialSprintId)) {
            setSelectedSprintId(initialSprintId);
          } else {
            // Default to ACTIVE sprint, else the latest sprint
            const active = res.sprints.find((s) => s.state === "ACTIVE");
            setSelectedSprintId(active ? active.id : res.sprints[0].id);
          }
        }
      } catch (err: any) {
        console.error("Failed to load sprints:", err);
      } finally {
        if (isMounted) setLoadingSprints(false);
      }
    };
    fetchSprints();
    return () => {
      isMounted = false;
    };
  }, [project.key, initialSprintId]);

  // Load Burndown data
  useEffect(() => {
    if (activeTab !== "burndown" || !selectedSprintId) return;
    let isMounted = true;
    const fetchBurndown = async () => {
      try {
        setLoadingBurndown(true);
        const data = await api.reports.burndown(project.key, selectedSprintId, burndownMetric);
        if (isMounted) setBurndownData(data);
      } catch (err: any) {
        toast.error(err.message || "Failed to load burndown data");
      } finally {
        if (isMounted) setLoadingBurndown(false);
      }
    };
    fetchBurndown();
    return () => {
      isMounted = false;
    };
  }, [project.key, selectedSprintId, burndownMetric, activeTab, toast]);

  // Load Velocity data
  useEffect(() => {
    if (activeTab !== "velocity") return;
    let isMounted = true;
    const fetchVelocity = async () => {
      try {
        setLoadingVelocity(true);
        const data = await api.reports.velocity(project.key, velocitySprintsCount);
        if (isMounted) setVelocityData(data);
      } catch (err: any) {
        toast.error(err.message || "Failed to load velocity data");
      } finally {
        if (isMounted) setLoadingVelocity(false);
      }
    };
    fetchVelocity();
    return () => {
      isMounted = false;
    };
  }, [project.key, velocitySprintsCount, activeTab, toast]);

  // Load Sprint Report data
  useEffect(() => {
    if (activeTab !== "sprintReport" || !selectedSprintId) return;
    let isMounted = true;
    const fetchReport = async () => {
      try {
        setLoadingReport(true);
        const data = await api.reports.sprintReport(project.key, selectedSprintId);
        if (isMounted) {
          setReportData(data);
          setRetroGood(data.sprint.retroNotes?.good || "");
          setRetroToImprove(data.sprint.retroNotes?.toImprove || "");
          setRetroActionItems(data.sprint.retroNotes?.actionItems || "");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load sprint report");
      } finally {
        if (isMounted) setLoadingReport(false);
      }
    };
    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [project.key, selectedSprintId, activeTab, toast]);

  // Save Retro Notes
  const handleSaveRetro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditRetro || !selectedSprintId) return;
    try {
      setSavingRetro(true);
      await api.reports.saveRetro(project.key, selectedSprintId, {
        good: retroGood,
        toImprove: retroToImprove,
        actionItems: retroActionItems,
      });
      toast.success(t.reports.sprintReport.retroSaved);
    } catch (err: any) {
      toast.error(err.message || "Failed to save retrospective notes");
    } finally {
      setSavingRetro(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!reportData) return;
    const rows = [
      ["Sprint Report", reportData.sprint.name],
      ["Status", reportData.sprint.state],
      ["Committed Points", reportData.summary.committedPoints],
      ["Completed Points", reportData.summary.completedPoints],
      ["Completion Rate", `${reportData.summary.completionRate ?? 0}%`],
      [],
      ["--- COMPLETED WORK ITEMS ---"],
      ["Key", "Title", "Type", "Priority", "Story Points", "Assignee"],
      ...reportData.completedIssues.map((i) => [
        i.key,
        `"${i.title.replace(/"/g, '""')}"`,
        i.type,
        i.priority,
        i.storyPoints ?? "None",
        i.assignee?.name || "Unassigned",
      ]),
      [],
      ["--- INCOMPLETE / ROLLOVER ITEMS ---"],
      ["Key", "Title", "Type", "Priority", "Story Points", "Assignee", "Rollover Destination"],
      ...reportData.notCompletedIssues.map((i) => [
        i.key,
        `"${i.title.replace(/"/g, '""')}"`,
        i.type,
        i.priority,
        i.storyPoints ?? "None",
        i.assignee?.name || "Unassigned",
        i.targetDestination || "Backlog",
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${project.key}_${reportData.sprint.name.replace(/\s+/g, "_")}_Report.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  // CustomSelect Options for Sprints (Burndown & Sprint Report)
  const sprintOptions: CustomSelectOption<string>[] = useMemo(() => {
    return sprints.map((s) => {
      let dotColor = "bg-slate-400 dark:bg-slate-500";
      let badgeClass = "jira-lozenge-todo";
      let badgeText = "Closed";

      if (s.state === "ACTIVE") {
        dotColor = "bg-emerald-500";
        badgeClass = "jira-lozenge-done";
        badgeText = "Active";
      } else if (s.state === "FUTURE") {
        dotColor = "bg-jira-blue dark:bg-blue-400";
        badgeClass = "jira-lozenge-inprogress";
        badgeText = "Future";
      }

      return {
        value: s.id,
        label: s.name,
        icon: <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />,
        badge: (
          <span className={`jira-lozenge ${badgeClass} text-[10px] font-bold tracking-wide`}>
            {badgeText}
          </span>
        ),
      };
    });
  }, [sprints]);

  // CustomSelect Options for Velocity Sprint Count
  const velocityCountOptions: CustomSelectOption<number>[] = useMemo(() => {
    return [
      {
        value: 6,
        label: t.reports.velocity.last6Sprints,
        icon: <span className="w-2.5 h-2.5 rounded-full bg-jira-blue dark:bg-blue-400 flex-shrink-0" />,
        badge: (
          <span className="jira-lozenge jira-lozenge-inprogress text-[10px] font-bold">
            6 Sprints
          </span>
        ),
      },
      {
        value: 10,
        label: t.reports.velocity.last10Sprints,
        icon: <span className="w-2.5 h-2.5 rounded-full bg-jira-blue dark:bg-blue-400 flex-shrink-0" />,
        badge: (
          <span className="jira-lozenge jira-lozenge-inprogress text-[10px] font-bold">
            10 Sprints
          </span>
        ),
      },
      {
        value: 12,
        label: t.reports.velocity.last12Sprints,
        icon: <span className="w-2.5 h-2.5 rounded-full bg-jira-blue dark:bg-blue-400 flex-shrink-0" />,
        badge: (
          <span className="jira-lozenge jira-lozenge-inprogress text-[10px] font-bold">
            12 Sprints
          </span>
        ),
      },
    ];
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFBFC] dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text overflow-y-auto">
      {/* Top Banner Header */}
      <div className="px-8 pt-7 pb-4 bg-white dark:bg-jira-dark-surface border-b border-jira-border dark:border-jira-dark-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-jira-blue dark:bg-blue-900/40 dark:text-blue-300">
                Agile Insights
              </span>
              <span className="text-xs text-jira-subtle dark:text-jira-dark-subtle font-medium">
                {project.name} ({project.key})
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-jira-text dark:text-jira-dark-text mt-1">
              {t.reports.title}
            </h1>
            <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
              {t.reports.subtitle}
            </p>
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === "burndown") setSelectedSprintId((prev) => prev);
                if (activeTab === "velocity") setVelocitySprintsCount((prev) => prev);
                if (activeTab === "sprintReport") setSelectedSprintId((prev) => prev);
                toast.success("Reports data refreshed");
              }}
              className="p-2 text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white rounded-lg border border-jira-border dark:border-jira-dark-border hover:bg-slate-50 dark:hover:bg-jira-dark-hover transition text-xs flex items-center gap-1.5"
              title="Refresh report data"
            >
              <RefreshCw size={14} />
              <span className="font-semibold text-xs">Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-transparent">
          <button
            onClick={() => setActiveTab("burndown")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "burndown"
                ? "bg-jira-blue text-white shadow-sm"
                : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
            }`}
          >
            <TrendingUp size={15} />
            <span>{t.reports.tabs.burndown}</span>
          </button>

          <button
            onClick={() => setActiveTab("velocity")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "velocity"
                ? "bg-jira-blue text-white shadow-sm"
                : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
            }`}
          >
            <BarChart3 size={15} />
            <span>{t.reports.tabs.velocity}</span>
          </button>

          <button
            onClick={() => setActiveTab("sprintReport")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "sprintReport"
                ? "bg-jira-blue text-white shadow-sm"
                : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
            }`}
          >
            <FileText size={15} />
            <span>{t.reports.tabs.sprintReport}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="px-8 py-6 space-y-6 flex-1">
        {/* ========================================================================= */}
        {/* TAB 1: BURNDOWN CHART                                                     */}
        {/* ========================================================================= */}
        {activeTab === "burndown" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
              {/* Sprint Dropdown */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5 whitespace-nowrap">
                  <Layers size={14} className="text-jira-blue" />
                  <span>{t.reports.burndown.selectSprint}:</span>
                </span>
                <div className="w-72 sm:w-80 md:w-96">
                  <CustomSelect<string>
                    value={selectedSprintId}
                    options={sprintOptions}
                    onChange={(val) => setSelectedSprintId(val)}
                    className="w-full"
                    dropdownClassName="w-full min-w-[320px]"
                  />
                </div>
              </div>

              {/* Metric Toggle: Story Points vs Issue Count */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-jira-dark-card rounded-lg border border-jira-border dark:border-jira-dark-border">
                <button
                  onClick={() => setBurndownMetric("points")}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    burndownMetric === "points"
                      ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-xs"
                      : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white"
                  }`}
                >
                  {t.reports.burndown.metricStoryPoints}
                </button>
                <button
                  onClick={() => setBurndownMetric("issues")}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    burndownMetric === "issues"
                      ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-xs"
                      : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-white"
                  }`}
                >
                  {t.reports.burndown.metricIssueCount}
                </button>
              </div>
            </div>

            {/* Unestimated Warning Banner */}
            {burndownData && burndownData.unestimated > 0 && burndownMetric === "points" && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>{t.reports.burndown.unestimatedAlert(burndownData.unestimated)}</span>
                </div>
                <button
                  onClick={() => setBurndownMetric("issues")}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-md hover:bg-amber-300 transition"
                >
                  Switch to Issue Count
                </button>
              </div>
            )}

            {/* KPI Summary Cards */}
            {burndownData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-jira-subtle dark:text-jira-dark-subtle text-xs font-bold uppercase tracking-wider mb-1">
                    <span>{t.reports.burndown.committed}</span>
                    <Target size={16} className="text-slate-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-jira-text dark:text-jira-dark-text">
                    {burndownData.summary.committed}
                    <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle ml-1">
                      {burndownMetric === "points" ? "pts" : "items"}
                    </span>
                  </div>
                  <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                    Initial sprint baseline
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <span>{t.reports.burndown.completed}</span>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {burndownData.summary.completed}
                    <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle ml-1">
                      {burndownMetric === "points" ? "pts" : "items"}
                    </span>
                  </div>
                  <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                    Marked Done as of today
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-jira-blue dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <span>{t.reports.burndown.remaining}</span>
                    <Clock size={16} className="text-jira-blue dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-jira-blue dark:text-blue-400">
                    {burndownData.summary.remaining}
                    <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle ml-1">
                      {burndownMetric === "points" ? "pts" : "items"}
                    </span>
                  </div>
                  <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                    Active work left to complete
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <span>{t.reports.burndown.scopeAdded}</span>
                    <TrendingUp size={16} className="text-orange-500" />
                  </div>
                  <div className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
                    +{burndownData.summary.scopeAdded}
                    <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle ml-1">
                      {burndownMetric === "points" ? "pts" : "items"}
                    </span>
                  </div>
                  <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                    Scope creep added mid-sprint
                  </p>
                </div>
              </div>
            )}

            {/* Interactive SVG Burndown Chart */}
            <div className="p-6 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">
                    Sprint Burndown Timeline
                  </h3>
                  <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle">
                    Asia/Jakarta (UTC+7) daily progression vs linear ideal guideline
                  </p>
                </div>
              </div>

              {loadingBurndown ? (
                <div className="h-72 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-jira-blue" />
                </div>
              ) : !burndownData || burndownData.days.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-jira-subtle dark:text-jira-dark-subtle">
                  <Layers size={32} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">{t.reports.burndown.emptySprint}</p>
                </div>
              ) : (
                <BurndownSvgChart
                  data={burndownData}
                  hoverIndex={burndownHoverIndex}
                  onHoverChange={setBurndownHoverIndex}
                />
              )}

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4 mt-2 border-t border-slate-100 dark:border-jira-dark-border text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-1 bg-[#0C66E4] rounded-full" />
                  <span className="font-semibold text-jira-text dark:text-jira-dark-text">
                    {t.reports.burndown.remainingLine}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-0.5 border-b-2 border-dashed border-slate-400" />
                  <span className="font-semibold text-jira-subtle dark:text-jira-dark-subtle">
                    {t.reports.burndown.idealLine}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-0.5 bg-[#F97316]" />
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {t.reports.burndown.scopeLine}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-red-500 rounded-xs" />
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {t.reports.burndown.todayMarker}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: VELOCITY CHART                                                     */}
        {/* ========================================================================= */}
        {activeTab === "velocity" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">
                  Team Velocity & Capacity Forecasting
                </h3>
                <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle">
                  Historical delivery capacity across completed sprints
                </p>
              </div>

              {/* Sprints Count Selector */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-jira-subtle dark:text-jira-dark-subtle font-semibold whitespace-nowrap">
                  {t.reports.velocity.sprintCountSelector}:
                </span>
                <div className="w-48 sm:w-56">
                  <CustomSelect<number>
                    value={velocitySprintsCount}
                    options={velocityCountOptions}
                    onChange={(val) => setVelocitySprintsCount(val)}
                    className="w-full"
                    dropdownClassName="w-full min-w-[200px]"
                  />
                </div>
              </div>
            </div>

            {/* Velocity KPI Cards */}
            {velocityData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-jira-subtle dark:text-jira-dark-subtle">
                      {t.reports.velocity.avgVelocity}
                    </div>
                    <div className="text-3xl font-extrabold text-jira-text dark:text-jira-dark-text mt-1">
                      {velocityData.averageVelocity}{" "}
                      <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle">
                        pts / sprint
                      </span>
                    </div>
                    <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                      {t.reports.velocity.avgVelocityDesc} ({velocityData.sprints.length} sprints)
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 flex items-center justify-center">
                    <BarChart3 size={24} />
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span>{t.reports.velocity.recommendedCapacity}</span>
                      <Sparkles size={14} className="text-amber-500" />
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                      {velocityData.recommendedCapacity !== null ? (
                        <>
                          {velocityData.recommendedCapacity}{" "}
                          <span className="text-xs font-normal text-jira-subtle dark:text-jira-dark-subtle">
                            pts
                          </span>
                        </>
                      ) : (
                        <span className="text-base text-jira-subtle dark:text-jira-dark-subtle font-medium">
                          N/A
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-1">
                      {velocityData.insufficientData
                        ? t.reports.velocity.insufficientDataDesc
                        : t.reports.velocity.recommendedCapacityDesc}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Target size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* Dual Bar SVG Velocity Chart */}
            <div className="p-6 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
              {loadingVelocity ? (
                <div className="h-72 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-jira-blue" />
                </div>
              ) : !velocityData || velocityData.sprints.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-jira-subtle dark:text-jira-dark-subtle">
                  <BarChart3 size={32} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">{t.reports.velocity.noClosedSprintsTitle}</p>
                  <p className="text-[11px] mt-1">{t.reports.velocity.noClosedSprintsDesc}</p>
                </div>
              ) : (
                <VelocitySvgChart
                  data={velocityData}
                  hoverIndex={velocityHoverIndex}
                  onHoverChange={setVelocityHoverIndex}
                />
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4 mt-2 border-t border-slate-100 dark:border-jira-dark-border text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3 bg-[#64748B] rounded-xs" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {t.reports.velocity.committedBar}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3 bg-[#0C66E4] rounded-xs" />
                  <span className="font-semibold text-jira-blue dark:text-blue-400">
                    {t.reports.velocity.completedBar}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 border-b-2 border-dashed border-emerald-500" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Average Velocity ({velocityData?.averageVelocity || 0} pts)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SPRINT REPORT                                                      */}
        {/* ========================================================================= */}
        {activeTab === "sprintReport" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Control Bar & Export CSV */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-1.5 whitespace-nowrap">
                  <FileText size={14} className="text-jira-blue" />
                  <span>{t.reports.sprintReport.selectSprint}:</span>
                </span>
                <div className="w-72 sm:w-80 md:w-96">
                  <CustomSelect<string>
                    value={selectedSprintId}
                    options={sprintOptions}
                    onChange={(val) => setSelectedSprintId(val)}
                    className="w-full"
                    dropdownClassName="w-full min-w-[320px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={!reportData}
                  className="px-3.5 py-1.5 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border hover:bg-slate-50 dark:hover:bg-jira-dark-hover rounded-lg text-xs font-bold text-jira-text dark:text-jira-dark-text transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Download size={13} />
                  <span>{t.reports.sprintReport.exportCsv}</span>
                </button>
              </div>
            </div>

            {loadingReport ? (
              <div className="h-72 flex items-center justify-center bg-white dark:bg-jira-dark-surface rounded-xl border border-jira-border dark:border-jira-dark-border">
                <Loader2 size={24} className="animate-spin text-jira-blue" />
              </div>
            ) : reportData ? (
              <>
                {/* Sprint Header Badge */}
                <div className="p-5 bg-gradient-to-r from-blue-50/70 via-white to-slate-50/70 dark:from-jira-dark-card dark:via-jira-dark-surface dark:to-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-extrabold text-jira-text dark:text-jira-dark-text">
                          {reportData.sprint.name}
                        </h2>
                        {reportData.isPreview ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-jira-blue dark:bg-blue-900/50 dark:text-blue-300">
                            {t.reports.sprintReport.livePreviewBadge}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {t.reports.sprintReport.closedBadge}
                          </span>
                        )}
                      </div>
                      {reportData.sprint.goal && (
                        <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-1.5 flex items-center gap-1.5">
                          <Flag size={13} className="text-amber-500 flex-shrink-0" />
                          <span>{reportData.sprint.goal}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-jira-subtle dark:text-jira-dark-subtle font-medium">
                      {reportData.sprint.startDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          <span>
                            {new Date(reportData.sprint.startDate).toLocaleDateString()} —{" "}
                            {reportData.sprint.endDate ? new Date(reportData.sprint.endDate).toLocaleDateString() : "Ongoing"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5 KPI Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-jira-subtle dark:text-jira-dark-subtle block">
                      {t.reports.sprintReport.committedPoints}
                    </span>
                    <span className="text-xl font-extrabold text-jira-text dark:text-jira-dark-text mt-1 block">
                      {reportData.summary.committedPoints}{" "}
                      <span className="text-xs font-normal text-jira-subtle">pts</span>
                    </span>
                    <span className="text-[10px] text-jira-subtle">
                      ({reportData.summary.committedIssues} items)
                    </span>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      {t.reports.sprintReport.completedPoints}
                    </span>
                    <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                      {reportData.summary.completedPoints}{" "}
                      <span className="text-xs font-normal text-jira-subtle">pts</span>
                    </span>
                    <span className="text-[10px] text-jira-subtle">
                      ({reportData.summary.completedIssues} items)
                    </span>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-jira-blue dark:text-blue-400 block">
                      {t.reports.sprintReport.completionRate}
                    </span>
                    <span className="text-xl font-extrabold text-jira-blue dark:text-blue-400 mt-1 block">
                      {reportData.summary.completionRate !== null
                        ? `${reportData.summary.completionRate}%`
                        : "—"}
                    </span>
                    <span className="text-[10px] text-jira-subtle">delivery efficiency</span>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                      {t.reports.sprintReport.scopeAddedPoints}
                    </span>
                    <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400 mt-1 block">
                      +{reportData.summary.scopeAddedPoints}{" "}
                      <span className="text-xs font-normal text-jira-subtle">pts</span>
                    </span>
                    <span className="text-[10px] text-jira-subtle">
                      ({reportData.summary.scopeAddedIssues} added mid-sprint)
                    </span>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                      {t.reports.sprintReport.carriedOverPoints}
                    </span>
                    <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
                      {reportData.summary.carriedOverPoints}{" "}
                      <span className="text-xs font-normal text-jira-subtle">pts</span>
                    </span>
                    <span className="text-[10px] text-jira-subtle">
                      ({reportData.summary.carriedOverIssues} carried over)
                    </span>
                  </div>
                </div>

                {/* Table 1: Completed Work Items */}
                <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-[#FAFBFC] dark:bg-jira-dark-card border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-jira-text dark:text-jira-dark-text flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        <span>{t.reports.sprintReport.completedSection}</span>
                        <span className="text-xs font-semibold text-jira-subtle">
                          ({reportData.completedIssues.length})
                        </span>
                      </h4>
                      <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                        {t.reports.sprintReport.completedSectionDesc}
                      </p>
                    </div>
                  </div>

                  {reportData.completedIssues.length === 0 ? (
                    <div className="p-6 text-center text-xs text-jira-subtle dark:text-jira-dark-subtle">
                      No work items were completed in this sprint.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-jira-dark-border text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase">
                            <th className="py-2.5 px-4 w-28">Key</th>
                            <th className="py-2.5 px-4">Summary</th>
                            <th className="py-2.5 px-4 w-24">Type</th>
                            <th className="py-2.5 px-4 w-24">Priority</th>
                            <th className="py-2.5 px-4 w-32">Assignee</th>
                            <th className="py-2.5 px-4 w-20 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-jira-dark-border">
                          {reportData.completedIssues.map((issue) => (
                            <tr
                              key={issue.id}
                              onClick={() => onOpenIssueDetail?.(issue.key)}
                              className="hover:bg-slate-50 dark:hover:bg-jira-dark-hover transition cursor-pointer"
                            >
                              <td className="py-2.5 px-4 font-bold text-jira-blue dark:text-blue-400">
                                {issue.key}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-jira-text dark:text-jira-dark-text truncate max-w-xs">
                                {issue.title}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                                  <IssueTypeIcon type={issue.type} size={14} />
                                  <span>{issue.type}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                                  <PriorityIcon priority={issue.priority} size={14} />
                                  <span>{issue.priority}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                {issue.assignee ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-jira-dark-card flex items-center justify-center text-[10px] font-bold text-jira-text dark:text-jira-dark-text">
                                      {issue.assignee.name.charAt(0)}
                                    </div>
                                    <span className="text-[11px] truncate max-w-[100px]">
                                      {issue.assignee.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-jira-subtle dark:text-jira-dark-subtle text-[11px]">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-jira-text dark:text-jira-dark-text">
                                {issue.storyPoints ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Table 2: Incomplete / Carried Over Items */}
                <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-[#FAFBFC] dark:bg-jira-dark-card border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle size={15} />
                        <span>{t.reports.sprintReport.notCompletedSection}</span>
                        <span className="text-xs font-semibold text-jira-subtle">
                          ({reportData.notCompletedIssues.length})
                        </span>
                      </h4>
                      <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                        {t.reports.sprintReport.notCompletedSectionDesc}
                      </p>
                    </div>
                  </div>

                  {reportData.notCompletedIssues.length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      🎉 All items planned for this sprint were successfully completed!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-jira-dark-border text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase">
                            <th className="py-2.5 px-4 w-28">Key</th>
                            <th className="py-2.5 px-4">Summary</th>
                            <th className="py-2.5 px-4 w-24">Type</th>
                            <th className="py-2.5 px-4 w-32">Assignee</th>
                            <th className="py-2.5 px-4 w-36">
                              {t.reports.sprintReport.destination}
                            </th>
                            <th className="py-2.5 px-4 w-20 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-jira-dark-border">
                          {reportData.notCompletedIssues.map((issue) => (
                            <tr
                              key={issue.id}
                              onClick={() => onOpenIssueDetail?.(issue.key)}
                              className="hover:bg-slate-50 dark:hover:bg-jira-dark-hover transition cursor-pointer"
                            >
                              <td className="py-2.5 px-4 font-bold text-jira-blue dark:text-blue-400">
                                {issue.key}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-jira-text dark:text-jira-dark-text truncate max-w-xs">
                                {issue.title}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                                  <IssueTypeIcon type={issue.type} size={14} />
                                  <span>{issue.type}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                {issue.assignee ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-jira-dark-card flex items-center justify-center text-[10px] font-bold text-jira-text dark:text-jira-dark-text">
                                      {issue.assignee.name.charAt(0)}
                                    </div>
                                    <span className="text-[11px] truncate max-w-[100px]">
                                      {issue.assignee.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-jira-subtle dark:text-jira-dark-subtle text-[11px]">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                  {issue.targetDestination || "Backlog"}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-jira-text dark:text-jira-dark-text">
                                {issue.storyPoints ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Table 3: Added Mid-Sprint Items (Scope Creep) */}
                {reportData.addedMidSprintIssues.length > 0 && (
                  <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-[#FAFBFC] dark:bg-jira-dark-card border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                          <TrendingUp size={15} />
                          <span>{t.reports.sprintReport.addedMidSprintSection}</span>
                          <span className="text-xs font-semibold text-jira-subtle">
                            ({reportData.addedMidSprintIssues.length})
                          </span>
                        </h4>
                        <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                          {t.reports.sprintReport.addedMidSprintSectionDesc}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-jira-dark-border text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase">
                            <th className="py-2.5 px-4 w-28">Key</th>
                            <th className="py-2.5 px-4">Summary</th>
                            <th className="py-2.5 px-4 w-24">Type</th>
                            <th className="py-2.5 px-4 w-28">Status</th>
                            <th className="py-2.5 px-4 w-20 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-jira-dark-border">
                          {reportData.addedMidSprintIssues.map((issue) => (
                            <tr
                              key={issue.id}
                              onClick={() => onOpenIssueDetail?.(issue.key)}
                              className="hover:bg-slate-50 dark:hover:bg-jira-dark-hover transition cursor-pointer"
                            >
                              <td className="py-2.5 px-4 font-bold text-jira-blue dark:text-blue-400">
                                {issue.key}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-jira-text dark:text-jira-dark-text truncate max-w-xs">
                                {issue.title}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                                  <IssueTypeIcon type={issue.type} size={14} />
                                  <span>{issue.type}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-medium text-jira-subtle">
                                {issue.status?.name || "TO_DO"}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-jira-text dark:text-jira-dark-text">
                                {issue.storyPoints ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Retrospective Notes Section */}
                <form
                  onSubmit={handleSaveRetro}
                  className="p-6 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-xl shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-jira-dark-border pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      <h4 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">
                        {t.reports.sprintReport.retroSection}
                      </h4>
                    </div>

                    {!canEditRetro && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-jira-dark-card text-jira-subtle flex items-center gap-1">
                        <ShieldCheck size={12} />
                        <span>{t.reports.sprintReport.retroReadOnly}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Good */}
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>{t.reports.sprintReport.retroGood}</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={!canEditRetro}
                        value={retroGood}
                        onChange={(e) => setRetroGood(e.target.value)}
                        placeholder="What positive practices or wins happened during this sprint?"
                        className="w-full p-2.5 bg-white dark:bg-jira-dark-surface border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none disabled:opacity-65"
                      />
                    </div>

                    {/* To Improve */}
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/40 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-600" />
                        <span>{t.reports.sprintReport.retroToImprove}</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={!canEditRetro}
                        value={retroToImprove}
                        onChange={(e) => setRetroToImprove(e.target.value)}
                        placeholder="What bottlenecks, estimation slips, or blockers arose?"
                        className="w-full p-2.5 bg-white dark:bg-jira-dark-surface border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:ring-1 focus:ring-amber-500 transition resize-none disabled:opacity-65"
                      />
                    </div>

                    {/* Action Items */}
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <Target size={14} className="text-jira-blue" />
                        <span>{t.reports.sprintReport.retroActionItems}</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={!canEditRetro}
                        value={retroActionItems}
                        onChange={(e) => setRetroActionItems(e.target.value)}
                        placeholder="Commit to 1-2 concrete action items for the next sprint..."
                        className="w-full p-2.5 bg-white dark:bg-jira-dark-surface border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:ring-1 focus:ring-jira-blue transition resize-none disabled:opacity-65"
                      />
                    </div>
                  </div>

                  {canEditRetro && (
                    <div className="flex items-center justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingRetro}
                        className="px-4 py-2 bg-jira-blue hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingRetro ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>{t.reports.sprintReport.retroSave}</span>
                      </button>
                    </div>
                  )}
                </form>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: INTERACTIVE SVG BURNDOWN CHART
// ==========================================

interface BurndownSvgChartProps {
  data: BurndownResponse;
  hoverIndex: number | null;
  onHoverChange: (index: number | null) => void;
}

const BurndownSvgChart: React.FC<BurndownSvgChartProps> = ({
  data,
  hoverIndex,
  onHoverChange,
}) => {
  const days = data.days;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 45;

  const width = 800;
  const height = 300;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Max value calculation
  const maxVal = useMemo(() => {
    let m = data.summary.committed;
    days.forEach((d) => {
      if (d.scope > m) m = d.scope;
      if (d.ideal > m) m = d.ideal;
      if (d.remaining !== null && d.remaining > m) m = d.remaining;
    });
    return Math.max(10, Math.ceil((m * 1.15) / 5) * 5);
  }, [days, data.summary.committed]);

  const getX = (index: number) => {
    if (days.length <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + (index / (days.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    return paddingTop + chartH - (val / maxVal) * chartH;
  };

  // Ideal line path
  const idealPath = useMemo(() => {
    if (days.length === 0) return "";
    return days.map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.ideal)}`).join(" ");
  }, [days, maxVal]);

  // Scope line path (stepped)
  const scopePath = useMemo(() => {
    if (days.length === 0) return "";
    let p = `M ${getX(0)} ${getY(days[0].scope)}`;
    for (let i = 1; i < days.length; i++) {
      const prevX = getX(i - 1);
      const currX = getX(i);
      const prevY = getY(days[i - 1].scope);
      const currY = getY(days[i].scope);
      p += ` L ${currX} ${prevY} L ${currX} ${currY}`;
    }
    return p;
  }, [days, maxVal]);

  // Remaining line path (stops at today)
  const remainingPoints = useMemo(() => {
    return days
      .map((d, i) => ({ day: d, index: i }))
      .filter((item) => item.day.remaining !== null);
  }, [days]);

  const remainingPath = useMemo(() => {
    if (remainingPoints.length === 0) return "";
    return remainingPoints
      .map((item, i) => `${i === 0 ? "M" : "L"} ${getX(item.index)} ${getY(item.day.remaining!)}`)
      .join(" ");
  }, [remainingPoints, maxVal]);

  // Today marker index
  const todayIndex = days.findIndex((d) => d.isToday);

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => onHoverChange(null)}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 10}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-medium"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {days.map((d, i) => {
          // Display subset of labels if too many days
          const step = days.length > 14 ? 2 : 1;
          if (i % step !== 0 && i !== days.length - 1) return null;
          const x = getX(i);
          const formatted = d.date.slice(5); // MM-DD
          return (
            <text
              key={i}
              x={x}
              y={height - 12}
              textAnchor="middle"
              className={`text-[10px] font-semibold ${
                d.isToday ? "fill-red-500 font-bold" : "fill-slate-400"
              }`}
            >
              {formatted}
            </text>
          );
        })}

        {/* Today vertical line marker */}
        {todayIndex !== -1 && (
          <g>
            <line
              x1={getX(todayIndex)}
              y1={paddingTop}
              x2={getX(todayIndex)}
              y2={paddingTop + chartH}
              stroke="#EF4444"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <rect
              x={getX(todayIndex) - 22}
              y={paddingTop - 18}
              width={44}
              height={16}
              rx={4}
              fill="#EF4444"
            />
            <text
              x={getX(todayIndex)}
              y={paddingTop - 6}
              textAnchor="middle"
              className="fill-white text-[9px] font-bold"
            >
              TODAY
            </text>
          </g>
        )}

        {/* Ideal Burndown Line (Dashed Slate) */}
        <path
          d={idealPath}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />

        {/* Scope Line (Stepped Orange) */}
        <path
          d={scopePath}
          fill="none"
          stroke="#F97316"
          strokeWidth={1.5}
        />

        {/* Remaining Line (Thick Royal Blue) */}
        <path
          d={remainingPath}
          fill="none"
          stroke="#0C66E4"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points on Remaining line */}
        {remainingPoints.map((item) => {
          const x = getX(item.index);
          const y = getY(item.day.remaining!);
          const isHovered = hoverIndex === item.index;
          return (
            <circle
              key={item.index}
              cx={x}
              cy={y}
              r={isHovered ? 5 : 3.5}
              fill="#0C66E4"
              stroke="#FFFFFF"
              strokeWidth={2}
              className="transition-all duration-150"
            />
          );
        })}

        {/* Transparent hover columns */}
        {days.map((d, i) => {
          const colW = chartW / days.length;
          const x = getX(i) - colW / 2;
          return (
            <rect
              key={i}
              x={x}
              y={paddingTop}
              width={colW}
              height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => onHoverChange(i)}
            />
          );
        })}

        {/* Vertical cursor guide when hovered */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < days.length && (
          <line
            x1={getX(hoverIndex)}
            y1={paddingTop}
            x2={getX(hoverIndex)}
            y2={paddingTop + chartH}
            stroke="#94A3B8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Floating Tooltip Card */}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < days.length && (
        <div
          className="absolute z-30 pointer-events-none p-3 bg-slate-900/90 text-white rounded-lg shadow-xl backdrop-blur-xs text-xs border border-slate-700 space-y-1 transition-all -translate-x-1/2"
          style={{
            left: `${getX(hoverIndex) * (100 / width)}%`,
            top: `${getY(days[hoverIndex].remaining ?? days[hoverIndex].ideal) - 20}px`,
          }}
        >
          <div className="font-bold border-b border-slate-700 pb-1 text-slate-200">
            {days[hoverIndex].date} {days[hoverIndex].isToday ? "(Today)" : ""}
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-blue-400 font-semibold">Remaining:</span>
            <span className="font-bold">
              {days[hoverIndex].remaining !== null ? `${days[hoverIndex].remaining} pts` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-400">Ideal guideline:</span>
            <span>{days[hoverIndex].ideal} pts</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-orange-400">Total Scope:</span>
            <span>{days[hoverIndex].scope} pts</span>
          </div>
          {days[hoverIndex].done !== null && (
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-emerald-400">Done to date:</span>
              <span>{days[hoverIndex].done} pts</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: DUAL-BAR VELOCITY CHART
// ==========================================

interface VelocitySvgChartProps {
  data: VelocityResponse;
  hoverIndex: number | null;
  onHoverChange: (index: number | null) => void;
}

// Helper to extract clean sprint label for X-axis (e.g. "Sprint 1: Foundation" -> "Sprint 1")
const formatSprintAxisLabel = (name: string): string => {
  const match = name.match(/^(Sprint\s+\d+)/i);
  if (match) return match[1];
  const split = name.split(/[:\–\-]/)[0].trim();
  if (split && split.length <= 15) return split;
  return name.length > 12 ? name.slice(0, 10) + "..." : name;
};

const VelocitySvgChart: React.FC<VelocitySvgChartProps> = ({
  data,
  hoverIndex,
  onHoverChange,
}) => {
  const sprints = data.sprints;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 50;

  const width = 800;
  const height = 300;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const { maxVal, yTicks } = useMemo(() => {
    let m = data.averageVelocity || 0;
    sprints.forEach((s) => {
      if (s.committedPoints > m) m = s.committedPoints;
      if (s.completedPoints > m) m = s.completedPoints;
    });

    if (m <= 0) {
      return { maxVal: 20, yTicks: [0, 5, 10, 15, 20] };
    }

    // Determine clean round step size (5, 10, 20, 25, 50, etc.)
    let step = 5;
    if (m <= 15) {
      step = 5;
    } else if (m <= 40) {
      step = 10;
    } else if (m <= 80) {
      step = 20;
    } else if (m <= 150) {
      step = 25;
    } else {
      step = Math.ceil(m / 4 / 10) * 10;
    }

    let top = Math.ceil(m / step) * step;
    if (top === m || top - m < step * 0.2) {
      top += step;
    }
    if (top < step * 3) {
      top = step * 3;
    }

    const ticks: number[] = [];
    for (let t = 0; t <= top; t += step) {
      ticks.push(t);
    }

    return { maxVal: top, yTicks: ticks };
  }, [sprints, data.averageVelocity]);

  const getY = (val: number) => {
    return paddingTop + chartH - (val / maxVal) * chartH;
  };

  const groupWidth = chartW / sprints.length;
  const barWidth = Math.min(28, (groupWidth - 24) / 2);

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => onHoverChange(null)}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 10}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-medium"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Average Velocity dashed line (Clean line without overlapping floating badge; value is in legend) */}
        {data.averageVelocity > 0 && (
          <line
            x1={paddingLeft}
            y1={getY(data.averageVelocity)}
            x2={width - paddingRight}
            y2={getY(data.averageVelocity)}
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}

        {/* Grouped Bars per Sprint */}
        {sprints.map((sprint, i) => {
          const groupCenter = paddingLeft + (i + 0.5) * groupWidth;
          const committedX = groupCenter - barWidth - 2;
          const completedX = groupCenter + 2;

          const committedH = (sprint.committedPoints / maxVal) * chartH;
          const completedH = (sprint.completedPoints / maxVal) * chartH;

          const committedY = paddingTop + chartH - committedH;
          const completedY = paddingTop + chartH - completedH;

          const isHovered = hoverIndex === i;

          return (
            <g key={sprint.id} className="cursor-pointer" onMouseEnter={() => onHoverChange(i)}>
              {/* Committed Bar (Slate) */}
              <rect
                x={committedX}
                y={committedY}
                width={barWidth}
                height={committedH}
                rx={3}
                fill={isHovered ? "#475569" : "#64748B"}
                className="transition-colors duration-150"
              />

              {/* Completed Bar (Blue) */}
              <rect
                x={completedX}
                y={completedY}
                width={barWidth}
                height={completedH}
                rx={3}
                fill={isHovered ? "#0052CC" : "#0C66E4"}
                className="transition-colors duration-150"
              />

              {/* Sprint Name Label (Clean "Sprint X" format, full name in tooltip) */}
              <text
                x={groupCenter}
                y={height - 15}
                textAnchor="middle"
                className={`text-[10px] font-semibold ${
                  isHovered ? "fill-jira-blue font-bold" : "fill-slate-500"
                }`}
              >
                {formatSprintAxisLabel(sprint.name)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < sprints.length && (
        <div
          className="absolute z-30 pointer-events-none p-3 bg-slate-900/90 text-white rounded-lg shadow-xl backdrop-blur-xs text-xs border border-slate-700 space-y-1 transition-all -translate-x-1/2"
          style={{
            left: `${((paddingLeft + (hoverIndex + 0.5) * groupWidth) / width) * 100}%`,
            top: `${getY(Math.max(sprints[hoverIndex].committedPoints, sprints[hoverIndex].completedPoints)) - 15}px`,
          }}
        >
          <div className="font-bold border-b border-slate-700 pb-1 text-slate-200">
            {sprints[hoverIndex].name}
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-300">Committed:</span>
            <span className="font-bold">{sprints[hoverIndex].committedPoints} pts</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-blue-400">Completed:</span>
            <span className="font-bold">{sprints[hoverIndex].completedPoints} pts</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-emerald-400">Completion rate:</span>
            <span className="font-bold">
              {sprints[hoverIndex].completionRate !== null
                ? `${sprints[hoverIndex].completionRate}%`
                : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
