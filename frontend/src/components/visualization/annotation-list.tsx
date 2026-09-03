import { Annotation as AnnotationText, SourceNote } from "@/components/ui/typography";
import type { Annotation } from "@/lib/visualization/spec";

interface AnnotationListProps {
  annotations: Annotation[];
}

/** Renders callout/label/highlighted_region/source_note annotations as accessible HTML
 * text -- see the comment in to-vega-lite.ts for why these aren't SVG text marks. */
export function AnnotationList({ annotations }: AnnotationListProps) {
  const sourceNotes = annotations.filter((a) => a.type === "source_note");
  const others = annotations.filter((a) => a.type !== "source_note");

  if (annotations.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {others.map((a) => (
        <AnnotationText key={a.id}>{a.text}</AnnotationText>
      ))}
      {sourceNotes.map((a) => (
        <SourceNote key={a.id}>{a.text}</SourceNote>
      ))}
    </div>
  );
}
