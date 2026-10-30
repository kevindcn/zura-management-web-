import React from "react";
import zuraIconPng from "./photo/zura-icon.png";

interface ZuraLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export const ZuraLogo: React.FC<ZuraLogoProps> = ({
  size = "md",
  showText = true,
  className = "",
}) => {
  const iconDimensions = {
    sm: "w-6 h-6",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  }[size];

  const textSizes = {
    sm: "text-sm",
    md: "text-[16px]",
    lg: "text-2xl",
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Zura Brand Logo Icon */}
      <img
        src={zuraIconPng}
        alt="Zura"
        className={`${iconDimensions} object-contain flex-shrink-0 drop-shadow-xs`}
        draggable={false}
      />

      {/* Brand Text */}
      {showText && (
        <span className={`font-bold ${textSizes} tracking-tight text-[#172B4D] dark:text-white transition-colors`}>
          Zura
          <span className="text-blue-600 dark:text-blue-400 font-extrabold ml-0.5">.</span>
        </span>
      )}
    </div>
  );
};
