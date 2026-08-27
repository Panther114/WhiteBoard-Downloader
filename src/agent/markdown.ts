import crypto from 'crypto';

export function stableId(prefix: string, input: string): string {
  return `${prefix}_${crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)}`;
}

export function contentHash(markdown: string): string {
  return crypto.createHash('sha256').update(markdown.replace(/\r\n/g, '\n').trim()).digest('hex');
}

/** Small, dependency-free HTML-to-Markdown normalizer for Blackboard content. */
export function htmlToMarkdown(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${decodeHtml(code).trim()}\n\`\`\`\n\n`)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${decodeHtml(code).trim()}\n\`\`\`\n\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => `\`${decodeHtml(code).trim()}\``)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n\n${'#'.repeat(Number(level))} ${decodeHtml(stripTags(text)).trim()}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${decodeHtml(stripTags(text)).trim()}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|tr|table|ul|ol)>/gi, '\n')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      const label = decodeHtml(stripTags(text)).trim() || href;
      return isSafeLink(href) ? `[${label}](${href})` : label;
    });

  out = decodeHtml(stripTags(out))
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function isSafeLink(href: string): boolean {
  try {
    const protocol = new URL(href, 'https://example.invalid').protocol;
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}
