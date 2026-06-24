import React from "react";

// Inline formatting: **bold**, *italic* / _italic_, `code`. Renders to React
// elements (text is escaped by React, so this is XSS-safe).
export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}${i}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}${i}`}
          className="rounded bg-slate-100 px-1 text-[0.9em]"
        >
          {m[3]}
        </code>,
      );
    } else {
      nodes.push(<em key={`${keyPrefix}${i}`}>{m[4] ?? m[5]}</em>);
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Minimal markdown: headings (#, ##, ###), bullet lists (- / *), paragraphs
// with line breaks, and the inline formatting above. Intentionally does NOT
// auto-number — typed numbers (e.g. "1.") render literally.
export default function SimpleMarkdown({ text }: { text: string }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const cls =
        heading[1].length === 1
          ? "text-lg font-semibold"
          : "text-base font-semibold";
      blocks.push(
        <p key={key} className={`mt-3 first:mt-0 ${cls}`}>
          {renderInline(heading[2], `h${key}-`)}
        </p>,
      );
      key++;
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key} className="ml-5 list-disc space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `l${key}-${idx}-`)}</li>
          ))}
        </ul>,
      );
      key++;
      continue;
    }

    // paragraph: consecutive plain lines joined with line breaks
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key} className="mt-2 first:mt-0">
        {para.map((p, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(p, `p${key}-${idx}-`)}
          </React.Fragment>
        ))}
      </p>,
    );
    key++;
  }

  return <div className="text-slate-700">{blocks}</div>;
}
