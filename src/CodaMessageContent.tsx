import ReactMarkdown, { type Components } from 'react-markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

const tones = new Set(['canon', 'warning', 'conflict', 'speaker', 'note', 'muted']);
const allowedElements = ['p', 'br', 'em', 'strong', 'del', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'span', 'hr'];

function remarkCodaTone() {
  return (tree: unknown) => {
    visit(tree as Parameters<typeof visit>[0], 'textDirective', (node: { name: string; attributes?: Record<string,string>; data?: Record<string,unknown> }) => {
      if (node.name !== 'color') return;
      const tone = String(node.attributes?.tone || '');
      node.data = { ...(node.data || {}), hName: 'span', hProperties: tones.has(tone) ? { className: `coda-tone coda-tone-${tone}` } : {} };
    });
  };
}

export function safeMarkdownUrl(url: string) {
  if (/^(https?:|mailto:)/i.test(url) || /^(?:\/|#)(?!\/)/.test(url)) return url;
  return '';
}

const components: Components = {
  a: ({ href = '', children, ...props }) => {
    const safe = safeMarkdownUrl(href);
    return safe
      ? <a {...props} href={safe} target={/^https?:/i.test(safe) ? '_blank' : undefined} rel={/^https?:/i.test(safe) ? 'noopener noreferrer nofollow' : undefined}>{children}</a>
      : <span>{children}</span>;
  },
  img: () => null,
};

export function CodaMessageContent({ content }: { content: string }) {
  return <div className="coda-message-content"><ReactMarkdown remarkPlugins={[remarkGfm, remarkDirective, remarkCodaTone]} skipHtml allowedElements={allowedElements} unwrapDisallowed components={components}>{content}</ReactMarkdown></div>;
}
