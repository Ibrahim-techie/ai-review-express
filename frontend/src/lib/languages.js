// Languages offered in the picker. `id` is Monaco's language id, which is
// also what the API receives. An empty id lets the reviewer detect it.
export const LANGUAGES = [
  { id: "", label: "Auto-detect" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "shell", label: "Shell" },
  { id: "yaml", label: "YAML" },
  { id: "json", label: "JSON" },
];

const EXTENSIONS = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", mts: "typescript", tsx: "typescript",
  py: "python", java: "java",
  cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", h: "c", c: "c",
  cs: "csharp", go: "go", rs: "rust", php: "php", rb: "ruby",
  kt: "kotlin", kts: "kotlin", swift: "swift", sql: "sql",
  html: "html", htm: "html", css: "css", scss: "css",
  sh: "shell", bash: "shell", zsh: "shell", yml: "yaml", yaml: "yaml", json: "json",
};

export const languageFromFilename = (name) =>
  EXTENSIONS[name.split(".").pop()?.toLowerCase() ?? ""] ?? "";

// Model output says "c++" or "c#"; Monaco wants "cpp" or "csharp".
const ALIASES = { "c++": "cpp", "c#": "csharp", bash: "shell", sh: "shell", golang: "go", js: "javascript", ts: "typescript", py: "python" };

export function monacoLanguage(name) {
  const id = (ALIASES[name?.toLowerCase()] ?? name?.toLowerCase() ?? "").trim();
  return LANGUAGES.some((l) => l.id === id && id) ? id : "plaintext";
}
