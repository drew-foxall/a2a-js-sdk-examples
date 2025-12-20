"use client";

import { Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthConfig, useInspector } from "@/context";
import { cn } from "@/lib/utils";
import type { CustomHeader } from "@/types";

interface CustomHeadersPanelProps {
  readonly className?: string;
  readonly disabled?: boolean;
}

/**
 * CustomHeadersPanel component - Allows users to add/remove custom HTTP headers.
 *
 * These headers are sent with all API requests to the A2A agent.
 */
export function CustomHeadersPanel({
  className,
  disabled = false,
}: CustomHeadersPanelProps): React.JSX.Element {
  const authConfig = useAuthConfig();
  const { dispatch, log } = useInspector();

  const customHeaders = authConfig.customHeaders ?? [];

  const addHeader = useCallback(() => {
    const newHeader: CustomHeader = {
      id: crypto.randomUUID(),
      name: "",
      value: "",
      enabled: true,
    };
    dispatch({
      type: "SET_AUTH_CONFIG",
      payload: {
        ...authConfig,
        customHeaders: [...customHeaders, newHeader],
      },
    });
    log("info", "Added new custom header");
  }, [authConfig, customHeaders, dispatch, log]);

  const updateHeader = useCallback(
    (id: string, updates: Partial<CustomHeader>) => {
      const updatedHeaders = customHeaders.map((header) =>
        header.id === id ? { ...header, ...updates } : header
      );
      dispatch({
        type: "SET_AUTH_CONFIG",
        payload: {
          ...authConfig,
          customHeaders: updatedHeaders,
        },
      });
    },
    [authConfig, customHeaders, dispatch]
  );

  const removeHeader = useCallback(
    (id: string) => {
      const updatedHeaders = customHeaders.filter((header) => header.id !== id);
      dispatch({
        type: "SET_AUTH_CONFIG",
        payload: {
          ...authConfig,
          customHeaders: updatedHeaders,
        },
      });
      log("info", "Removed custom header");
    },
    [authConfig, customHeaders, dispatch, log]
  );

  const toggleHeader = useCallback(
    (id: string) => {
      const header = customHeaders.find((h) => h.id === id);
      if (header) {
        updateHeader(id, { enabled: !header.enabled });
      }
    },
    [customHeaders, updateHeader]
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Custom Headers</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHeader}
          disabled={disabled}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Header
        </Button>
      </div>

      {customHeaders.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No custom headers configured. Click "Add Header" to add one.
        </p>
      ) : (
        <div className="space-y-2">
          {customHeaders.map((header) => (
            <HeaderRow
              key={header.id}
              header={header}
              disabled={disabled}
              onUpdate={(updates) => updateHeader(header.id, updates)}
              onRemove={() => removeHeader(header.id)}
              onToggle={() => toggleHeader(header.id)}
            />
          ))}
        </div>
      )}

      {customHeaders.length > 0 && (
        <p className="text-xs text-zinc-500">
          {customHeaders.filter((h) => h.enabled && h.name && h.value).length} of{" "}
          {customHeaders.length} headers will be sent with requests.
        </p>
      )}
    </div>
  );
}

/**
 * Individual header row component.
 */
function HeaderRow({
  header,
  disabled,
  onUpdate,
  onRemove,
  onToggle,
}: {
  readonly header: CustomHeader;
  readonly disabled: boolean;
  readonly onUpdate: (updates: Partial<CustomHeader>) => void;
  readonly onRemove: () => void;
  readonly onToggle: () => void;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-2",
        !header.enabled && "opacity-50"
      )}
    >
      {/* Enable/Disable Checkbox */}
      <input
        type="checkbox"
        checked={header.enabled}
        onChange={onToggle}
        disabled={disabled}
        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
        aria-label={`Enable header ${header.name || "unnamed"}`}
      />

      {/* Header Name */}
      <Input
        type="text"
        value={header.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Header name"
        disabled={disabled || !header.enabled}
        className="h-8 flex-1 text-xs"
      />

      {/* Header Value */}
      <Input
        type="text"
        value={header.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Header value"
        disabled={disabled || !header.enabled}
        className="h-8 flex-1 text-xs"
      />

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Helper function to convert custom headers to a Record.
 * Only includes enabled headers with both name and value.
 */
export function customHeadersToRecord(headers: CustomHeader[] | undefined): Record<string, string> {
  if (!headers) return {};

  return headers
    .filter((h) => h.enabled && h.name.trim() && h.value.trim())
    .reduce(
      (acc, h) => {
        acc[h.name.trim()] = h.value.trim();
        return acc;
      },
      {} as Record<string, string>
    );
}
