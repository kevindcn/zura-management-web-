import React from "react";

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

  const svgDimensions = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  }[size];

  const textSizes = {
    sm: "text-sm",
    md: "text-[16px]",
    lg: "text-2xl",
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Icon Badge */}
      <div
        className={`${iconDimensions} rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-sm flex-shrink-0 relative overflow-hidden`}
      >
        {/* Subtle glass reflection highlight */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        {/* Modern Stylized Z Logo */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${svgDimensions} relative z-10 drop-shadow-xs`}
        >
          <path
            d="M5 5.5C5 4.67 5.67 4 6.5 4H18C18.83 4 19.35 4.96 18.84 5.61L9.67 17H17.5C18.33 17 19 17.67 19 18.5C19 19.33 18.33 20 17.5 20H6.5C5.67 20 5.15 19.04 5.66 18.39L14.83 7H6.5C5.67 7 5 6.33 5 5.5Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <span className={`font-bold ${textSizes} tracking-tight text-[#172B4D]`}>
          Zura
          <span className="text-blue-600 font-extrabold ml-0.5">.</span>
        </span>
      )}
    </div>
  );
};
