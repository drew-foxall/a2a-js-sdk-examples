"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";

function HoverCard({
  openDelay,
  closeDelay,
  ...props
}: PreviewCardPrimitive.Root.Props & {
  openDelay?: number;
  closeDelay?: number;
}) {
  return (
    <PreviewCardPrimitive.Root
      data-slot="hover-card"
      {...(openDelay !== undefined && { delay: openDelay })}
      {...(closeDelay !== undefined && { closeDelay })}
      {...props}
    />
  );
}

function HoverCardTrigger({
  className,
  ...props
}: Omit<PreviewCardPrimitive.Trigger.Props, "className"> & { className?: string }) {
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      {...(className !== undefined && { className })}
      {...props}
    />
  );
}

function HoverCardContent({
  className,
  sideOffset = 4,
  align,
  ...props
}: Omit<PreviewCardPrimitive.Popup.Props, "className"> & {
  className?: string;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        sideOffset={sideOffset}
        {...(align !== undefined && { align })}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "bg-popover text-popover-foreground z-50 w-64 rounded-none border p-4 shadow-md outline-hidden",
            "transition-all duration-150",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
