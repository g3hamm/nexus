import type { InlineSpan, LessonBlock } from "@nexus/academy";

/**
 * Renders a parsed lesson.
 *
 * The parser hands over plain data rather than HTML, so this is ordinary JSX
 * and there is no `dangerouslySetInnerHTML` anywhere in the Academy. A lesson
 * written by an apologetics lead cannot inject markup into a volunteer's page,
 * however the file reaches the repository.
 */
function Spans({ spans }: { readonly spans: readonly InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.bold) {
          return (
            <strong key={i} className="text-ink font-semibold">
              {span.text}
            </strong>
          );
        }
        if (span.italic) return <em key={i}>{span.text}</em>;
        return <span key={i}>{span.text}</span>;
      })}
    </>
  );
}

export function LessonProse({ blocks }: { readonly blocks: readonly LessonBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={i} className="text-ink pt-3 font-serif text-xl">
                <Spans spans={block.spans} />
              </h2>
            ) : (
              <h3 key={i} className="text-ink pt-2 font-serif text-lg">
                <Spans spans={block.spans} />
              </h3>
            );

          case "list":
            return (
              <ul key={i} className="text-ink-muted space-y-2 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="text-ink-subtle select-none">—</span>
                    <span>
                      <Spans spans={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <blockquote
                key={i}
                className="text-ink border-line-strong border-l-2 pl-4 font-serif italic leading-relaxed"
              >
                <Spans spans={block.spans} />
              </blockquote>
            );

          default:
            return (
              <p key={i} className="text-ink-muted leading-relaxed">
                <Spans spans={block.spans} />
              </p>
            );
        }
      })}
    </div>
  );
}
