import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { t } from "../lib/i18n";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate: (data: {
    name: string;
    key: string;
    description?: string;
  }) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmitCreate,
}) => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Auto-generate key from project name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!key || key.length <= 4) {
      const generated = newName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4);
      if (generated) setKey(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) {
      setError("Nama project dan key wajib diisi");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmitCreate({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
      });
      setName("");
      setKey("");
      setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal membuat project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-jira-modal border border-jira-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 border-b border-jira-border flex items-center justify-between">
          <h2 className="text-base font-bold text-jira-text">{t.nav.createProject}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-jira-subtle hover:text-jira-text hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Nama Project <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={handleNameChange}
              placeholder="Contoh: Aplikasi Layanan Pelanggan"
              className="w-full px-3 py-2 bg-white border border-jira-border rounded-md text-xs text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Key Project (Awalan Work Item) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={6}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="Contoh: APP"
              className="w-full px-3 py-2 bg-white border border-jira-border rounded-md text-xs text-jira-text font-mono uppercase outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
            <p className="text-[11px] text-jira-subtle mt-1">
              2-6 huruf/angka kapital. Work item akan bernomor {key || "KEY"}-1, {key || "KEY"}-2.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Deskripsi ({t.common.optional})
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan, ruang lingkup, atau pedoman project..."
              className="w-full px-3 py-2 bg-white border border-jira-border rounded-md text-xs text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue resize-y"
            />
          </div>

          <div className="pt-3 border-t border-jira-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-jira-subtle hover:text-jira-text hover:bg-slate-100 rounded-md transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !key.trim()}
              className="px-5 py-2 bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-2 transition"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              <span>{t.nav.createProject}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
