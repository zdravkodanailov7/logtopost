import React from "react";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#10b981", "#34d399", "#6ee7b7", "#10b981"],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  return (
    <div
      className={`relative mx-auto flex max-w-fit flex-row items-center justify-center font-medium ${className}`}
    >
      <div
        className="inline-block relative text-transparent bg-gradient-to-r animate-[shiny-text_5s_infinite]"
        style={{
          backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          backgroundSize: "200% 100%",
          "--shiny-width": "100px",
        } as React.CSSProperties & { "--shiny-width": string }}
      >
        {children}
      </div>
    </div>
  );
} 