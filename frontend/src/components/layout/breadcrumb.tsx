import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Segment({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  if (!isLast && item.href) {
    return (
      <Link
        href={item.href}
        className="max-w-[160px] truncate rounded-[var(--radius-sm-token)] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 sm:max-w-[240px]"
      >
        {item.label}
      </Link>
    );
  }
  return (
    <span
      aria-current={isLast ? "page" : undefined}
      className="max-w-[200px] truncate font-medium text-foreground sm:max-w-[320px]"
    >
      {item.label}
    </span>
  );
}

/** Generic, route-agnostic breadcrumb -- callers supply the segment chain (project, dataset,
 * stage, visualization, ...); this component knows nothing about AiVis's page hierarchy.
 * The last item is always rendered as the current, non-interactive segment regardless of
 * whether it carries an href. Below the sm breakpoint, segments between the first and current
 * item collapse behind a static "…" so the first and current segments stay reachable without
 * JS-driven measurement. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  const lastIndex = items.length - 1;
  const middleItems = items.slice(1, lastIndex);

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 text-[13px]">
        <li className="flex items-center">
          <Segment item={items[0]} isLast={lastIndex === 0} />
        </li>

        {middleItems.length > 0 && (
          <>
            <li aria-hidden className="flex items-center gap-1.5 sm:hidden">
              <span className="text-subtle-foreground">/</span>
              <span className="text-subtle-foreground">…</span>
            </li>
            {middleItems.map((item, i) => (
              <li key={`${item.label}-${i}`} className="hidden items-center gap-1.5 sm:flex">
                <span aria-hidden className="text-subtle-foreground">
                  /
                </span>
                <Segment item={item} isLast={false} />
              </li>
            ))}
          </>
        )}

        {lastIndex > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="text-subtle-foreground">
              /
            </span>
            <Segment item={items[lastIndex]} isLast />
          </li>
        )}
      </ol>
    </nav>
  );
}
