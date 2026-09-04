/** Realistic fixture data for the chart gallery -- one dataset shape per chart family, so
 * every chart type is exercised with data it's actually designed for rather than forced onto a
 * single generic table. */

export const categorical = [
  { region: "North", product: "Widget", revenue: 5241, units: 120, target: 6000 },
  { region: "South", product: "Widget", revenue: 2405, units: 64, target: 3000 },
  { region: "East", product: "Widget", revenue: 2960, units: 78, target: 2500 },
  { region: "West", product: "Widget", revenue: 3010, units: 81, target: 3500 },
  { region: "North", product: "Gadget", revenue: 3120, units: 70, target: 3000 },
  { region: "South", product: "Gadget", revenue: 4180, units: 96, target: 3800 },
  { region: "East", product: "Gadget", revenue: 1890, units: 45, target: 2200 },
  { region: "West", product: "Gadget", revenue: 2740, units: 66, target: 2600 },
];

export const timeSeries = [
  { date: "2026-01-01", revenue: 1200, margin: 12.4 },
  { date: "2026-02-01", revenue: 1980, margin: 14.1 },
  { date: "2026-03-01", revenue: 2150, margin: 11.8 },
  { date: "2026-04-01", revenue: 1760, margin: 15.2 },
  { date: "2026-05-01", revenue: 3010, margin: 16.9 },
  { date: "2026-06-01", revenue: 2640, margin: 13.3 },
];

/** Multi-series time data for bump/ribbon ranking-over-time charts. */
export const rankedOverTime = [
  { quarter: "Q1", team: "Alpha", score: 90 },
  { quarter: "Q1", team: "Bravo", score: 70 },
  { quarter: "Q1", team: "Delta", score: 50 },
  { quarter: "Q2", team: "Alpha", score: 60 },
  { quarter: "Q2", team: "Bravo", score: 95 },
  { quarter: "Q2", team: "Delta", score: 72 },
  { quarter: "Q3", team: "Alpha", score: 84 },
  { quarter: "Q3", team: "Bravo", score: 66 },
  { quarter: "Q3", team: "Delta", score: 98 },
  { quarter: "Q4", team: "Alpha", score: 77 },
  { quarter: "Q4", team: "Bravo", score: 88 },
  { quarter: "Q4", team: "Delta", score: 91 },
];

/** OHLC price series for candlestick / OHLC charts. */
export const ohlc = [
  { day: "2026-03-02", open: 102, high: 110, low: 100, close: 108 },
  { day: "2026-03-03", open: 108, high: 112, low: 104, close: 105 },
  { day: "2026-03-04", open: 105, high: 107, low: 96, close: 98 },
  { day: "2026-03-05", open: 98, high: 116, low: 97, close: 114 },
  { day: "2026-03-06", open: 114, high: 120, low: 111, close: 119 },
  { day: "2026-03-09", open: 119, high: 121, low: 112, close: 113 },
];

/** Waterfall: an opening balance, signed movements, and the implied close. */
export const waterfall = [
  { stage: "Opening", delta: 1000 },
  { stage: "Q1 sales", delta: 620 },
  { stage: "Q1 costs", delta: -340 },
  { stage: "Q2 sales", delta: 780 },
  { stage: "Q2 costs", delta: -410 },
  { stage: "Refunds", delta: -150 },
];

/** Ordered process stages for the funnel -- deliberately monotonically decreasing. */
export const funnel = [
  { stage: "Visitors", count: 12500 },
  { stage: "Signed up", count: 4200 },
  { stage: "Activated", count: 1850 },
  { stage: "Paid", count: 640 },
  { stage: "Renewed", count: 410 },
];

/** Source -> target flows for sankey / network / chord. */
export const flows = [
  { from: "Search", to: "Landing", weight: 5200 },
  { from: "Social", to: "Landing", weight: 3100 },
  { from: "Email", to: "Landing", weight: 1800 },
  { from: "Landing", to: "Signup", weight: 4200 },
  { from: "Landing", to: "Bounce", weight: 5900 },
  { from: "Signup", to: "Paid", weight: 1400 },
  { from: "Signup", to: "Churned", weight: 2800 },
];

/** Hierarchy: department -> category with a measure, for treemap/sunburst/decomposition. */
export const hierarchy = [
  { department: "Hardware", category: "Laptops", revenue: 4200 },
  { department: "Hardware", category: "Phones", revenue: 3100 },
  { department: "Hardware", category: "Tablets", revenue: 1500 },
  { department: "Software", category: "Licences", revenue: 5200 },
  { department: "Software", category: "Support", revenue: 2400 },
  { department: "Services", category: "Consulting", revenue: 3300 },
  { department: "Services", category: "Training", revenue: 1200 },
];

/** Distribution data with distinct group shapes, so violin/box actually differ per group. */
export const distribution = Array.from({ length: 180 }, (_, i) => {
  const group = ["Control", "Variant A", "Variant B"][i % 3];
  // Deterministic pseudo-values (no Math.random) so the gallery renders identically every load.
  const t = (i * 2654435761) % 1000 / 1000;
  const base = group === "Control" ? 50 : group === "Variant A" ? 62 : 45;
  const spread = group === "Variant B" ? 26 : 12;
  return { group, score: Math.round(base + (t - 0.5) * spread * 2 + Math.sin(i) * 4) };
});

/** Tasks with real start/end dates for the Gantt chart. */
export const tasks = [
  { task: "Discovery", start: "2026-01-05", end: "2026-01-26", phase: "Plan" },
  { task: "Design", start: "2026-01-20", end: "2026-02-20", phase: "Plan" },
  { task: "Build", start: "2026-02-10", end: "2026-04-15", phase: "Deliver" },
  { task: "QA", start: "2026-03-25", end: "2026-04-30", phase: "Deliver" },
  { task: "Launch", start: "2026-04-25", end: "2026-05-10", phase: "Deliver" },
];

/** Country-level values for the choropleth (names match Natural Earth). */
export const countries = [
  { country: "United States of America", value: 820 },
  { country: "Brazil", value: 410 },
  { country: "India", value: 690 },
  { country: "China", value: 910 },
  { country: "Germany", value: 350 },
  { country: "Nigeria", value: 220 },
  { country: "Australia", value: 180 },
  { country: "Japan", value: 470 },
];

/** Point locations for the bubble map. */
export const cities = [
  { city: "London", lat: 51.5, lon: -0.13, volume: 820 },
  { city: "New York", lat: 40.71, lon: -74.0, volume: 960 },
  { city: "Tokyo", lat: 35.68, lon: 139.69, volume: 730 },
  { city: "São Paulo", lat: -23.55, lon: -46.63, volume: 540 },
  { city: "Lagos", lat: 6.52, lon: 3.37, volume: 390 },
  { city: "Sydney", lat: -33.87, lon: 151.21, volume: 300 },
];

/** Origin/destination pairs for the flow map. */
export const routes = [
  { oLat: 51.5, oLon: -0.13, dLat: 40.71, dLon: -74.0, volume: 900 },
  { oLat: 51.5, oLon: -0.13, dLat: 35.68, dLon: 139.69, volume: 520 },
  { oLat: 40.71, oLon: -74.0, dLat: -23.55, dLon: -46.63, volume: 610 },
  { oLat: 35.68, oLon: 139.69, dLat: -33.87, dLon: 151.21, volume: 340 },
  { oLat: 51.5, oLon: -0.13, dLat: 6.52, dLon: 3.37, volume: 280 },
];

/** Comparable metrics per entity for the radar chart. */
export const radar = [
  { metric: "Speed", team: "Alpha", value: 82 },
  { metric: "Quality", team: "Alpha", value: 91 },
  { metric: "Cost", team: "Alpha", value: 60 },
  { metric: "Support", team: "Alpha", value: 74 },
  { metric: "Scale", team: "Alpha", value: 88 },
  { metric: "Speed", team: "Bravo", value: 65 },
  { metric: "Quality", team: "Bravo", value: 78 },
  { metric: "Cost", team: "Bravo", value: 92 },
  { metric: "Support", team: "Bravo", value: 59 },
  { metric: "Scale", team: "Bravo", value: 70 },
];
