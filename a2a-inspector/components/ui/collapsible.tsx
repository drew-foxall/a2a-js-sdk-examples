"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
const CollapsiblePanel = CollapsiblePrimitive.Panel;

// Alias for backwards compatibility with Radix naming
const CollapsibleContent = CollapsiblePrimitive.Panel;

export { Collapsible, CollapsibleContent, CollapsiblePanel, CollapsibleTrigger };
