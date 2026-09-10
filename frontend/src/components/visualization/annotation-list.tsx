import { Annotation as AnnotationText, SourceNote } from "@/components/ui/typography";
import type { Annotation } from "@/lib/visualization/spec";

interface AnnotationListProps {
  annotations: Annotation[];
}

function describe(annotation: Annotation): string {
  if (annotation.target_field == null || annotation.target_value == null) return annotation.text;
  return `${annotation.text} (${annotation.target_field} = ${annotation.target_value})`;
}

/** The accessible supplement for every annotation, whether or not it also renders on canvas --
 * a sighted user sees the rule/marker/text mark, a screen-reader user gets the same information
 * here instead. Anchor info (field = value) is appended so this list never disagrees with what
 * a sighted user sees drawn on the chart. */
export function AnnotationList({ annotations }: AnnotationListProps) {
  const sourceNotes = annotations.filter((a) => a.type === "source_note");
  const others = annotations.filter((a) => a.type !== "source_note");

  if (annotations.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {others.map((a) => (
        <AnnotationText key={a.id}>{describe(a)}</AnnotationText>
      ))}
      {sourceNotes.map((a) => (
        <SourceNote key={a.id}>{a.text}</SourceNote>
      ))}
    </div>
  );
}
