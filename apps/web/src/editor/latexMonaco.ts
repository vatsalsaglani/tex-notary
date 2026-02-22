import type * as Monaco from "monaco-editor";

export const LATEX_LANGUAGE_ID = "latex";
export const LATEX_MONACO_THEME_DARK = "atelier-latex-dark";
export const LATEX_MONACO_THEME_LIGHT = "atelier-latex-light";

let languageConfigured = false;

interface LatexSnippet {
  label: string;
  insertText: string;
  detail: string;
}

const latexSnippets: LatexSnippet[] = [
  {
    label: "section",
    insertText: "\\section{${1:Section title}}\\n${0}",
    detail: "Insert section heading"
  },
  {
    label: "subsection",
    insertText: "\\subsection{${1:Subsection title}}\\n${0}",
    detail: "Insert subsection heading"
  },
  {
    label: "begin-end",
    insertText: "\\begin{${1:environment}}\\n  ${0}\\n\\end{${1:environment}}",
    detail: "Insert environment block"
  },
  {
    label: "itemize",
    insertText: "\\begin{itemize}\\n  \\item ${1:item}\\n\\end{itemize}",
    detail: "Insert itemize list"
  },
  {
    label: "enumerate",
    insertText: "\\begin{enumerate}\\n  \\item ${1:item}\\n\\end{enumerate}",
    detail: "Insert enumerate list"
  },
  {
    label: "equation",
    insertText: "\\begin{equation}\\n  ${1:E = mc^2}\\n\\end{equation}",
    detail: "Insert equation block"
  },
  {
    label: "align",
    insertText: "\\begin{align}\\n  ${1:a} &= ${2:b} \\\\n\\end{align}",
    detail: "Insert align block"
  },
  {
    label: "figure",
    insertText:
      "\\begin{figure}[htbp]\\n  \\centering\\n  \\caption{${1:Caption}}\\n  \\label{fig:${2:label}}\\n\\end{figure}",
    detail: "Insert figure scaffold"
  }
];

export function configureLatexMonaco(monaco: typeof Monaco) {
  if (languageConfigured) {
    return;
  }

  if (!monaco.languages.getLanguages().some((language) => language.id === LATEX_LANGUAGE_ID)) {
    monaco.languages.register({ id: LATEX_LANGUAGE_ID });
  }

  monaco.languages.setLanguageConfiguration(LATEX_LANGUAGE_ID, {
    comments: { lineComment: "%" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"]
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
      { open: "\"", close: "\"" }
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
      { open: "\"", close: "\"" }
    ]
  });

  monaco.languages.setMonarchTokensProvider(LATEX_LANGUAGE_ID, {
    defaultToken: "",
    tokenPostfix: ".tex",
    brackets: [
      { token: "delimiter.curly", open: "{", close: "}" },
      { token: "delimiter.bracket", open: "[", close: "]" },
      { token: "delimiter.parenthesis", open: "(", close: ")" }
    ],
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/\\(?:begin|end)\{[a-zA-Z*]+\}/, "keyword.environment"],
        [/\\[a-zA-Z@]+\*?/, "keyword.control"],
        [/\\./, "keyword.control"],
        [/\$\$?/, "delimiter.math"],
        [/([{}[\]()])/, "@brackets"],
        [/[&#_^~]/, "operator"],
        [/\d+(?:\.\d+)?/, "number"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        [/[^\\%${}#[\]()&_~^\d"]+/, "text"]
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"]
      ]
    }
  });

  monaco.editor.defineTheme(LATEX_MONACO_THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7F7262", fontStyle: "italic" },
      { token: "keyword.control", foreground: "7CD8BE" },
      { token: "keyword.environment", foreground: "96E0CC", fontStyle: "bold" },
      { token: "delimiter.math", foreground: "E5B676" },
      { token: "delimiter.curly", foreground: "C8B39A" },
      { token: "delimiter.bracket", foreground: "C8B39A" },
      { token: "delimiter.parenthesis", foreground: "C8B39A" },
      { token: "operator", foreground: "D8A566" },
      { token: "number", foreground: "C89972" },
      { token: "string", foreground: "DBB98D" },
      { token: "string.escape", foreground: "F6D7AA" }
    ],
    colors: {
      "editor.background": "#1E140F",
      "editor.foreground": "#E9DFD0",
      "editorLineNumber.foreground": "#6E6357",
      "editorLineNumber.activeForeground": "#BDAE9A",
      "editorCursor.foreground": "#7CD8BE",
      "editor.selectionBackground": "#315046AA",
      "editor.lineHighlightBackground": "#2A1E17",
      "editorIndentGuide.background1": "#3A2C24",
      "editorIndentGuide.activeBackground1": "#6D594A"
    }
  });

  monaco.editor.defineTheme(LATEX_MONACO_THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9B8B79", fontStyle: "italic" },
      { token: "keyword.control", foreground: "107C67" },
      { token: "keyword.environment", foreground: "0E6A58", fontStyle: "bold" },
      { token: "delimiter.math", foreground: "B8742F" },
      { token: "delimiter.curly", foreground: "8D6D52" },
      { token: "delimiter.bracket", foreground: "8D6D52" },
      { token: "delimiter.parenthesis", foreground: "8D6D52" },
      { token: "operator", foreground: "A8622B" },
      { token: "number", foreground: "A15A39" },
      { token: "string", foreground: "8E5D2E" },
      { token: "string.escape", foreground: "6B3E16" }
    ],
    colors: {
      "editor.background": "#F7F2EA",
      "editor.foreground": "#2E2116",
      "editorLineNumber.foreground": "#B8A996",
      "editorLineNumber.activeForeground": "#6F5945",
      "editorCursor.foreground": "#107C67",
      "editor.selectionBackground": "#95D8C04D",
      "editor.lineHighlightBackground": "#EFE5D8",
      "editorIndentGuide.background1": "#D7C7B4",
      "editorIndentGuide.activeBackground1": "#AA9279"
    }
  });

  monaco.languages.registerCompletionItemProvider(LATEX_LANGUAGE_ID, {
    triggerCharacters: ["\\"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      return {
        suggestions: latexSnippets.map((snippet) => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: snippet.detail,
          documentation: snippet.detail,
          range
        }))
      };
    }
  });

  languageConfigured = true;
}
