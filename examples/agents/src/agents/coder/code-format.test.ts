import { describe, expect, it } from "vitest";
import { CODER_SYSTEM_PROMPT, extractCodeBlocks } from "./code-format";

describe("Coder Agent - Code Format Utilities", () => {
  describe("extractCodeBlocks", () => {
    it("should extract single code block with language and filename", () => {
      const source = `
Here's a simple function:

\`\`\`typescript example.ts
function hello() {
  console.log("Hello World");
}
\`\`\`

Done!
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.language).toBe("typescript");
      expect(result.files[0]?.filename).toBe("example.ts");
      expect(result.files[0]?.content).toContain("function hello()");
      expect(result.files[0]?.done).toBe(true);
      expect(result.postamble).toContain("Done!");
    });

    it("should extract multiple code blocks", () => {
      const source = `
First file:

\`\`\`js utils.js
export const add = (a, b) => a + b;
\`\`\`

Second file:

\`\`\`js test.js
import { add } from './utils';
console.log(add(1, 2));
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(2);
      expect(result.files[0]?.language).toBe("js");
      expect(result.files[0]?.filename).toBe("utils.js");
      expect(result.files[1]?.language).toBe("js");
      expect(result.files[1]?.filename).toBe("test.js");
    });

    it("should handle code block with language only (no filename)", () => {
      const source = `
\`\`\`python
print("Hello")
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.language).toBe("python");
      expect(result.files[0]?.filename).toBeUndefined();
      expect(result.files[0]?.content).toContain('print("Hello")');
    });

    it("should handle code block with no language or filename", () => {
      const source = `
\`\`\`
const x = 42;
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.language).toBeUndefined();
      expect(result.files[0]?.filename).toBeUndefined();
      expect(result.files[0]?.content).toContain("const x = 42");
    });

    it("should capture preamble text before code blocks", () => {
      const source = `
Here's some explanation text.
This describes what the code does.

\`\`\`ts file.ts
const code = true;
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.preamble).toContain("explanation text");
      expect(result.files[0]?.preamble).toContain("describes what the code does");
    });

    it("should capture postamble text after all code blocks", () => {
      const source = `
\`\`\`js code.js
console.log("test");
\`\`\`

This is some text after the code block.
It should be captured as postamble.
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.postamble).toContain("text after the code block");
      expect(result.postamble).toContain("captured as postamble");
    });

    it("should handle empty code blocks", () => {
      const source = `
\`\`\`ts empty.ts
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.content).toBe("");
      expect(result.files[0]?.done).toBe(true);
    });

    it("should handle nested code formatting (not nested blocks)", () => {
      const source = `
\`\`\`typescript example.ts
function example() {
  // This is a comment with backticks: \`inline code\`
  return "test";
}
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.content).toContain("inline code");
    });

    it("should handle complex filenames with paths", () => {
      const source = `
\`\`\`typescript src/components/Button.tsx
export const Button = () => <button>Click</button>;
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filename).toBe("src/components/Button.tsx");
      expect(result.files[0]?.language).toBe("typescript");
    });

    it("should preserve indentation in code content", () => {
      const source = `
\`\`\`python indent.py
def example():
    if True:
        print("indented")
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.content).toContain("    if True:");
      expect(result.files[0]?.content).toContain("        print");
    });

    it("should handle empty source string", () => {
      const result = extractCodeBlocks("");

      expect(result.files).toHaveLength(0);
      expect(result.postamble).toBe("");
    });

    it("should handle source with no code blocks", () => {
      const source = "Just some plain text with no code blocks.";

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(0);
    });

    it("should handle unclosed code block gracefully", () => {
      const source = `
\`\`\`typescript unclosed.ts
function test() {
  return true;
}
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.done).toBe(false);
      expect(result.files[0]?.content).toContain("function test()");
    });

    it("should handle multiple files with text between them", () => {
      const source = `
First, we need utilities:

\`\`\`ts utils.ts
export const util = () => {};
\`\`\`

Then, the main file:

\`\`\`ts main.ts
import { util } from './utils';
util();
\`\`\`
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(2);
      expect(result.files[0]?.preamble).toContain("need utilities");
      // Text between code blocks becomes part of postamble for the first file
      // rather than preamble for the second (based on implementation)
      expect(result.files[0]?.done).toBe(true);
      expect(result.files[1]?.done).toBe(true);
    });

    it("should handle real-world coder agent output format", () => {
      const source = `
I'll create a Fibonacci function for you:

\`\`\`typescript fibonacci.ts
/** Calculates the nth Fibonacci number using recursion */
export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

This implementation uses simple recursion. For better performance with large numbers, consider using memoization.
`;

      const result = extractCodeBlocks(source);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.language).toBe("typescript");
      expect(result.files[0]?.filename).toBe("fibonacci.ts");
      expect(result.files[0]?.content).toContain("Fibonacci number");
      expect(result.files[0]?.preamble).toContain("create a Fibonacci");
      expect(result.postamble).toContain("performance with large numbers");
    });
  });

  describe("CODER_SYSTEM_PROMPT", () => {
    it("should be defined and non-empty", () => {
      expect(CODER_SYSTEM_PROMPT).toBeDefined();
      expect(typeof CODER_SYSTEM_PROMPT).toBe("string");
      expect(CODER_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it("should contain output format instructions", () => {
      expect(CODER_SYSTEM_PROMPT).toContain("Output Instructions");
      expect(CODER_SYSTEM_PROMPT).toContain("markdown code block");
    });

    it("should specify filename requirements", () => {
      expect(CODER_SYSTEM_PROMPT).toContain("filename");
      expect(CODER_SYSTEM_PROMPT).toContain("language");
    });

    it("should include example format", () => {
      expect(CODER_SYSTEM_PROMPT).toContain("```");
    });
  });
});
