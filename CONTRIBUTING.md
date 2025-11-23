# Contributing to A2A JS SDK Examples

Thank you for your interest in contributing! This project welcomes contributions from the community.

## Project Overview

This repository provides:

- **[@drew-foxall/a2a-ai-sdk-adapter](packages/a2a-ai-sdk-adapter)** - NPM package for bridging Vercel AI SDK agents with A2A protocol
- **[Agent Examples](examples/agents)** - Fully functional A2A agent examples for learning and reference

Inspired by [Google's a2a-samples](https://github.com/google/a2a-samples), this is an independent project focused on JavaScript/TypeScript implementations.

## How to Contribute

### Reporting Issues

- **Bug Reports**: Use GitHub Issues to report bugs. Include:
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details (Node version, OS, etc.)

- **Feature Requests**: Open an issue describing:
  - The problem you're trying to solve
  - Your proposed solution
  - Any alternatives you've considered

### Pull Requests

We welcome pull requests for:
- Bug fixes
- New agent examples
- Documentation improvements
- Performance improvements
- Test coverage

#### PR Guidelines

1. **Fork and Branch**
   - Fork the repository
   - Create a feature branch: `git checkout -b feature/your-feature-name`

2. **Development Setup**
   ```bash
   pnpm install
   pnpm build
   pnpm test
   ```

3. **Code Quality**
   - Follow existing code style
   - Run linter: `pnpm lint`
   - Fix formatting: `pnpm format:write`
   - Ensure tests pass: `pnpm test`
   - Add tests for new features

4. **Commit Messages**
   - Use conventional commits format:
     - `feat: add new agent example`
     - `fix: resolve streaming issue`
     - `docs: update README`
     - `refactor: simplify adapter logic`
     - `test: add integration tests`

5. **Submit PR**
   - Push to your fork
   - Open a PR with clear description
   - Link any related issues
   - Wait for review

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Biome (see `biome.json`)
- **Testing**: Vitest
- **Documentation**: Inline comments for complex logic

### Adding New Agent Examples

When adding a new agent example:

1. Create directory: `examples/agents/src/agents/your-agent/`
2. Required files:
   - `agent.ts` - Agent implementation
   - `agent.test.ts` - Tests focusing on core purpose
   - `index.ts` - Hono server setup
   - `README.md` - Clear documentation
   - `prompt.ts` - System prompts (if applicable)
   - `tools.ts` & `tools.test.ts` - Tools and tests (if applicable)

3. Follow existing patterns (see `hello-world` for minimal example)
4. Include `.env.example` if API keys needed
5. Update main `examples/agents/README.md`

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to maintain a respectful and inclusive environment.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Review documentation in README files

## Acknowledgments

This project is inspired by Google's [a2a-samples](https://github.com/google/a2a-samples) repository and built on top of [@drew-foxall/a2a-js-sdk](https://github.com/drew-foxall/a2a-js-sdk).
