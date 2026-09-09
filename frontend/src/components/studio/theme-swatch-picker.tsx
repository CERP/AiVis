"use client";

import { motion } from "framer-motion";

import type { ThemeTokens } from "@/lib/api/theme";
import { cn } from "@/lib/utils";

/** Extracted from Studio's own previous inline markup (not from the old recommendations-page
 * theme-card.tsx, whose bigger card-with-description treatment suited browsing many themes at
 * once on /recommend, not a compact inspector tab). Small circular swatches, hover previews
 * without committing, click applies -- exactly Studio's existing interaction, just reusable. */
export function ThemeSwatchPicker({
  themes,
  selected,
  onSelect,
  onHoverChange,
}: {
  themes: ThemeTokens[];
  selected?: ThemeTokens;
  onSelect: (theme: ThemeTokens) => void;
  onHoverChange: (theme: ThemeTokens | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {themes.map((theme) => (
        <motion.button
          key={theme.name}
          type="button"
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.12 }}
          onMouseEnter={() => onHoverChange(theme)}
          onMouseLeave={() => onHoverChange(undefined)}
          onFocus={() => onHoverChange(theme)}
          onBlur={() => onHoverChange(undefined)}
          onClick={() => onSelect(theme)}
          title={theme.name.replace(/_/g, " ")}
          aria-label={`Apply ${theme.name.replace(/_/g, " ")} theme`}
          aria-pressed={selected?.name === theme.name}
          className="flex h-10 w-10 items-center justify-center"
        >
          <motion.span
            whileHover={{ scale: 1.15 }}
            className={cn(
              "grid h-6 w-6 grid-cols-2 grid-rows-2 overflow-hidden rounded-full border-2",
              selected?.name === theme.name ? "border-foreground" : "border-border-strong"
            )}
          >
            {theme.categorical_colors.slice(0, 4).map((color, i) => (
              <span key={i} style={{ backgroundColor: color }} />
            ))}
          </motion.span>
        </motion.button>
      ))}
    </div>
  );
}
