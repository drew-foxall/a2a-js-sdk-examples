"use client";

import { Check, Code2, Copy } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface JsonViewerModalProps {
  readonly data: unknown;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly trigger?: React.ReactElement | undefined;
  readonly className?: string | undefined;
}

/**
 * JSON Viewer Modal - Displays raw JSON with syntax highlighting.
 *
 * Features:
 * - Syntax-highlighted JSON display
 * - Copy to clipboard functionality
 * - Responsive modal with scrollable content
 */
export function JsonViewerModal({
  data,
  title = "Raw JSON",
  description,
  trigger,
  className,
}: JsonViewerModalProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  const jsonString = JSON.stringify(data, null, 2);

  // Load syntax highlighting asynchronously
  useEffect(() => {
    let cancelled = false;

    async function highlightCode() {
      try {
        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(jsonString, {
          lang: "json",
          theme: "github-dark",
        });
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch (error) {
        console.error("Failed to highlight code:", error);
        // Fallback to plain text if highlighting fails
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      }
    }

    highlightCode();

    return () => {
      cancelled = true;
    };
  }, [jsonString]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [jsonString]);

  return (
    <Dialog>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="sm" className={cn("gap-1.5", className)}>
              <Code2 className="h-3.5 w-3.5" />
              <span>View JSON</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] w-[90vw] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="relative min-w-0">
          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute right-2 top-2 z-10 gap-1.5 bg-card/80 hover:bg-card"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>

          {/* JSON content - scrollable both horizontally and vertically */}
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-card">
            {highlightedHtml ? (
              <div
                className="min-w-max p-4 text-sm [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!whitespace-pre"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is trusted
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre className="min-w-max whitespace-pre p-4 text-sm text-zinc-300">
                <code>{jsonString}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Metadata footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{jsonString.length.toLocaleString()} characters</span>
          <span>{jsonString.split("\n").length} lines</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline JSON viewer button that opens the modal.
 */
export function JsonViewerButton({
  data,
  title,
  description,
  className,
}: Omit<JsonViewerModalProps, "trigger">): React.JSX.Element {
  return (
    <JsonViewerModal
      data={data}
      title={title}
      description={description}
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
            "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
            className
          )}
        >
          <Code2 className="h-3 w-3" />
          <span>JSON</span>
        </button>
      }
    />
  );
}
