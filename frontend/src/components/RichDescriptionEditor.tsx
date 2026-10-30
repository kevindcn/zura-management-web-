import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  Code,
  Smile,
  Plus,
  Link2,
  Undo2,
  Redo2,
  RotateCcw,
  ChevronDown,
  Quote,
  Minus,
  Check,
  Eye,
  Edit3,
  Upload,
  Loader2,
} from "lucide-react";
import { User } from "../types";
import { api } from "../lib/api";

interface RichDescriptionEditorProps {
  value: string;
  onSave: (newDescription: string) => Promise<void> | void;
  onCancel?: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  canEdit: boolean;
  projectMembers?: User[];
  placeholder?: string;
  mode?: "description" | "comment";
  saveButtonText?: string;
  clearOnSave?: boolean;
}

const COMMON_EMOJIS = [
  "👍", "👎", "🎉", "🚀", "🐛", "⚠️",
  "✅", "❌", "💡", "🔥", "❤️", "👀",
  "📌", "🎯", "⭐", "📝", "⚡", "✨",
];

const TEXT_COLORS = [
  { name: "Default", color: "#1e293b", label: "Default" },
  { name: "Red", color: "#ef4444", label: "Red" },
  { name: "Orange", color: "#f97316", label: "Orange" },
  { name: "Green", color: "#10b981", label: "Green" },
  { name: "Blue", color: "#0052cc", label: "Jira Blue" },
  { name: "Purple", color: "#8b5cf6", label: "Purple" },
  { name: "Gray", color: "#64748b", label: "Gray" },
];

export const RichDescriptionEditor: React.FC<RichDescriptionEditorProps> = ({
  value,
  onSave,
  onCancel,
  isEditing,
  setIsEditing,
  canEdit,
  projectMembers = [],
  placeholder = "Type @ to mention and notify someone.",
  mode = "description",
  saveButtonText = "Save",
  clearOnSave = false,
}) => {
  const [content, setContent] = useState(() => normalizeToHtml(value || ""));
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active open dropdown / popover
  const [openDropdown, setOpenDropdown] = useState<
    "textStyle" | "formatting" | "list" | "color" | "emoji" | "link" | "image" | "more" | null
  >(null);

  // Image/file upload modal state
  const [imageTab, setImageTab] = useState<"file" | "link">("file");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedIsImage, setUploadedIsImage] = useState<boolean>(true);
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [linkImageAlt, setLinkImageAlt] = useState("");

  // Link popover state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  // Sync content with value prop
  useEffect(() => {
    const html = normalizeToHtml(value || "");
    setContent(html);
    if (editorRef.current && isEditing && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [value, isEditing]);

  // Save selection before opening any dropdown / popover
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update content state when user edits contentEditable div
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setContent(html);

    // Check for mention trigger
    const sel = window.getSelection();
    if (sel && sel.focusNode) {
      const text = sel.focusNode.textContent || "";
      const offset = sel.focusOffset;
      const textBefore = text.slice(0, offset);
      const lastAt = textBefore.lastIndexOf("@");
      if (lastAt !== -1 && lastAt >= offset - 20 && !/\s/.test(textBefore.slice(lastAt + 1))) {
        setMentionQuery(textBefore.slice(lastAt + 1));
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  // Helper to execute standard browser WYSIWYG commands
  const executeCommand = (command: string, arg?: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleEditorInput();
  };

  // Format block (Headings, Paragraph, Blockquote)
  const formatBlock = (tag: string) => {
    executeCommand("formatBlock", tag);
    setOpenDropdown(null);
  };

  // Text color
  const handleApplyColor = (colorHex: string) => {
    executeCommand("foreColor", colorHex);
    setOpenDropdown(null);
  };

  // Insert HTML element at caret location
  const insertHtml = (htmlString: string) => {
    restoreSelection();
    editorRef.current?.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();

      const el = document.createElement("div");
      el.innerHTML = htmlString;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      let lastNode: ChildNode | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);

      if (lastNode) {
        const newRange = range.cloneRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    } else {
      document.execCommand("insertHTML", false, htmlString);
    }
    handleEditorInput();
  };

  // Insert code formatting
  const handleInsertCode = () => {
    const sel = window.getSelection();
    const selectedText = sel?.toString() || "";
    if (selectedText.includes("\n")) {
      insertHtml(
        `<pre class="bg-slate-100 dark:bg-jira-dark-column text-slate-800 dark:text-jira-dark-text p-2.5 rounded-md font-mono text-xs border border-slate-200 dark:border-jira-dark-border my-2 overflow-x-auto"><code>${escapeHtml(
          selectedText || "console.log('Hello Zura!');"
        )}</code></pre>`
      );
    } else {
      insertHtml(
        `<code class="bg-slate-100 dark:bg-jira-dark-column text-slate-800 dark:text-jira-dark-text px-1.5 py-0.5 rounded font-mono text-xs border border-slate-200 dark:border-jira-dark-border">${escapeHtml(
          selectedText || "code"
        )}</code>`
      );
    }
  };

  // Insert emoji at caret
  const handleInsertEmoji = (emoji: string) => {
    insertHtml(emoji);
    setOpenDropdown(null);
  };

  // Insert task checklist
  const handleInsertTask = () => {
    insertHtml(
      `<div class="flex items-center gap-2 my-1"><input type="checkbox" class="rounded text-jira-blue focus:ring-jira-blue" /><span>New task</span></div>`
    );
    setOpenDropdown(null);
  };

  // Insert horizontal divider
  const handleInsertDivider = () => {
    executeCommand("insertHorizontalRule");
    setOpenDropdown(null);
  };

  // Insert note / callout box
  const handleInsertNote = () => {
    insertHtml(
      `<div class="my-2 p-3 bg-amber-50/70 dark:bg-amber-950/40 border-l-4 border-amber-400 text-amber-900 dark:text-amber-200 rounded-r text-xs leading-relaxed">💡 <b>Note:</b> Write important notes here...</div>`
    );
    setOpenDropdown(null);
  };

  // Handle Link insertion
  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const label = linkText.trim() || linkUrl.trim();
    insertHtml(
      `<a href="${escapeHtml(linkUrl.trim())}" target="_blank" rel="noopener noreferrer" class="text-jira-blue dark:text-blue-400 hover:underline font-medium">${escapeHtml(
        label
      )}</a>`
    );
    setLinkUrl("");
    setLinkText("");
    setOpenDropdown(null);
  };

  // Handle Local File & Image Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadedFileName(file.name);
      const isImg = file.type.startsWith("image/");
      setUploadedIsImage(isImg);

      const res = await api.upload(file);
      setUploadedPreview(res.url);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
      setUploadedFileName("");
      setUploadedPreview(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmFileUpload = () => {
    if (!uploadedPreview) return;
    if (uploadedIsImage) {
      insertHtml(
        `<img src="${uploadedPreview}" alt="${escapeHtml(
          uploadedFileName || "Image"
        )}" class="max-w-full rounded-md border border-slate-200 dark:border-jira-dark-border my-2 shadow-sm inline-block" />`
      );
    } else {
      insertHtml(
        `<div class="my-2 p-2.5 bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded-lg flex items-center gap-2"><a href="${uploadedPreview}" target="_blank" rel="noopener noreferrer" class="text-jira-blue dark:text-blue-400 hover:underline font-semibold flex items-center gap-1.5 text-xs">📎 ${escapeHtml(
          uploadedFileName || "File"
        )}</a></div>`
      );
    }
    setUploadedPreview(null);
    setUploadedFileName("");
    setOpenDropdown(null);
  };

  const handleConfirmLinkUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkImageUrl.trim()) return;
    insertHtml(
      `<img src="${escapeHtml(linkImageUrl.trim())}" alt="${escapeHtml(
        linkImageAlt.trim() || "Image"
      )}" class="max-w-full rounded-md border border-slate-200 dark:border-jira-dark-border my-2 shadow-sm inline-block" />`
    );
    setLinkImageUrl("");
    setLinkImageAlt("");
    setOpenDropdown(null);
  };

  // Handle @ Mention selection
  const handleSelectMention = (user: User) => {
    insertHtml(
      `<span class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-jira-blue dark:text-blue-400 font-semibold text-[11px] rounded border border-blue-200 dark:border-blue-900/50 inline-block mr-1">@${escapeHtml(
        user.name
      )}</span>&nbsp;`
    );
    setMentionQuery(null);
  };

  // Reset to initial value
  const handleReset = () => {
    const initialHtml = normalizeToHtml(value || "");
    setContent(initialHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const currentContent = editorRef.current ? editorRef.current.innerHTML : content;
      await onSave(currentContent);
      if (clearOnSave) {
        setContent("");
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
      }
      setIsEditing(false);
      setIsPreview(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const initialHtml = normalizeToHtml(value || "");
    setContent(initialHtml);
    setIsEditing(false);
    setIsPreview(false);
    onCancel?.();
  };

  const filteredMembers =
    mentionQuery !== null
      ? projectMembers.filter(
          (m) =>
            m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : [];

  // =========================================================================
  // VIEW MODE (Not Editing)
  // =========================================================================
  if (!isEditing) {
    if (mode === "comment") {
      return (
        <div
          onClick={() => canEdit && setIsEditing(true)}
          className={`w-full p-2.5 bg-slate-50 dark:bg-jira-dark-card hover:bg-white dark:hover:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border hover:border-jira-blue rounded-md text-xs text-slate-500 dark:text-jira-dark-subtle cursor-pointer transition select-none flex items-center shadow-xs ${
            !canEdit ? "cursor-not-allowed opacity-80" : ""
          }`}
          title={!canEdit ? "You do not have permission to write comments" : "Write a comment..."}
        >
          {placeholder || "Add a comment... (Type to collaborate)"}
        </div>
      );
    }

    const hasContent = content && content.trim() && content !== "<p><br></p>" && content !== "<br>";
    return (
      <div className="group">
        <div
          onClick={() => canEdit && setIsEditing(true)}
          className={`min-h-[70px] p-3 rounded-lg border border-transparent text-sm text-slate-800 dark:text-jira-dark-text transition ${
            canEdit
              ? "hover:bg-slate-100/70 dark:hover:bg-jira-dark-card hover:border-slate-200 dark:hover:border-jira-dark-border cursor-pointer"
              : "cursor-not-allowed opacity-80"
          }`}
          title={!canEdit ? "You do not have permission to edit description" : "Click to edit description"}
        >
          {hasContent ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-jira-dark-text leading-relaxed space-y-1.5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          ) : (
            <span className="text-slate-400 dark:text-jira-dark-subtle italic">
              {canEdit ? "Click to add a description..." : "No description"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // EDIT MODE (True WYSIWYG ContentEditable)
  // =========================================================================
  return (
    <div className="space-y-2">
      <div className="relative border border-jira-blue rounded-lg bg-white dark:bg-jira-dark-surface shadow-xs focus-within:ring-2 focus-within:ring-jira-blue/20 transition">
        {/* Backdrop for open dropdowns */}
        {openDropdown && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setOpenDropdown(null)}
          />
        )}

        {/* Toolbar */}
        <div
          ref={toolbarRef}
          className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#FAFBFC] dark:bg-jira-dark-card border-b border-slate-200 dark:border-jira-dark-border select-none text-slate-600 dark:text-jira-dark-subtle text-xs rounded-t-lg relative z-40"
        >
          {/* 1. Text Style Dropdown (T) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "textStyle" ? null : "textStyle");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-700 dark:text-jira-dark-text hover:text-slate-900 dark:hover:text-white transition flex items-center gap-0.5 ${
                openDropdown === "textStyle" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Text style"
            >
              <span className="font-serif font-bold text-sm px-0.5">T</span>
              <ChevronDown size={11} className="text-slate-400 dark:text-jira-dark-subtle" />
            </button>

            {openDropdown === "textStyle" && (
              <div className="absolute left-0 top-full mt-1 z-30 w-44 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg py-1 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock("<p>");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text font-normal"
                >
                  Normal text
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock("<h1>");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-900 dark:text-white font-bold text-sm"
                >
                  Heading 1
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock("<h2>");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-800 dark:text-jira-dark-text font-semibold"
                >
                  Heading 2
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock("<h3>");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-800 dark:text-jira-dark-text font-medium"
                >
                  Heading 3
                </button>
              </div>
            )}
          </div>

          {/* 2. Bold / Formatting Dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "formatting" ? null : "formatting");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-700 dark:text-jira-dark-text hover:text-slate-900 dark:hover:text-white transition flex items-center gap-0.5 ${
                openDropdown === "formatting" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Formatting (Bold, Italic, Underline, Strikethrough)"
            >
              <Bold size={13} className="stroke-[2.5]" />
              <ChevronDown size={11} className="text-slate-400 dark:text-jira-dark-subtle" />
            </button>

            {openDropdown === "formatting" && (
              <div className="absolute left-0 top-full mt-1 z-30 w-44 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg py-1 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("bold");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center justify-between text-slate-800 dark:text-jira-dark-text font-bold"
                >
                  <span>Bold</span>
                  <span className="text-[10px] text-slate-400 dark:text-jira-dark-subtle font-normal">Ctrl+B</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("italic");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center justify-between text-slate-800 dark:text-jira-dark-text italic"
                >
                  <span>Italic</span>
                  <span className="text-[10px] text-slate-400 dark:text-jira-dark-subtle font-normal">Ctrl+I</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("underline");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center justify-between text-slate-800 dark:text-jira-dark-text underline"
                >
                  <span>Underline</span>
                  <span className="text-[10px] text-slate-400 dark:text-jira-dark-subtle font-normal">Ctrl+U</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("strikeThrough");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center justify-between text-slate-800 dark:text-jira-dark-text line-through"
                >
                  <span>Strikethrough</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. List Dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "list" ? null : "list");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-700 dark:text-jira-dark-text hover:text-slate-900 dark:hover:text-white transition flex items-center gap-0.5 ${
                openDropdown === "list" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Lists"
            >
              <List size={14} />
              <ChevronDown size={11} className="text-slate-400 dark:text-jira-dark-subtle" />
            </button>

            {openDropdown === "list" && (
              <div className="absolute left-0 top-full mt-1 z-30 w-44 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg py-1 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("insertUnorderedList");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <List size={13} />
                  <span>Bullet list</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("insertOrderedList");
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <ListOrdered size={13} />
                  <span>Numbered list</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertTask();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <CheckSquare size={13} />
                  <span>Task checklist</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Text Color */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "color" ? null : "color");
              }}
              className={`p-1 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-700 dark:text-jira-dark-text hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center border border-slate-300 dark:border-jira-dark-border w-6 h-6 text-xs font-bold ${
                openDropdown === "color" ? "bg-slate-200 dark:bg-jira-dark-column ring-1 ring-slate-400" : ""
              }`}
              title="Text Color"
            >
              <span className="text-[11px] font-bold">A</span>
            </button>

            {openDropdown === "color" && (
              <div className="absolute left-0 top-full mt-1 z-30 w-44 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg p-2 text-xs">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-jira-dark-subtle uppercase mb-1.5">
                  Text Color
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleApplyColor(c.color);
                      }}
                      className="w-7 h-7 rounded border border-slate-200 dark:border-jira-dark-border hover:scale-110 transition flex items-center justify-center"
                      title={c.label}
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name === "Default" && <span className="text-white text-[9px]">A</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-jira-dark-border mx-1" />

          {/* 5. Insert Image */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "image" ? null : "image");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition ${
                openDropdown === "image" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Insert Image / Attachment"
            >
              <ImageIcon size={14} />
            </button>

            {openDropdown === "image" && (
              <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl shadow-2xl p-3.5 text-xs animate-in fade-in zoom-in-95 duration-100 text-left">
                {/* Tabs: File | Link */}
                <div className="flex items-center gap-4 border-b border-slate-200 dark:border-jira-dark-border pb-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setImageTab("file")}
                    className={`font-semibold pb-1 -mb-2 border-b-2 transition ${
                      imageTab === "file"
                        ? "text-jira-blue dark:text-blue-400 border-jira-blue"
                        : "text-slate-500 dark:text-jira-dark-subtle hover:text-slate-800 dark:hover:text-jira-dark-text border-transparent"
                    }`}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("link")}
                    className={`font-semibold pb-1 -mb-2 border-b-2 transition ${
                      imageTab === "link"
                        ? "text-jira-blue dark:text-blue-400 border-jira-blue"
                        : "text-slate-500 dark:text-jira-dark-subtle hover:text-slate-800 dark:hover:text-jira-dark-text border-transparent"
                    }`}
                  >
                    Link
                  </button>
                </div>

                {/* Tab 1: File / Image Upload */}
                {imageTab === "file" ? (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg,.svg,.webp,.gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {isUploading ? (
                      <div className="py-6 flex flex-col items-center justify-center gap-2 text-jira-blue dark:text-blue-400">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-xs font-semibold">Uploading file to server...</span>
                      </div>
                    ) : uploadedPreview ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg border border-slate-200 dark:border-jira-dark-border overflow-hidden max-h-36 flex items-center justify-center bg-slate-50 dark:bg-jira-dark-card p-2">
                          {uploadedIsImage ? (
                            <img
                              src={uploadedPreview}
                              alt="Preview"
                              className="max-h-32 max-w-full object-contain rounded"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 py-3 text-slate-600 dark:text-jira-dark-subtle">
                              <span className="text-2xl">📎</span>
                              <span className="text-xs font-medium max-w-[200px] truncate">
                                {uploadedFileName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-jira-dark-subtle truncate font-medium">
                          {uploadedFileName}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-jira-dark-border">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-jira-blue dark:text-blue-400 hover:underline font-medium"
                          >
                            Change file
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedPreview(null);
                                setUploadedFileName("");
                                setOpenDropdown(null);
                              }}
                              className="px-2 py-1 text-slate-500 dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmFileUpload}
                              className="px-3 py-1 bg-jira-blue hover:bg-jira-blue-hover text-white rounded font-medium shadow-xs"
                            >
                              Insert
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3.5 px-4 border border-slate-300 dark:border-jira-dark-border hover:border-slate-400 hover:bg-slate-50/80 dark:hover:bg-jira-dark-card rounded-lg flex items-center justify-center gap-2.5 text-slate-700 dark:text-jira-dark-text font-medium transition cursor-pointer group shadow-xs"
                      >
                        <Upload size={16} className="text-slate-600 dark:text-jira-dark-subtle group-hover:text-jira-blue dark:group-hover:text-blue-400 transition" />
                        <span className="text-xs font-semibold">Choose File / Image</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* Tab 2: Link URL */
                  <form onSubmit={handleConfirmLinkUpload} className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-jira-dark-subtle mb-1">
                        Image URL
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/image.png"
                        value={linkImageUrl}
                        onChange={(e) => setLinkImageUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-jira-dark-border rounded text-xs outline-none bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:border-jira-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-jira-dark-subtle mb-1">
                        Alt text
                      </label>
                      <input
                        type="text"
                        placeholder="Image description..."
                        value={linkImageAlt}
                        onChange={(e) => setLinkImageAlt(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-jira-dark-border rounded text-xs outline-none bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:border-jira-blue"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-jira-dark-border">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(null)}
                        className="px-2.5 py-1 text-slate-500 dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-jira-blue hover:bg-jira-blue-hover text-white rounded font-medium shadow-xs"
                      >
                        Insert
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* 6. Code snippet */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              handleInsertCode();
            }}
            className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition"
            title="Code (Inline code / Code block)"
          >
            <Code size={14} />
          </button>

          {/* 7. Emoji Picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "emoji" ? null : "emoji");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition ${
                openDropdown === "emoji" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Insert emoji"
            >
              <Smile size={14} />
            </button>

            {openDropdown === "emoji" && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-52 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg p-2 text-xs">
                <div className="grid grid-cols-6 gap-1 text-base text-center">
                  {COMMON_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleInsertEmoji(em);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded transition hover:scale-125"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 8. Insert More (+) - Quote, Divider, Callout Note */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "more" ? null : "more");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition ${
                openDropdown === "more" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Insert more (Quote, Divider, Callout)"
            >
              <Plus size={14} />
            </button>

            {openDropdown === "more" && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-48 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg py-1 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    formatBlock("<blockquote>");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <Quote size={13} />
                  <span>Quote</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertDivider();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <Minus size={13} />
                  <span>Divider</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertNote();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <span>💡</span>
                  <span>Info Box (Callout)</span>
                </button>
              </div>
            )}
          </div>

          {/* 9. Insert Link */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setOpenDropdown(openDropdown === "link" ? null : "link");
              }}
              className={`p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition ${
                openDropdown === "link" ? "bg-slate-200 dark:bg-jira-dark-column text-slate-900 dark:text-white" : ""
              }`}
              title="Insert Link"
            >
              <Link2 size={14} />
            </button>

            {openDropdown === "link" && (
              <form
                onSubmit={handleApplyLink}
                className="absolute left-0 top-full mt-1.5 z-30 w-64 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-lg p-3 text-xs flex flex-col gap-2"
              >
                <div className="font-semibold text-slate-800 dark:text-jira-dark-text">Insert Link</div>
                <input
                  type="text"
                  placeholder="Link text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-jira-dark-border rounded text-xs outline-none bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:border-jira-blue"
                />
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-jira-dark-border rounded text-xs outline-none bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:border-jira-blue"
                />
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(null)}
                    className="px-2 py-1 text-slate-500 dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-jira-blue text-white rounded font-medium hover:bg-jira-blue-hover shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-jira-dark-border mx-1" />

          {/* 10. Undo */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("undo");
            }}
            className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>

          {/* 11. Redo */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("redo");
            }}
            className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>

          {/* 12. Reset */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleReset();
            }}
            className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white transition"
            title="Reset changes"
          >
            <RotateCcw size={13} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Preview / Edit Toggle */}
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
              isPreview
                ? "bg-jira-blue text-white shadow-xs"
                : "text-slate-600 dark:text-jira-dark-subtle hover:bg-slate-200/70 dark:hover:bg-jira-dark-column hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Toggle Live Preview"
          >
            {isPreview ? (
              <>
                <Edit3 size={12} />
                <span>Editor</span>
              </>
            ) : (
              <>
                <Eye size={12} />
                <span>Preview</span>
              </>
            )}
          </button>
        </div>

        {/* Editor Area (ContentEditable WYSIWYG) / Preview Area */}
        <div className="relative rounded-b-lg">
          {isPreview ? (
            <div
              className={`w-full p-3 ${
                mode === "comment" ? "min-h-[100px] max-h-[300px]" : "min-h-[140px] max-h-[380px]"
              } overflow-y-auto text-sm text-slate-800 dark:text-jira-dark-text bg-slate-50/50 dark:bg-jira-dark-surface`}
            >
              {content && content.trim() && content !== "<p><br></p>" ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-jira-dark-text leading-relaxed space-y-1.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                />
              ) : (
                <span className="text-slate-400 dark:text-jira-dark-subtle italic">No content to preview</span>
              )}
            </div>
          ) : (
            <div
              ref={editorRef}
              contentEditable={canEdit}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                      e.preventDefault();
                      try {
                        const res = await api.upload(file);
                        insertHtml(
                          `<img src="${res.url}" alt="${escapeHtml(
                            file.name || "Pasted image"
                          )}" class="max-w-full rounded-md border border-slate-200 dark:border-jira-dark-border my-2 shadow-xs inline-block" />`
                        );
                      } catch (err: any) {
                        console.error("Paste upload failed:", err);
                      }
                      return;
                    }
                  }
                }
              }}
              data-placeholder={placeholder}
              className={`w-full p-3 text-sm text-slate-800 dark:text-jira-dark-text bg-white dark:bg-jira-dark-surface outline-none resize-y ${
                mode === "comment" ? "min-h-[100px] max-h-[300px]" : "min-h-[140px] max-h-[420px]"
              } overflow-y-auto font-sans leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-jira-dark-subtle empty:before:pointer-events-none prose prose-sm dark:prose-invert max-w-none`}
            />
          )}

          {/* Floating @ Mention Popup */}
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div className="absolute left-4 bottom-2 z-40 w-56 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-xl py-1 text-xs max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-jira-dark-subtle uppercase">
                Mention Team Member (@)
              </div>
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectMention(member);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-card flex items-center gap-2 text-slate-700 dark:text-jira-dark-text"
                >
                  <div className="w-5 h-5 rounded-full bg-jira-blue text-white text-[10px] flex items-center justify-center font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-slate-800 dark:text-jira-dark-text truncate">{member.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-jira-dark-subtle truncate">{member.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: Save & Cancel */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-3.5 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded-md shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={13} />
          <span>{isSaving ? "Saving..." : saveButtonText}</span>
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 text-slate-600 dark:text-jira-dark-subtle hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-card text-xs font-semibold rounded-md transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// Helper: Normalize plain text or markdown to clean HTML
// =========================================================================
export function normalizeToHtml(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  // If it already contains HTML tags like <p>, <div>, <b>, <span>, <h1>, return as is
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return val;
  }
  // Convert newlines and basic markdown to HTML
  const lines = val.split("\n");
  const paragraphs = lines.map((line) => {
    if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith("> ")) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
    if (line.startsWith("- ")) return `<ul><li>${escapeHtml(line.slice(2))}</li></ul>`;
    if (line.trim() === "") return "<p><br></p>";

    let parsed = escapeHtml(line)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/~~(.*?)~~/g, "<strike>$1</strike>")
      .replace(/`(.*?)`/g, '<code class="bg-slate-100 dark:bg-jira-dark-column px-1 py-0.5 rounded font-mono text-xs border border-slate-200 dark:border-jira-dark-border">$1</code>');
    return `<p>${parsed}</p>`;
  });
  return paragraphs.join("");
}

// Helper: Escape HTML characters for text
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Sanitize safe HTML for output
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/on\w+="[^"]*"/gi, "");
}
