import type { OutlineItem } from "@overleaf-lite/shared";

const sectionLevels: Record<string, number> = {
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 5
};

const sectionRegex = /^\s*\\(chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}/;

export function parseOutline(content: string): OutlineItem[] {
  const lines = content.split(/\r?\n/);
  const items: OutlineItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(sectionRegex);
    if (!match) {
      continue;
    }

    const [, command, title] = match;
    items.push({
      level: sectionLevels[command] ?? 1,
      title: title.trim(),
      line: index + 1
    });
  }

  return items;
}
