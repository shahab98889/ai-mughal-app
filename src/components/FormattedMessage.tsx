import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface FormattedMessageProps {
  text: string;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ text }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split by fenced code blocks ```lang ... ```
  const segments = text.split(/(```[\s\S]*?```)/g);

  const renderInline = (line: string) => {
    // Handle Markdown images ![alt](url), bold **text**, and inline `code`
    const parts = line.split(/(!\[[^\]]*\]\([^)]+\)|\*\*.*?\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const [, alt, url] = imgMatch;
        return (
          <span key={i} className="block my-3">
            <img
              src={url}
              alt={alt || 'Generated image'}
              referrerPolicy="no-referrer"
              className="rounded-2xl border border-slate-700/80 max-w-full sm:max-w-md max-h-96 object-cover shadow-lg"
            />
          </span>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="font-mono text-[13px] bg-slate-800/90 text-emerald-300 px-1.5 py-0.5 rounded border border-slate-700/70"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-slate-200 max-w-[72ch]">
      {segments.map((segment, idx) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const lines = segment.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim() || '';
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={idx}
              className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#070A10]"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400 font-mono">
                <span>{lang}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeBody, idx)}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors min-h-[28px] px-2 rounded hover:bg-slate-800"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-slate-200">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = segment.split('\n\n');
        return (
          <React.Fragment key={idx}>
            {paragraphs.map((para, pIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              const lines = trimmed.split('\n');
              const isBulletList = lines.every((l) => /^(\*|-|•|\d+\.)\s+/.test(l.trim()));

              if (isBulletList) {
                return (
                  <ul key={pIdx} className="space-y-1.5 pl-5 list-disc marker:text-emerald-400">
                    {lines.map((item, lIdx) => (
                      <li key={lIdx} className="text-slate-200 leading-relaxed">
                        {renderInline(item.trim().replace(/^(\*|-|•|\d+\.)\s+/, ''))}
                      </li>
                    ))}
                  </ul>
                );
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={pIdx} className="font-display text-base font-semibold text-white pt-2">
                    {renderInline(trimmed.replace(/^###\s+/, ''))}
                  </h4>
                );
              }

              if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                return (
                  <h3 key={pIdx} className="font-display text-lg font-semibold text-white pt-2">
                    {renderInline(trimmed.replace(/^#+\s+/, ''))}
                  </h3>
                );
              }

              return (
                <p key={pIdx} className="whitespace-pre-wrap leading-relaxed">
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
