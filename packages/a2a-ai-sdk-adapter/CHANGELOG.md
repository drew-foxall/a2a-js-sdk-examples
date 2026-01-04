# Changelog

All notable changes to `@drew-foxall/a2a-ai-sdk-adapter` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-04

### Changed
- **BREAKING**: Minimum Node.js version increased to >=24.0.0 (Active LTS - Krypton)
- Updated pnpm version to 10.23.0
- Updated peer dependency `@drew-foxall/a2a-js-sdk` to `^0.4.2`
- Updated peer dependency `ai` to `^6.0.0`
- Updated peer dependency `workflow` to `4.0.1-beta.32`
- Added `zod` as optional peer dependency (`>=4.0.0`)

### Removed
- **BREAKING**: Removed `workingMessage` configuration option
  - Status messages should be handled at the protocol layer, not added to agent output
  - This prevents false data being added to agent responses
- Support for Node.js 20.x, 22.x, and earlier versions

### Fixed
- Updated internal dependencies for Node.js 24 compatibility

## [1.0.2] - 2025-11-25

### Added
- GitHub Actions CI/CD pipeline for automated testing and publishing
- Comprehensive linting with Biome
- Formatting scripts
- Automated npm publishing via git tags

### Changed
- Updated README to focus on adapter functionality (not repository)
- Improved package.json metadata
- Added provenance support for npm publishing

### Fixed
- Package name corrected from `a2a-js-sdk-examples` to `@drew-foxall/a2a-ai-sdk-adapter`

## [1.0.1] - 2025-11-25

### Fixed
- README improvements for npm package page

## [1.0.0] - 2025-11-25

### Added
- Initial release of A2A AI SDK Adapter
- Support for Vercel AI SDK ToolLoopAgent integration with A2A protocol
- SSE (Server-Sent Events) streaming for agent responses
- JSON-RPC 2.0 transport support
- Agent card validation and serving via `/.well-known/agent-card.json`
- Comprehensive TypeScript types for A2A protocol
- Message format conversion between AI SDK and A2A
- Error handling and validation
- Tool/skill mapping between protocols
- Complete test coverage with Vitest

### Core Features
- `A2AAdapter` class for wrapping ToolLoopAgent instances
- `a2a()` function for consuming remote A2A agents as AI SDK models
- Full support for A2A protocol v0.2.0
- Streaming and non-streaming message handling
- UUID-based message correlation
- Automatic agent card generation and validation

[Unreleased]: https://github.com/drew-foxall/a2a-js-sdk-examples/compare/@drew-foxall/a2a-ai-sdk-adapter@1.0.2...HEAD
[1.0.2]: https://github.com/drew-foxall/a2a-js-sdk-examples/compare/@drew-foxall/a2a-ai-sdk-adapter@1.0.1...@drew-foxall/a2a-ai-sdk-adapter@1.0.2
[1.0.1]: https://github.com/drew-foxall/a2a-js-sdk-examples/compare/@drew-foxall/a2a-ai-sdk-adapter@1.0.0...@drew-foxall/a2a-ai-sdk-adapter@1.0.1
[1.0.0]: https://github.com/drew-foxall/a2a-js-sdk-examples/releases/tag/@drew-foxall/a2a-ai-sdk-adapter@1.0.0

