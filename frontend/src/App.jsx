import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
export default function App() {
  const [codeInput, setCodeInput] = useState("");
  const [reviewResult, setReviewResult] = useState("");

  const handleCodeInputChange = async () => {
    console.log("Code Input:", codeInput);

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
    setCodeInput(""); // Clear the input field after submission
  };

  return (
    <main className="h-screen bg-[#1f1f21] p-4">
      <div className="grid h-full grid-cols-2 gap-4">
        {/* Code Editor */}
        <div className="relative flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-auto">
          <div className="border-b border-zinc-700 px-4 py-3">
            <h2 className="text-white font-semibold">Code Input</h2>
          </div>

          <textarea
            placeholder="Paste your code here..."
            className="flex-1 resize-none bg-transparent p-4 text-white outline-none placeholder:text-zinc-500 font-mono"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
          />

          <button
            className="absolute bottom-4 right-4 rounded-lg bg-blue-600 px-5 py-2 text-white font-medium transition hover:bg-blue-700"
            onClick={handleCodeInputChange}
          >
            Review
          </button>
        </div>

        {/* Review Panel */}
        <div className="flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-auto">
          <div className="border-b border-zinc-700 px-4 py-3">
            <h2 className="text-white font-semibold">AI Review</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-zinc-300">
            {reviewResult? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {reviewResult}
              </ReactMarkdown>
            ) : (
              <p className="text-zinc-500">Review results will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
