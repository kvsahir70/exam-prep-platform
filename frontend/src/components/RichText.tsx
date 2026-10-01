"use client";

import katex from "katex";
import { useMemo } from "react";

import { fileUrl, type Figure } from "@/lib/api";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderMath(src: string, display: boolean) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: "ignore" });
  } catch {
    return escape(src);
  }
}

/** Inline formatting: \$ (a literal dollar), $$math$$, $math$, **bold**, *italic*. Everything else is escaped. */
function inline(text: string) {
  const out: string[] = [];
  const re = /\\\$|\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push(escape(text.slice(last, m.index)));
    if (m[0] === "\\$") out.push("$");
    else if (m[1] !== undefined) out.push(renderMath(m[1], true));
    else if (m[2] !== undefined) out.push(renderMath(m[2], false));
    else if (m[3] !== undefined) out.push(`<strong>${escape(m[3])}</strong>`);
    else if (m[4] !== undefined) out.push(`<em>${escape(m[4])}</em>`);
    last = m.index + m[0].length;
  }
  out.push(escape(text.slice(last)));
  return out.join("");
}

function table(lines: string[]) {
  const rows = lines
    .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => inline(c.trim())),
    );
  const [head, ...body] = rows;
  return `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

/** Tiny Markdown + LaTeX renderer for extracted question text (paragraphs, tables, math, emphasis). */
export function toHtml(text: string) {
  const blocks: string[] = [];
  const lines = (text ?? "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(`<p>${para.map(inline).join("<br/>")}</p>`);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const tbl: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) tbl.push(lines[i++]);
      i--;
      blocks.push(table(tbl));
    } else if (!line.trim()) flush();
    else para.push(line);
  }
  flush();
  return blocks.join("");
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => toHtml(text), [text]);
  return <div className={`prose-q leading-relaxed ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Figures({ images }: { images: Figure[] }) {
  if (!images?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {images.map((img) => (
        <figure key={img.path} className="overflow-hidden rounded-xl border border-line bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(img.path)} alt={img.caption ?? "Figure"} className="max-h-72 w-auto" />
          {img.caption && <figcaption className="mt-1 text-center text-xs text-neutral-500">{img.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
