import { Children, isValidElement, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { monacoLanguage } from "@/lib/languages";

/**
 * Code in findings is coloured by Monaco's own tokenizer, so snippets match
 * the editor exactly (the old UI mixed Prism's oneDark with vs-dark). Monaco
 * escapes the text it colours; plain text shows until it has loaded.
 */
function CodeBlock({ code, lang }) {
  const [html, setHtml] = useState(null);

  useEffect(() => {
    let live = true;
    import("@/lib/monaco")
      .then(({ monaco }) => monaco.editor.colorize(code, monacoLanguage(lang), { tabSize: 2 }))
      .then((out) => live && setHtml(out))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, lang]);

  return (
    <pre className="md-pre">
      {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
    </pre>
  );
}

const components = {
  pre({ children }) {
    const child = Children.toArray(children)[0];
    if (!isValidElement(child)) return <pre className="md-pre">{children}</pre>;
    const lang = /language-([\w#+-]+)/.exec(child.props.className ?? "")?.[1];
    return <CodeBlock code={String(child.props.children ?? "").replace(/\n$/, "")} lang={lang} />;
  },
  // eslint-disable-next-line no-unused-vars
  code({ node, className, ...props }) {
    return <code className="md-code" {...props} />;
  },
  // eslint-disable-next-line no-unused-vars
  a({ node, ...props }) {
    return <a {...props} target="_blank" rel="noreferrer noopener" />;
  },
};

export function Markdown({ children, className }) {
  return (
    <div className={`md ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
