import type { OutlineItem } from "@overleaf-lite/shared";

const levels: Record<string, number> = {
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 5
};

export function parseOutlineClient(content: string): OutlineItem[] {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^\s*\\(chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}/);
      if (!match) {
        return null;
      }

      return {
        level: levels[match[1]] ?? 1,
        title: match[2].trim(),
        line: index + 1
      } satisfies OutlineItem;
    })
    .filter((item): item is OutlineItem => item !== null);
}
