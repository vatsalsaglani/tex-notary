import { describe, expect, it } from "vitest";
import { parseOutlineClient } from "../src/utils/outline";

describe("parseOutlineClient", () => {
  it("extracts headings from latex content", () => {
    const content = `\\section{Intro}\n\\subsection{Details}`;
    const outline = parseOutlineClient(content);

    expect(outline).toEqual([
      { level: 1, title: "Intro", line: 1 },
      { level: 2, title: "Details", line: 2 }
    ]);
  });
});
