# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-04

### Added

- `authRequired` convenience flag in `A2aProviderMetadata` (similar to `inputRequired`)
  - Set to `true` when task state is `auth-required`
  - Enables clients to easily detect when authentication is needed

### Fixed

- `submitted` task state now correctly maps to `finishReason: "other"` instead of `"stop"`
  - `submitted` means queued but not yet processing, not a completed response
- Added explicit `unknown` state handling in `mapTaskStateToFinishReason`

### Changed

- Updated README with `authRequired` documentation
- Updated A2A protocol compatibility table

## [1.0.0] - 2024-12-16

### Added

- Initial release of `@drew-foxall/a2a-ai-provider-v3`
- `LanguageModelV3` implementation for AI SDK compatibility
- Full A2A protocol support:
  - JSON-RPC transport via `ClientFactory`
  - Streaming (SSE) with automatic fallback for non-streaming agents
  - All part types: TextPart, FilePart, DataPart
  - Artifact handling with metadata exposure
  - Task state mapping to AI SDK finish reasons
  - `input-required` state detection with explicit flag
  - Context and task continuation (`contextId`, `taskId`)
- Agent discovery helpers:
  - `discoverAgent()` - Well-known URI discovery (RFC 8615)
  - `fetchAgentCard()` - Direct URL fetch
  - `supportsCapability()` - Capability checking
  - `getAuthSchemes()` - Authentication scheme extraction
- Provider factory:
  - `a2aV3()` - Default provider instance
  - `createA2aV3()` - Custom provider with ID generator
- Type-safe provider metadata and options
- Comprehensive TypeScript types and JSDoc documentation
- Edge runtime compatible (Cloudflare Workers, Vercel Edge)

