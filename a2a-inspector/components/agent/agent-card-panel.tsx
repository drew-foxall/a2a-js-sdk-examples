"use client";

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import { Code, Info } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { AgentCardDisplay } from "@/components/connection/agent-card-display";
import { JsonViewerButton } from "@/components/debug/json-viewer-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface AgentCardPanelProps {
  readonly agentName: string;
  readonly agentUrl: string;
  readonly card: AgentCard;
}

export function AgentCardPanel({
  agentName,
  agentUrl,
  card,
}: AgentCardPanelProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [jsonOpen, setJsonOpen] = useState(false);

  const json = useMemo(() => JSON.stringify(card, null, 2), [card]);

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate font-medium">{agentName}</div>
        <div className="truncate text-xs text-muted-foreground">{agentUrl}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setJsonOpen(true)}
          title="View JSON"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1 p-4">
        <AgentCardDisplay card={card} />
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* JSON dialog (explicitly requested pattern) */}
      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Agent Card JSON
            </DialogTitle>
            <DialogDescription>Raw `agent-card.json` content for debugging.</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <JsonViewerButton data={card} title="Agent card JSON" />
            <pre className="mt-3 max-h-[60vh] overflow-auto bg-muted p-3 text-xs">{json}</pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full card: Sheet on desktop, Drawer on mobile */}
      {isMobile ? (
        <Drawer>
          <DrawerTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Info className="h-4 w-4" />
              <span>Agent card</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Agent card</DrawerTitle>
              <DrawerDescription>{header}</DrawerDescription>
            </DrawerHeader>
            {content}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet>
          <SheetTrigger render={<Button type="button" variant="ghost" size="sm" />}>
            <Info className="h-4 w-4" />
            <span>Agent card</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[90vw] sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Agent card</SheetTitle>
              <SheetDescription>{header}</SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
