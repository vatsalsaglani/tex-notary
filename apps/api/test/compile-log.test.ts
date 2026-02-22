import { describe, expect, it } from "vitest";
import { parseCompileLog } from "../src/utils/compile-log";

describe("parseCompileLog", () => {
  it("parses error and warning lines with line refs", () => {
    const log = `warning: main.tex:4: Overfull \\hbox\nerror: main.tex:12: Undefined control sequence`;
    const parsed = parseCompileLog(log);

    expect(parsed.warnings[0]).toMatchObject({ line: 4 });
    expect(parsed.errors[0]).toMatchObject({ line: 12 });
  });
});
