import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"; 

export default function App() {
  const [codeInput, setCodeInput] = useState("");
  const [reviewResult, setReviewResult] = useState("");
 const [language, setLanguage] = useState("javascript");

 useEffect(() => {
  
 }, []);
  const handleCodeReview = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: codeInput,
        }),
      });

      const data = await response.json();

      setReviewResult(data.data);
    } catch (error) {
      console.error(error);

      setReviewResult("## Error\nUnable to generate review. Please try again.");
    }
  };

  return (
    <main className="h-screen bg-[#1f1f21] p-4">
      <div className="grid h-full grid-cols-2 gap-4">
        {/* Left Panel */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-700 px-4 py-3">
            <h2 className="font-semibold text-white">Code Input</h2>
          </div>

          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="javascript"
            language="javascript"
              theme="vs-dark"
              value={codeInput}
              onChange={(value) => setCodeInput(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          <button
            onClick={handleCodeReview}
            className="
              absolute
              bottom-4
              right-4
              z-10
              rounded-lg
              bg-blue-600
              px-5
              py-2
              text-white
              transition
              hover:bg-blue-700
            "
          >
            Review
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
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");

                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
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
