// Render model output as Markdown in the chat surface.
//
// Delivery Policy stays raw source on purpose (PolicyView). Chat answers are different: the
// familiar product chrome expects bold, lists, and fences to read as formatting, not as
// literal punctuation. Sanitization is structural here: react-markdown builds elements, and
// rehype-sanitize drops anything outside the allowlist, so model text cannot inject script.

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

export function MarkdownBody(props: { text: string; className?: string }) {
  const { text, className } = props;
  return (
    <div className={className ? `md-body ${className}` : 'md-body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
