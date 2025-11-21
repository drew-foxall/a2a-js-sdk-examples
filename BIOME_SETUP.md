# Biome Linter & Formatter Setup

**Linter/Formatter**: [Biome](https://biomejs.dev/)  
**Version**: 2.3.6  
**Setup Date**: 2025-11-21

---

## Why Biome?

We use [Biome](https://biomejs.dev/) as our all-in-one linter and formatter because it:

1. ✅ **Fast** - Written in Rust, 25x faster than ESLint
2. ✅ **Unified** - Combines linting + formatting in one tool
3. ✅ **TypeScript Native** - Excellent TypeScript support out of the box
4. ✅ **Smart Fixes** - Auto-fixes many issues with `--write`
5. ✅ **Git Integration** - Respects `.gitignore` automatically
6. ✅ **Low Configuration** - Sensible defaults with minimal setup

---

## Configuration

### Location

**Root config**: `/biome.json`

This configuration applies to the entire workspace.

### Key Settings

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  }
}
```

### Style Guide

| Setting | Value | Reasoning |
|---------|-------|-----------|
| **Quotes** | Double (`"`) | Consistent with JSON, easier to read |
| **Semicolons** | Always | Explicit, prevents ASI issues |
| **Indent** | 2 spaces | Standard TypeScript/JavaScript convention |
| **Line Width** | 100 chars | Balances readability and screen space |
| **Trailing Commas** | ES5 | Git diffs stay clean |

---

## Usage

### Check Code (Lint + Format)

```bash
# From root
pnpm biome check samples/js/

# From samples/js
pnpm lint
```

### Auto-Fix Issues

```bash
# From root (safe fixes only)
pnpm biome check --write samples/js/

# From root (include unsafe fixes)
pnpm biome check --write --unsafe samples/js/

# From samples/js
pnpm lint:fix
```

### Format Only

```bash
# From root (check formatting)
pnpm biome format samples/js/

# From root (apply formatting)
pnpm biome format --write samples/js/

# From samples/js
pnpm format:write
```

### Type Check

```bash
# From samples/js
pnpm typecheck
```

---

## Available Scripts

### Root Level (`/package.json`)

```bash
pnpm lint          # Check all code
pnpm lint:fix      # Auto-fix all issues
pnpm format        # Check formatting
pnpm format:write  # Apply formatting
pnpm check         # Alias for lint
```

### Samples Level (`/samples/js/package.json`)

```bash
pnpm lint          # Check samples/js code
pnpm lint:fix      # Auto-fix samples/js issues
pnpm format        # Check samples/js formatting
pnpm format:write  # Apply samples/js formatting
pnpm typecheck     # Run TypeScript type checking
```

---

## Common Warnings

### 1. `noExplicitAny` ⚠️

**What**: Using `any` type disables type checking

```typescript
// ❌ Bad
function process(data: any) { ... }

// ✅ Good
function process(data: Record<string, unknown>) { ... }
function process<T>(data: T) { ... }
```

**Status**: Set to `"warn"` - we're gradually removing `any` usage

### 2. `noUnusedImports` 🔧

**What**: Imports that aren't used in the code

```typescript
// ❌ Bad
import { ToolLoopAgent, unused } from "ai";

// ✅ Good
import { ToolLoopAgent } from "ai";
```

**Fix**: Auto-fixed with `--write --unsafe`

### 3. `useTemplate` 🔧

**What**: Prefer template literals over string concatenation

```typescript
// ❌ Bad
const message = "Hello " + name + "!";

// ✅ Good
const message = `Hello ${name}!`;
```

**Fix**: Auto-fixed with `--write --unsafe`

---

## Integration with IDE

### VS Code

1. Install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
2. Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

### Other IDEs

See [Biome Editor Integration](https://biomejs.dev/guides/editors/first-party-plugins/)

---

## CI/CD Integration

### Pre-commit Hook (Recommended)

```bash
# .git/hooks/pre-commit
#!/bin/sh
pnpm biome check --staged
```

### GitHub Actions

```yaml
- name: Lint and Format Check
  run: |
    pnpm biome check samples/js/
```

---

## Comparison with ESLint + Prettier

| Feature | Biome | ESLint + Prettier |
|---------|-------|-------------------|
| **Speed** | ⚡ 25x faster | Slower |
| **Setup** | Single config | Two configs |
| **Tools** | Lint + Format | Two tools |
| **TypeScript** | Native | Needs @typescript-eslint |
| **Auto-fix** | Built-in | Built-in (ESLint) |
| **Imports** | Auto-organizes | Needs plugin |

---

## Migration Notes

### What Changed

**Before** (No linter/formatter):
- Manual code style consistency
- No automated formatting
- No lint checks

**After** (Biome):
- ✅ Automated code formatting
- ✅ Lint rules catch common issues
- ✅ Auto-organize imports
- ✅ Consistent code style across project

### Files Fixed

After initial setup, Biome auto-fixed **6 files**:

- String concatenation → Template literals
- Removed unused imports
- Consistent array type syntax
- Organized imports

**Remaining warnings**: 10 (mostly `noExplicitAny` - being addressed gradually)

---

## Known Issues

### TypeScript Compiler vs Biome

**Important**: Biome and TypeScript are complementary tools:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Biome** | Lint + Format | Code style, common issues |
| **TypeScript** | Type checking | Type safety, interfaces |

**Both are needed** for a robust codebase:

```bash
# Check both
pnpm lint && pnpm typecheck
```

### Biome Doesn't Replace TypeScript

Biome **cannot** check:
- Type assignments
- Interface compatibility
- Generic constraints
- Complex type inference

Always run `tsc --noEmit` for full type checking!

---

## Customization

### Disable Rules

In `biome.json`:

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off"  // ❌ Not recommended
      }
    }
  }
}
```

### Override for Specific Files

```json
{
  "overrides": [
    {
      "includes": ["*.test.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

---

## Development Workflow

### Recommended Workflow

1. **Write code** with IDE auto-format on save
2. **Before commit**:
   ```bash
   pnpm lint:fix     # Auto-fix lint issues
   pnpm typecheck    # Verify types
   ```
3. **Commit** clean, formatted code

### Quick Check

```bash
# One command to check everything
pnpm lint && pnpm typecheck
```

---

## Resources

- **Official Docs**: [biomejs.dev](https://biomejs.dev/)
- **Configuration Reference**: [Biome Config](https://biomejs.dev/reference/configuration/)
- **VS Code Extension**: [Biome for VS Code](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
- **Rules Documentation**: [Biome Lint Rules](https://biomejs.dev/linter/rules/)

---

## Maintenance

### Updating Biome

```bash
# Check for updates
pnpm add -D @biomejs/biome@latest

# Update schema in biome.json
pnpm biome migrate
```

### Monitoring

Current status:
- ✅ **6 files** auto-fixed on initial setup
- ⚠️ **10 warnings** remaining (mostly `any` usage)
- 🎯 **Goal**: Zero warnings by end of Phase 5

---

*Last updated: 2025-11-21*

