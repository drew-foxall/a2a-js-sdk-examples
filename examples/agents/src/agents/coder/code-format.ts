/**
 * Code format utilities - Matches original implementation
 * Parses markdown code blocks with ```language filename format
 */

export interface CodeFile {
  preamble?: string;
  filename?: string;
  language?: string;
  content: string;
  done: boolean;
}

export interface CodeMessageData {
  files: CodeFile[];
  postamble?: string;
}

/**
 * Extract code blocks from markdown text
 * Format: ```language filename
 */
export function extractCodeBlocks(source: string): CodeMessageData {
  const files: CodeFile[] = [];
  let currentPreamble = "";
  let postamble = "";

  const lines = source.split("\n");
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (!inCodeBlock) {
        // Starting a new code block
        inCodeBlock = true;
        // Extract language and filename
        const parts = trimmedLine.substring(3).trim().split(/\s+/);
        const language = parts[0] || undefined;
        const filename = parts[1] || undefined;

        // Start a new file entry
        files.push({
          preamble: currentPreamble.trim(),
          filename,
          language,
          content: "",
          done: false,
        });
        currentPreamble = "";
      } else {
        // Ending a code block
        inCodeBlock = false;
        // Mark the current file as done
        if (files.length > 0) {
          files[files.length - 1].done = true;
        }
      }
      continue;
    }

    if (inCodeBlock) {
      // Add to the current file's content
      if (files.length > 0) {
        files[files.length - 1].content += `${line}\n`;
      }
    } else {
      // If we're past all code blocks and have content, this is postamble
      if (files.length > 0 && files[files.length - 1].done) {
        postamble += `${line}\n`;
      } else {
        // Otherwise this is preamble for the next file
        currentPreamble += `${line}\n`;
      }
    }
  }

  return {
    files,
    postamble: postamble.trim(),
  };
}

/**
 * System prompt for code generation (matches original output instructions)
 */
export const CODER_SYSTEM_PROMPT = `You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.

=== Output Instructions

Output code in a markdown code block using the following format:

\`\`\`ts file.ts
// code goes here
\`\`\`

- Always include the filename on the same line as the opening code ticks.
- Always include both language and path.
- Do not include additional information other than the code unless explicitly requested.
- Ensure that you always include both the language and the file path.
- If you need to output multiple files, make sure each is in its own code block separated by two newlines.
- If you aren't working with a specific directory structure or existing file, use a descriptive filename like 'fibonacci.ts'

When generating code, always include a brief comment (using whatever comment syntax is appropriate for the language) at the top that provides a short summary of what the file's purpose is, for example:

\`\`\`ts src/components/habit-form.tsx
/** HabitForm is a form for creating and editing habits to track. */
"use client";
// ... rest of code generated below
\`\`\``;
