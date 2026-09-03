"use client";

import { geoNaturalEarth1, geoPath, geoGraticule10, geoInterpolate } from "d3-geo";
import { scaleSequential } from "d3-scale";
import { useEffect, useMemo, useState } from "react";

import type { ThemeTokens } from "@/lib/api/theme";
import { sumByCategory } from "@/lib/visualization/d3-data";
import { useChartSize } from "./use-chart-size";

/** GeoJSON feature collection shape, narrowed to what these charts read. */
interface CountryFeature {
  type: "Feature";
  properties: { name: string };
  geometry: unknown;
}

let cachedCountries: CountryFeature[] | null = null;

/**
 * Loads real country boundaries from `world-atlas` (Natural Earth 110m) and converts the
 * TopoJSON to GeoJSON. Dynamically imported so ~100KB of boundary data stays out of the main
 * bundle and only loads when a map is actually rendered. Cached across mounts.
 */
async function loadCountries(): Promise<CountryFeature[]> {
  if (cachedCountries) return cachedCountries;
  const [{ feature }, topology] = await Promise.all([
    import("topojson-client"),
    import("world-atlas/countries-110m.json"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topo = (topology as any).default ?? topology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collection = feature(topo, topo.objects.countries) as any;
  cachedCountries = collection.features as CountryFeature[];
  return cachedCountries;
}

function useCountries() {
  const [countries, setCountries] = useState<CountryFeature[] | null>(cachedCountries);
  useEffect(() => {
    let cancelled = false;
    if (!cachedCountries) {
      loadCountries().then((c) => {
        if (!cancelled) setCountries(c);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return countries;
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-[var(--radius-token)] border border-border bg-surface p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Normalises a region label for matching against Natural Earth country names -- handles the
 * common alias cases explicitly rather than silently dropping unmatched rows. */
const NAME_ALIASES: Record<string, string> = {
  "united states": "United States of America",
  usa: "United States of America",
  us: "United States of America",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  russia: "Russia",
  "south korea": "South Korea",
  "north korea": "North Korea",
  "czech republic": "Czechia",
  "ivory coast": "Côte d'Ivoire",
};

function canonicalCountryName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return NAME_ALIASES[key] ?? raw.trim();
}

/**
 * Choropleth over real Natural Earth country polygons with a sequential colour scale.
 * Regions present in the dataset are filled by value; regions with no data render in a distinct
 * "no data" grey rather than the scale's zero colour, so absent and zero are visually different.
 * Unmatched dataset regions are reported explicitly instead of being silently discarded.
 */
export function ChoroplethChart({
  rows,
  regionField,
  valueField,
  theme,
  title,
}: {
  rows: Record<string, unknown>[];
  regionField: string;
  valueField: string;
  theme?: ThemeTokens;
  title?: string | null;
}) {
  const { ref, width } = useChartSize(380);
  const height = Math.max(220, width * 0.5);
  const countries = useCountries();

  const { valueByCountry, unmatched, domain } = useMemo(() => {
    const totals = sumByCategory(rows, regionField, valueField);
    const map = new Map(totals.map((t) => [canonicalCountryName(t.key), t.value]));
    const known = new Set((countries ?? []).map((c) => c.properties.name));
    const missing = countries ? [...map.keys()].filter((k) => !known.has(k)) : [];
    const values = [...map.values()];
    return {
      valueByCountry: map,
      unmatched: missing,
      domain: [Math.min(0, ...values), Math.max(...values, 1)] as [number, number],
    };
  }, [rows, regionField, valueField, countries]);

  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width || 1, height], { type: "Sphere" }),
    [width, height]
  );
  const pathGenerator = useMemo(() => geoPath(projection), [projection]);
  const colorScale = useMemo(() => {
    const [lo, hi] = theme?.sequential_range ?? ["#f7f7f7", "#08306b"];
    return scaleSequential<string>((t) => interpolateHex(lo, hi, t)).domain(domain);
  }, [domain, theme]);

  if (!countries) {
    return <EmptyNotice message="Loading map boundaries…" />;
  }

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <svg width={width} height={height} role="img" aria-label={`${title ?? "Choropleth map"}: ${valueByCountry.size} regions with values, shaded from ${domain[0].toLocaleString()} to ${domain[1].toLocaleString()}`}>
        <path d={pathGenerator(geoGraticule10()) ?? undefined} fill="none" stroke={theme?.grid ?? "#eee"} strokeWidth={0.5} />
        {countries.map((country) => {
          const value = valueByCountry.get(country.properties.name);
          return (
            <path
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              d={pathGenerator(country as any) ?? undefined}
              key={country.properties.name}
              fill={value === undefined ? "#efece6" : colorScale(value)}
              stroke="#fff"
              strokeWidth={0.4}
            >
              <title>
                {`${country.properties.name}: ${value === undefined ? "no data" : value.toLocaleString()}`}
              </title>
            </path>
          );
        })}
      </svg>
      {unmatched.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {unmatched.length} region{unmatched.length === 1 ? "" : "s"} in the data could not be matched to a
          country boundary: {unmatched.slice(0, 5).join(", ")}
          {unmatched.length > 5 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

/** Linear interpolation between two hex colours -- avoids pulling in a full colour-space library
 * for what is a two-stop sequential ramp. */
function interpolateHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const clamped = Math.min(1, Math.max(0, t));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clamped);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

/**
 * Bubble map: proportional circles at projected latitude/longitude. Radius is
 * sqrt(value/max) so *area* encodes magnitude (a radius-proportional bubble would exaggerate
 * large values quadratically). Uses the same Natural Earth basemap as the choropleth so the two
 * are visually comparable.
 */
export function BubbleMapChart({
  rows,
  latField,
  lonField,
  sizeField,
  theme,
  title,
}: {
  rows: Record<string, unknown>[];
  latField: string;
  lonField: string;
  sizeField: string;
  theme?: ThemeTokens;
  title?: string | null;
}) {
  const { ref, width } = useChartSize(380);
  const height = Math.max(220, width * 0.5);
  const countries = useCountries();

  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width || 1, height], { type: "Sphere" }),
    [width, height]
  );
  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const points = useMemo(() => {
    const valid = rows
      .map((r) => ({
        lat: Number(r[latField]),
        lon: Number(r[lonField]),
        value: Number(r[sizeField]),
      }))
      // Reject impossible coordinates rather than projecting them to a wrong place.
      .filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lon) &&
          Math.abs(p.lat) <= 90 &&
          Math.abs(p.lon) <= 180 &&
          Number.isFinite(p.value)
      );
    const max = Math.max(...valid.map((p) => p.value), Number.EPSILON);
    return valid.map((p) => ({ ...p, projected: projection([p.lon, p.lat]), max }));
  }, [rows, latField, lonField, sizeField, projection]);

  const invalidCount = rows.length - points.length;

  if (!countries) return <EmptyNotice message="Loading map boundaries…" />;

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <svg width={width} height={height} role="img" aria-label={`${title ?? "Bubble map"}: ${points.length} located points`}>
        {countries.map((c) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <path key={c.properties.name} d={pathGenerator(c as any) ?? undefined} fill="#efece6" stroke="#fff" strokeWidth={0.4} />
        ))}
        {points.map((p, i) =>
          p.projected ? (
            <circle
              key={i}
              cx={p.projected[0]}
              cy={p.projected[1]}
              r={3 + Math.sqrt(p.value / p.max) * 16}
              fill={theme?.categorical_colors?.[0] ?? "#4c78a8"}
              fillOpacity={0.65}
              stroke="#fff"
            >
              <title>{`${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}: ${p.value.toLocaleString()}`}</title>
            </circle>
          ) : null
        )}
      </svg>
      {invalidCount > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {invalidCount} row{invalidCount === 1 ? "" : "s"} skipped (missing or out-of-range coordinates).
        </p>
      )}
    </div>
  );
}

/**
 * Flow map: weighted origin→destination arcs. Paths follow true great circles via
 * `geoInterpolate` sampled along the route, so a flow between distant points curves the way it
 * actually does on a globe rather than as a straight screen-space line. Stroke width is
 * proportional to flow magnitude.
 */
export function FlowMapChart({
  rows,
  originLatField,
  originLonField,
  destLatField,
  destLonField,
  valueField,
  theme,
  title,
}: {
  rows: Record<string, unknown>[];
  originLatField: string;
  originLonField: string;
  destLatField: string;
  destLonField: string;
  valueField: string;
  theme?: ThemeTokens;
  title?: string | null;
}) {
  const { ref, width } = useChartSize(380);
  const height = Math.max(220, width * 0.5);
  const countries = useCountries();

  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width || 1, height], { type: "Sphere" }),
    [width, height]
  );
  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const flows = useMemo(() => {
    const valid = rows
      .map((r) => ({
        o: [Number(r[originLonField]), Number(r[originLatField])] as [number, number],
        d: [Number(r[destLonField]), Number(r[destLatField])] as [number, number],
        value: Number(r[valueField]),
      }))
      .filter(
        (f) =>
          f.o.every(Number.isFinite) &&
          f.d.every(Number.isFinite) &&
          Math.abs(f.o[1]) <= 90 &&
          Math.abs(f.d[1]) <= 90 &&
          Number.isFinite(f.value)
      );
    const max = Math.max(...valid.map((f) => f.value), Number.EPSILON);
    return valid.map((f) => {
      const interp = geoInterpolate(f.o, f.d);
      // 24 samples along the great circle -- enough for a smooth arc at any practical width.
      const coordinates = Array.from({ length: 25 }, (_, i) => interp(i / 24));
      return { ...f, max, line: { type: "LineString" as const, coordinates } };
    });
  }, [rows, originLatField, originLonField, destLatField, destLonField, valueField]);

  if (!countries) return <EmptyNotice message="Loading map boundaries…" />;

  return (
    <div ref={ref} className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <svg width={width} height={height} role="img" aria-label={`${title ?? "Flow map"}: ${flows.length} origin-destination flows`}>
        {countries.map((c) => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <path key={c.properties.name} d={pathGenerator(c as any) ?? undefined} fill="#efece6" stroke="#fff" strokeWidth={0.4} />
        ))}
        {flows.map((f, i) => (
          <path
            key={i}
            d={pathGenerator(f.line) ?? undefined}
            fill="none"
            stroke={theme?.categorical_colors?.[0] ?? "#b5432a"}
            strokeOpacity={0.7}
            strokeWidth={0.6 + (f.value / f.max) * 5}
            strokeLinecap="round"
          >
            <title>{`${f.o[1].toFixed(1)},${f.o[0].toFixed(1)} → ${f.d[1].toFixed(1)},${f.d[0].toFixed(1)}: ${f.value.toLocaleString()}`}</title>
          </path>
        ))}
        {flows.map((f, i) => {
          const p = projection(f.d);
          return p ? <circle key={`dot-${i}`} cx={p[0]} cy={p[1]} r={2.5} fill={theme?.negative_color ?? "#b5432a"} /> : null;
        })}
      </svg>
    </div>
  );
}
