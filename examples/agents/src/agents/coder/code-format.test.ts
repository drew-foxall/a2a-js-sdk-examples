import { describe, expect, it } from "vitest";
import { CODER_SYSTEM_PROMPT, extractCodeBlocks } from "./code-format";

describe("extractCodeBlocks", () => {
  it("should extract code block with language and filename", () => {
    const result = extractCodeBlocks(`
Here's a function:

\`\`\`typescript example.ts
function hello() { console.log("Hello"); }
\`\`\`

Done!
`);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      language: "typescript",
      filename: "example.ts",
      done: true,
    });
    expect(result.files[0]?.content).toContain("function hello()");
    expect(result.files[0]?.preamble).toContain("function");
    expect(result.postamble).toContain("Done!");
  });

  it("should extract multiple code blocks", () => {
    const result = extractCodeBlocks(`
\`\`\`js utils.js
export const add = (a, b) => a + b;
\`\`\`

\`\`\`js test.js
import { add } from './utils';
\`\`\`
`);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toMatchObject({ language: "js", filename: "utils.js" });
    expect(result.files[1]).toMatchObject({ language: "js", filename: "test.js" });
  });

  it("should handle code blocks with partial metadata", () => {
    // Language only
    const langOnly = extractCodeBlocks("```python\nprint('hi')\n```");
    expect(langOnly.files[0]).toMatchObject({ language: "python", filename: undefined });

    // No metadata
    const noMeta = extractCodeBlocks("```\nconst x = 42;\n```");
    expect(noMeta.files[0]).toMatchObject({ language: undefined, filename: undefined });
  });

  it("should handle edge cases", () => {
    // Empty source
    expect(extractCodeBlocks("").files).toHaveLength(0);

    // No code blocks
    expect(extractCodeBlocks("Just text").files).toHaveLength(0);

    // Empty code block
    const empty = extractCodeBlocks("```ts empty.ts\n```");
    expect(empty.files[0]?.content).toBe("");
    expect(empty.files[0]?.done).toBe(true);

    // Unclosed code block
    const unclosed = extractCodeBlocks("```ts unclosed.ts\nfunction test() {}\n");
    expect(unclosed.files[0]?.done).toBe(false);
  });

  it("should preserve indentation and handle complex filenames", () => {
    const result = extractCodeBlocks(`
\`\`\`typescript src/components/Button.tsx
def example():
    if True:
        print("indented")
\`\`\`
`);

    expect(result.files[0]?.filename).toBe("src/components/Button.tsx");
    expect(result.files[0]?.content).toContain("    if True:");
  });
});

describe("CODER_SYSTEM_PROMPT", () => {
  it("should contain required instructions", () => {
    expect(CODER_SYSTEM_PROMPT).toBeDefined();
    expect(CODER_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(CODER_SYSTEM_PROMPT).toContain("Output Instructions");
    expect(CODER_SYSTEM_PROMPT).toContain("markdown code block");
    expect(CODER_SYSTEM_PROMPT).toContain("filename");
    expect(CODER_SYSTEM_PROMPT).toContain("```");
  });
});
