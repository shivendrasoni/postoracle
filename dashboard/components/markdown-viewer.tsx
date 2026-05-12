import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  const processed = content.replace(/\[\[([^\]]+)\]\]/g, "[$1](#$1)");

  return (
    <div className="prose prose-invert max-w-none prose-headings:text-content prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-sub prose-p:leading-relaxed prose-strong:text-content prose-td:text-sub prose-th:text-content prose-code:text-accent prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-hr:border-white/[0.06] prose-pre:bg-white/[0.03] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl prose-li:text-sub">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{processed}</ReactMarkdown>
    </div>
  );
}
