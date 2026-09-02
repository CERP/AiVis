import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TypographyProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

export function Headline({ children, className, as: Comp = "h1" }: TypographyProps) {
  return (
    <Comp
      className={cn(
        "font-headline text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function Subtitle({ children, className, as: Comp = "p" }: TypographyProps) {
  return (
    <Comp
      className={cn(
        "font-body text-[clamp(1.05rem,1.5vw,1.375rem)] leading-relaxed text-muted-foreground",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionHeading({ children, className, as: Comp = "h2" }: TypographyProps) {
  return (
    <Comp
      className={cn(
        "font-headline text-2xl md:text-3xl leading-tight tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function Annotation({ children, className, as: Comp = "p" }: TypographyProps) {
  return (
    <Comp className={cn("font-body text-sm leading-snug text-accent font-medium", className)}>
      {children}
    </Comp>
  );
}

export function ChartLabel({ children, className, as: Comp = "span" }: TypographyProps) {
  return (
    <Comp className={cn("font-body text-xs font-medium text-foreground", className)}>
      {children}
    </Comp>
  );
}

export function AxisLabel({ children, className, as: Comp = "span" }: TypographyProps) {
  return (
    <Comp className={cn("font-body text-[11px] text-muted-foreground", className)}>
      {children}
    </Comp>
  );
}

export function SourceNote({ children, className, as: Comp = "p" }: TypographyProps) {
  return (
    <Comp className={cn("font-body text-xs text-muted-foreground border-t border-border pt-2", className)}>
      {children}
    </Comp>
  );
}

export function Footnote({ children, className, as: Comp = "p" }: TypographyProps) {
  return (
    <Comp className={cn("font-body text-[11px] text-muted-foreground/80", className)}>
      {children}
    </Comp>
  );
}
