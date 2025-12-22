"use client";

import { Eye, EyeOff, Key, Lock, Shield, User } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthConfig, useInspector } from "@/context";
import { cn } from "@/lib/utils";
import type { AuthConfig, AuthType } from "@/types";

/**
 * Valid auth type values.
 */
const AUTH_TYPE_VALUES: readonly AuthType[] = ["none", "bearer", "api-key", "basic"] as const;

/**
 * Type guard to check if a value is a valid AuthType.
 */
function isAuthType(value: unknown): value is AuthType {
  return typeof value === "string" && AUTH_TYPE_VALUES.includes(value as AuthType);
}

/**
 * Auth type configuration with labels and icons.
 */
const AUTH_TYPES: Array<{
  value: AuthType;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    value: "none",
    label: "No Authentication",
    icon: Shield,
    description: "Connect without authentication",
  },
  {
    value: "bearer",
    label: "Bearer Token",
    icon: Key,
    description: "Use a Bearer token in the Authorization header",
  },
  {
    value: "api-key",
    label: "API Key",
    icon: Lock,
    description: "Use a custom header with an API key",
  },
  {
    value: "basic",
    label: "Basic Auth",
    icon: User,
    description: "Use HTTP Basic Authentication",
  },
];

interface AuthConfigPanelProps {
  readonly className?: string;
  readonly disabled?: boolean;
}

/**
 * AuthConfigPanel component - Configures authentication for agent connections.
 *
 * Supports:
 * - No authentication
 * - Bearer token
 * - API key (custom header)
 * - Basic authentication (username/password)
 */
export function AuthConfigPanel({
  className,
  disabled = false,
}: AuthConfigPanelProps): React.JSX.Element {
  const authConfig = useAuthConfig();
  const { dispatch, log } = useInspector();
  const [showSecrets, setShowSecrets] = useState(false);

  const updateAuthConfig = useCallback(
    (updates: Partial<AuthConfig>) => {
      const newConfig: AuthConfig = {
        ...authConfig,
        ...updates,
      };
      dispatch({ type: "SET_AUTH_CONFIG", payload: newConfig });
      log("info", `Auth configuration updated: ${newConfig.type}`);
    },
    [authConfig, dispatch, log]
  );

  const handleTypeChange = useCallback(
    (value: string | null) => {
      if (value === null || !isAuthType(value)) return;
      // Reset all auth fields when changing type
      const newConfig: AuthConfig = {
        type: value,
      };
      dispatch({ type: "SET_AUTH_CONFIG", payload: newConfig });
      log("info", `Auth type changed to: ${value}`);
    },
    [dispatch, log]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Auth Type Selector */}
      <div className="space-y-2">
        <label htmlFor="auth-type" className="text-sm font-medium text-zinc-300">
          Authentication Type
        </label>
        <Select value={authConfig.type} onValueChange={handleTypeChange} disabled={disabled}>
          <SelectTrigger id="auth-type" className="w-full">
            <SelectValue placeholder="Select authentication type" />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map(({ value, label, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500">
          {AUTH_TYPES.find((t) => t.value === authConfig.type)?.description}
        </p>
      </div>

      {/* Bearer Token Fields */}
      {authConfig.type === "bearer" && (
        <div className="space-y-2">
          <label htmlFor="bearer-token" className="text-sm font-medium text-zinc-300">
            Bearer Token
          </label>
          <div className="relative">
            <Input
              id="bearer-token"
              type={showSecrets ? "text" : "password"}
              value={authConfig.bearerToken || ""}
              onChange={(e) => updateAuthConfig({ bearerToken: e.target.value })}
              placeholder="Enter your bearer token"
              disabled={disabled}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setShowSecrets(!showSecrets)}
            >
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Will be sent as:{" "}
            <code className="text-primary">Authorization: Bearer &lt;token&gt;</code>
          </p>
        </div>
      )}

      {/* API Key Fields */}
      {authConfig.type === "api-key" && (
        <>
          <div className="space-y-2">
            <label htmlFor="api-key-header" className="text-sm font-medium text-zinc-300">
              Header Name
            </label>
            <Input
              id="api-key-header"
              type="text"
              value={authConfig.apiKeyHeader || ""}
              onChange={(e) => updateAuthConfig({ apiKeyHeader: e.target.value })}
              placeholder="e.g., X-API-Key"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="api-key-value" className="text-sm font-medium text-zinc-300">
              API Key
            </label>
            <div className="relative">
              <Input
                id="api-key-value"
                type={showSecrets ? "text" : "password"}
                value={authConfig.apiKeyValue || ""}
                onChange={(e) => updateAuthConfig({ apiKeyValue: e.target.value })}
                placeholder="Enter your API key"
                disabled={disabled}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Will be sent as:{" "}
              <code className="text-primary">
                {authConfig.apiKeyHeader || "X-API-Key"}: &lt;key&gt;
              </code>
            </p>
          </div>
        </>
      )}

      {/* Basic Auth Fields */}
      {authConfig.type === "basic" && (
        <>
          <div className="space-y-2">
            <label htmlFor="basic-username" className="text-sm font-medium text-zinc-300">
              Username
            </label>
            <Input
              id="basic-username"
              type="text"
              value={authConfig.basicUsername || ""}
              onChange={(e) => updateAuthConfig({ basicUsername: e.target.value })}
              placeholder="Enter username"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="basic-password" className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <div className="relative">
              <Input
                id="basic-password"
                type={showSecrets ? "text" : "password"}
                value={authConfig.basicPassword || ""}
                onChange={(e) => updateAuthConfig({ basicPassword: e.target.value })}
                placeholder="Enter password"
                disabled={disabled}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Will be sent as:{" "}
              <code className="text-primary">Authorization: Basic &lt;base64&gt;</code>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Helper function to convert AuthConfig to HTTP headers.
 * Used by hooks when making API requests.
 * Includes both authentication headers and custom headers.
 */
export function authConfigToHeaders(config: AuthConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  // Add authentication headers
  switch (config.type) {
    case "bearer":
      if (config.bearerToken) {
        headers.Authorization = `Bearer ${config.bearerToken}`;
      }
      break;
    case "api-key":
      if (config.apiKeyHeader && config.apiKeyValue) {
        headers[config.apiKeyHeader] = config.apiKeyValue;
      }
      break;
    case "basic":
      if (config.basicUsername && config.basicPassword) {
        const credentials = btoa(`${config.basicUsername}:${config.basicPassword}`);
        headers.Authorization = `Basic ${credentials}`;
      }
      break;
    default:
      // "none" or unknown type - no headers needed
      break;
  }

  // Add custom headers (enabled ones with both name and value)
  if (config.customHeaders) {
    for (const header of config.customHeaders) {
      if (header.enabled && header.name.trim() && header.value.trim()) {
        headers[header.name.trim()] = header.value.trim();
      }
    }
  }

  return headers;
}
