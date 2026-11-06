import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/* A small, dependency-free markdown renderer optimised for chat streaming. */

interface Block {
  type: 'paragraph' | 'heading' | 'code' | 'list' | 'quote' | 'hr' | 'table' | 'html';
  level?: number;
  lang?: string;
  text?: string;
  items?: { text: string; ordered: boolean; index: number }[];
  rows?: string[][];
  header?: string[];
}

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = /^\s*```(\w+)?\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ?? '';
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoted.join('\n') });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? '')) {
      const split = (row: string): string[] =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim());
      const header = split(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(split(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const listMatch = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2]);
      const items: { text: string; ordered: boolean; index: number }[] = [];
      while (index < lines.length) {
        const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
        if (!item) break;
        items.push({ text: item[3], ordered: /\d/.test(item[2]), index: items.length + 1 });
        index += 1;
        // Consume indented continuation lines.
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[index])) {
          items[items.length - 1].text += `\n${lines[index].trim()}`;
          index += 1;
        }
      }
      blocks.push({ type: 'list', items, ordered });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*(```|#{1,6}\s|>|\||([-*+]|\d+[.)])\s)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s<)]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith('[')) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            {link[1]}
            <Icon name="external-link" size={10} style={{ marginLeft: 3, verticalAlign: '-1px', opacity: 0.6 }} />
          </a>,
        );
      } else nodes.push(token);
    } else {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noreferrer">
          {token}
        </a>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ code, lang }: { code: string; lang: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="n-code">
      <div className="n-code__bar">
        <span className="n-code__lang mono">{lang || 'text'}</span>
        <button
          type="button"
          className="n-code__copy"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="n-code__body mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ source, className = '' }: { source: string; className?: string }): JSX.Element {
  const blocks = useMemo(() => parse(source), [source]);
  return (
    <div className={`n-markdown ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case 'heading': {
            const Tag = (`h${Math.min(4, block.level ?? 2)}` as unknown) as 'h2';
            return (
              <Tag key={key} className={`n-md-h n-md-h${block.level}`}>
                {inline(block.text ?? '', key)}
              </Tag>
            );
          }
          case 'code':
            return <CodeBlock key={key} code={block.text ?? ''} lang={block.lang ?? ''} />;
          case 'list':
            return (
              <ul key={key} className={`n-md-list ${block.ordered ? 'is-ordered' : ''}`}>
                {block.items?.map((item, i) => (
                  <li key={i}>
                    {block.ordered ? <span className="n-md-num">{i + 1}.</span> : <span className="n-md-bullet" />}
                    <span>{inline(item.text, `${key}-${i}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'quote':
            return (
              <blockquote key={key} className="n-md-quote">
                {inline(block.text ?? '', key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="n-divider" />;
          case 'table':
            return (
              <div key={key} className="n-md-table-wrap">
                <table className="n-table">
                  <thead>
                    <tr>
                      {block.header?.map((cell, i) => (
                        <th key={i}>{inline(cell, `${key}-h${i}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows?.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{inline(cell, `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={key} className="n-md-p">
                {inline(block.text ?? '', key)}
              </p>
            );
        }
      })}
    </div>
  );
}

export const markdownHelpers = { Fragment };
