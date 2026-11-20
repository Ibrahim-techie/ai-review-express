import { useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function App() {
  const [codeInput, setCodeInput] = useState("");
  const [reviewResult, setReviewResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [language, setLanguage] = useState("javascript");
  const [customLanguage, setCustomLanguage] = useState("");

  const selectedLanguage =
    language === "other" ? customLanguage.trim() || "plaintext" : language;

  const editorOptions = {
    minimap: {
      enabled: false,
    },
    fontSize: 14,
    wordWrap: "on",
    automaticLayout: true,
    scrollBeyondLastLine: false,
  };

  const handleCodeReview = async () => {
    if (!codeInput.trim()) return;

    try {
      setLoading(true);

      const response = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: codeInput,
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to review code");
      }

      const data = await response.json();

      setReviewResult(data.data);
    } catch (error) {
      console.error(error);

      setReviewResult(
        "## Error\n\nUnable to generate review. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const markdownComponents = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");

      return match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      ) : (
        <code
          className="rounded bg-zinc-800 px-1 py-0.5 text-pink-400"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <main className="h-screen bg-[#1f1f21] p-4">
      <div className="grid h-full grid-cols-2 gap-4">
        {/* Left Panel */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
            <h2 className="font-semibold text-white">Code Input</h2>

            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded bg-zinc-800 px-2 py-1 text-white outline-none"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="other">Other</option>
              </select>

              {language === "other" && (
                <input
                  type="text"
                  placeholder="Language..."
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  className="rounded bg-zinc-800 px-3 py-1 text-white outline-none"
                />
              )}
            </div>
          </div>

          <div className="flex-1">
            <Editor
              height="100%"
              language={selectedLanguage}
              theme="vs-dark"
              value={codeInput}
              onChange={(value) => setCodeInput(value || "")}
              options={editorOptions}
            />
          </div>

          <button
            onClick={handleCodeReview}
            disabled={loading || !codeInput.trim()}
            className="
              absolute
              bottom-4
              right-4
              z-10
              rounded-lg
              px-5
              py-2
              text-white
              transition
              bg-blue-600
              hover:bg-blue-700
              disabled:bg-zinc-700
              disabled:cursor-not-allowed
            "
          >
            {loading ? "Reviewing..." : "Review"}
          </button>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-700 px-4 py-3">
            <h2 className="font-semibold text-white">AI Review</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-zinc-300">
            {reviewResult ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={markdownComponents}
              >
                {reviewResult}
              </ReactMarkdown>
            ) : (
              <p className="text-zinc-500">
                Review results will appear here...
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
