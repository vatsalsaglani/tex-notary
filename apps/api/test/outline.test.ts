import { describe, expect, it } from "vitest";
import { parseOutline } from "../src/utils/outline";

describe("parseOutline", () => {
  it("extracts section hierarchy and line numbers", () => {
    const content = `\\section{Intro}\nbody\n\\subsection{Scope}\n\\subsubsection{Deep}`;
    const items = parseOutline(content);

    expect(items).toEqual([
      { level: 1, title: "Intro", line: 1 },
      { level: 2, title: "Scope", line: 3 },
      { level: 3, title: "Deep", line: 4 }
    ]);
  });
});
