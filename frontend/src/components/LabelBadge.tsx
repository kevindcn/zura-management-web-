import React from "react";
import { Label } from "../types";
import { X } from "lucide-react";

interface LabelBadgeProps {
  label: Label | { name: string; color?: string | null };
  onRemove?: () => void;
  size?: "sm" | "md";
  interactive?: boolean;
}

export const LabelBadge: React.FC<LabelBadgeProps> = ({
  label,
  onRemove,
  size = "sm",
  interactive = false,
}) => {
  const color = label.color || "#0C66E4";

  // Lighten background for a refined modern aesthetic
  const isSmall = size === "sm";

  return (
    <span
      style={{
        backgroundColor: `${color}18`, // 10% opacity tint
        borderColor: `${color}40`,     // 25% opacity border
        color: color,
      }}
      className={`inline-flex items-center gap-1 font-semibold rounded-md border tracking-tight transition select-none ${
        isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      } ${interactive ? "hover:brightness-95 cursor-pointer" : ""}`}
    >
      <span
        style={{ backgroundColor: color }}
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      />
      <span className="truncate max-w-[120px]">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-75 p-0.5 rounded transition"
          title={`Remove label ${label.name}`}
        >
          <X size={isSmall ? 10 : 12} />
        </button>
      )}
    </span>
  );
};
