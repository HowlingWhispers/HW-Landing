import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodaMessageContent, safeMarkdownUrl } from './CodaMessageContent';

const render = (content: string) => renderToStaticMarkup(<CodaMessageContent content={content}/>);

describe('CodaMessageContent', () => {
  it('renders readable Markdown and preserves separate paragraphs', () => {
    const html = render('# Heading\n\n**bold** and *soft*\n\n- one\n- two\n\n> quote\n\n```js\nconst safe = true;\n```');
    expect(html).toContain('<h1>Heading</h1>'); expect(html).toContain('<strong>bold</strong>'); expect(html).toContain('<em>soft</em>');
    expect(html.match(/<p>/g)?.length).toBeGreaterThanOrEqual(2); expect(html).toContain('<ul>'); expect(html).toContain('<blockquote>'); expect(html).toContain('<pre><code class="language-js">');
  });

  it('maps only approved semantic tones to fixed classes', () => {
    for (const tone of ['canon','warning','conflict','speaker','note','muted']) expect(render(`:color[text]{tone=${tone}}`)).toContain(`coda-tone-${tone}`);
    const hostile = render(':color[text]{tone="red; background:url(https://evil.invalid)" style="position:fixed"}');
    expect(hostile).not.toContain('style='); expect(hostile).not.toContain('evil.invalid'); expect(hostile).not.toContain('coda-tone-red'); expect(hostile).toContain('text');
  });

  it('drops raw HTML and remote Markdown images', () => {
    const html = render('<script>alert(1)</script><img src=x onerror=alert(1)> ![track](https://evil.invalid/pixel.png)');
    expect(html).not.toContain('<script'); expect(html).not.toContain('<img'); expect(html).not.toContain('evil.invalid');
  });

  it('allows only safe link protocols', () => {
    expect(safeMarkdownUrl('https://example.com')).toBe('https://example.com'); expect(safeMarkdownUrl('/coda')).toBe('/coda'); expect(safeMarkdownUrl('#note')).toBe('#note');
    expect(safeMarkdownUrl('javascript:alert(1)')).toBe(''); expect(safeMarkdownUrl('data:text/html,x')).toBe(''); expect(safeMarkdownUrl('//evil.invalid')).toBe('');
    const html = render('[safe](https://example.com) [bad](javascript:alert(1))');
    expect(html).toContain('noopener noreferrer nofollow'); expect(html).not.toContain('javascript:'); expect(html).toContain('<span>bad</span>');
  });

  it('keeps directive-looking content inside code literal', () => {
    const html = render('`:color[not styled]{tone=warning}`');
    expect(html).toContain('<code>:color[not styled]{tone=warning}</code>'); expect(html).not.toContain('coda-tone-warning');
  });
});
