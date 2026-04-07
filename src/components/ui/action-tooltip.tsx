"use client";

import { TooltipRoot, TooltipTrigger, TooltipContent } from "@heroui/react";

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
}

export function ActionTooltip({ label, children }: ActionTooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent placement="top" showArrow>
        <span className="text-xs">{label}</span>
      </TooltipContent>
    </TooltipRoot>
  );
}
