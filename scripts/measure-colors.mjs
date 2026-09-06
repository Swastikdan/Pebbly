// Color-system measurement for Pebbly (run: node scripts/measure-colors.mjs)
// Converts oklch + alpha composites to sRGB and computes WCAG 2.1 contrast.
// Exact ramp values from node_modules/tailwindcss/theme.css (Tailwind v4.3.3).

const OK = (l, c, h, a = 1) => ({ l, c, h, a });

function oklchToLinear({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  // OKLab -> LMS' (Björn Ottosson), then cube to LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ * l_ * l_, M = m_ * m_ * m_, S = s_ * s_ * s_;
  // LMS -> linear sRGB
  const lr = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const lg = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const lb = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const g = (x) =>
    x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
  return {
    r: g(Math.max(0, Math.min(1, lr))),
    g: g(Math.max(0, Math.min(1, lg))),
    b: g(Math.max(0, Math.min(1, lb))),
  };
}
const hex = (o) => {
  const c = oklchToLinear(o);
  return `#${[c.r, c.g, c.b]
    .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
};
const lum = (o) => {
  const c = oklchToLinear(o);
  const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
// normalize oklch or linear-rgb object to linear rgb
const toLinear = (o) =>
  "l" in o ? oklchToLinear(o) : o;
// alpha blend in sRGB space, as browsers composite
const blend = (fg, bg) => {
  const F = toLinear(fg), B = toLinear(bg);
  const mix = (f, b) => f * fg.a + b * (1 - fg.a);
  return { r: mix(F.r, B.r), g: mix(F.g, B.g), b: mix(F.b, B.b) };
};
const lumRGB = ({ r, g, b }) => {
  const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (fg, bg) => {
  const Lf = lumRGB(blend(fg, bg)), Lb = lumRGB(toLinear(bg));
  return (Math.max(Lf, Lb) + 0.05) / (Math.min(Lf, Lb) + 0.05);
};
const at = (c, a) => ({ ...c, a });

// --- Tailwind v4 ramp values (exact) ---
const T = {
  "red-50": OK(0.971, 0.013, 17.38), "red-200": OK(0.885, 0.062, 18.334),
  "red-400": OK(0.704, 0.191, 22.216), "red-500": OK(0.637, 0.237, 25.331),
  "red-600": OK(0.577, 0.245, 27.325), "red-700": OK(0.505, 0.213, 27.518),
  "red-800": OK(0.444, 0.177, 26.899), "red-900": OK(0.396, 0.141, 25.723),
  "amber-200": OK(0.924, 0.12, 95.746),
  "amber-400": OK(0.828, 0.189, 84.429), "amber-500": OK(0.769, 0.188, 70.08),
  "amber-600": OK(0.666, 0.179, 58.318), "amber-700": OK(0.555, 0.163, 48.998),
  "amber-800": OK(0.473, 0.137, 46.201), "amber-900": OK(0.414, 0.112, 45.904),
  "emerald-400": OK(0.765, 0.177, 163.223), "emerald-500": OK(0.696, 0.17, 162.48),
  "emerald-600": OK(0.596, 0.145, 163.225), "emerald-700": OK(0.508, 0.118, 165.612),
  "emerald-800": OK(0.432, 0.095, 166.913),
  "blue-400": OK(0.707, 0.165, 254.624), "blue-500": OK(0.623, 0.214, 259.815),
  "blue-600": OK(0.546, 0.245, 262.881), "blue-700": OK(0.488, 0.243, 264.376),
  "neutral-50": OK(0.985, 0, 0), "neutral-100": OK(0.97, 0, 0),
  "neutral-400": OK(0.708, 0, 0),
  "neutral-500": OK(0.556, 0, 0), "neutral-800": OK(0.269, 0, 0),
  white: OK(1, 0, 0), black: OK(0, 0, 0),
};

// --- rendered semantic tokens (from src/styles.css) ---
const bgLight = T["neutral-50"]; // oklch(98.5% 0 0)
const bgDark = OK(0.145 * 0.95 + 1 * 0.05, 0, 0); // neutral-950 95% + white
const cardLight = T.white;
const cardDark = OK(bgDark.l * 0.98 + 1 * 0.02, 0, 0); // background 98% + white
const mutedFL = OK(0.556 * 0.9, 0, 0); // neutral-500 90% + black (monochrome)
const mutedFD = OK(0.556 * 0.9 + 0.1, 0, 0); // neutral-500 90% + white

const rows = [];
function check(name, fg, bg, threshold, where) {
  const r = ratio(fg, bg);
  rows.push({ name, where, ratio: r, threshold, pass: r >= threshold });
}

// --- body text ---
check("foreground on background (light)", T["neutral-800"], bgLight, 4.5, "body");
check("foreground on background (dark)", T["neutral-100"], bgDark, 4.5, "body");
check("muted-foreground on background (light)", mutedFL, bgLight, 4.5, "body");
check("muted-foreground on background (dark)", mutedFD, bgDark, 4.5, "body");
check("muted-foreground on card (light)", mutedFL, cardLight, 4.5, "card");
check("muted-foreground on card (dark)", mutedFD, cardDark, 4.5, "card");

// --- status text ---
check("IMPLEMENTED emerald-700 text on card (light)", T["emerald-700"], cardLight, 4.5, "status text");
check("emerald-400 text on dark bg (dark)", T["emerald-400"], cardDark, 4.5, "status text");
check("emerald-700 on emerald/15 over card (light pill)", T["emerald-700"], blend({ ...T["emerald-500"], a: 0.15 }, cardLight), 4.5, "pill");
check("emerald-700 on emerald/10 over card (light pill)", T["emerald-700"], blend({ ...T["emerald-500"], a: 0.1 }, cardLight), 4.5, "pill");
check("emerald-400 on emerald/15 over dark bg (dark pill)", T["emerald-400"], blend({ ...T["emerald-500"], a: 0.15 }, bgDark), 4.5, "pill");
check("emerald-400 on emerald/10 over dark bg (dark pill)", T["emerald-400"], blend({ ...T["emerald-500"], a: 0.1 }, bgDark), 4.5, "pill");
check("IMPLEMENTED amber-700 text on card (light)", T["amber-700"], cardLight, 4.5, "status text");
check("amber-400 text on dark bg (dark)", T["amber-400"], cardDark, 4.5, "status text");
check("IMPLEMENTED amber-800 on amber/15 over card (light pill)", T["amber-800"], blend({ ...T["amber-500"], a: 0.15 }, cardLight), 4.5, "pill");
check("amber-400 on amber/15 over dark bg (dark pill)", T["amber-400"], blend({ ...T["amber-500"], a: 0.15 }, bgDark), 4.5, "pill");
check("IMPLEMENTED amber-700 on amber/10 over card (admin badge)", T["amber-700"], blend({ ...T["amber-500"], a: 0.1 }, cardLight), 4.5, "badge");
check("IMPLEMENTED blue-600 text on background (light brand)", T["blue-600"], bgLight, 4.5, "brand text");
check("blue-400 text on dark bg (dark)", T["blue-400"], cardDark, 4.5, "AI text");
check("IMPLEMENTED blue-400 text on black/80 over image", T["blue-400"], blend({ ...T.black, a: 0.8 }, T.white), 4.5, "overlay worst");

// --- solid fills with white/black labels ---
check("IMPLEMENTED white on emerald-700 fill (CTA)", T.white, T["emerald-700"], 4.5, "button");
check("IMPLEMENTED white on emerald-800 hover fill", T.white, T["emerald-800"], 4.5, "button");
check("white on blue-600 fill (badge)", T.white, T["blue-600"], 4.5, "button");
check("IMPLEMENTED black on emerald-500/90 over dark image (Watching badge)", T.black, blend({ ...T["emerald-500"], a: 0.9 }, T.black), 4.5, "badge");
check("IMPLEMENTED emerald-700 icon on emerald/10 over card", T["emerald-700"], blend({ ...T["emerald-500"], a: 0.1 }, cardLight), 3.0, "icon");

// --- import alerts ---
check("IMPLEMENTED amber-800 on amber-50 (warning alert)", T["amber-800"], OK(0.987, 0.022, 95.277), 4.5, "alert");
check("IMPLEMENTED amber-200 on amber-900/20 over dark bg", T["amber-200"], blend({ ...T["amber-900"], a: 0.2 }, bgDark), 4.5, "alert");
check("red-800 on red-50 (error alert)", T["red-800"], T["red-50"], 4.5, "alert");
check("red-200 on red-900/20 over dark bg", T["red-200"], blend({ ...T["red-900"], a: 0.2 }, bgDark), 4.5, "alert");

// --- destructive token text ---
check("IMPLEMENTED red-700 (via --destructive-foreground) text on card (light)", T["red-700"], cardLight, 4.5, "error text");
check("red-400 text on dark bg (dark)", T["red-400"], cardDark, 4.5, "error text");

// --- stars (icons, 3.0) ---
check("IMPLEMENTED amber-400 star on card (dark)", T["amber-400"], cardDark, 3.0, "icon");
check("IMPLEMENTED amber-400 star on black/70 over image", T["amber-400"], T.black, 3.0, "overlay icon");

// --- nav ---
check("nav-active-fg L.97 on nav-active-bg L.34", OK(0.97, 0, 0), OK(0.34, 0, 0), 4.5, "nav");
check("nav-active-fg L.87 on dark bg", OK(0.87, 0, 0), bgDark, 4.5, "nav");
check("nav-active-fg/75 on nav-active-bg", at(OK(0.97, 0, 0), 0.75), OK(0.34, 0, 0), 4.5, "nav subtext");

// --- pre-flight candidate rows (kept for future token work) ---
check("PROPOSED red-600 text on card (light)", T["red-600"], cardLight, 4.5, "proposed");
check("PROPOSED white on red-600 fill", T.white, T["red-600"], 4.5, "proposed");
check("PROPOSED amber-500 star on card (light, icon 3.0)", T["amber-500"], cardLight, 3.0, "proposed");
check("PROPOSED amber-600 star on card (light, icon 3.0)", T["amber-600"], cardLight, 3.0, "proposed");

// --- P3 gamut check: flag oklch values outside sRGB before clamping ---
function gamut(o) {
  const hr = (o.h * Math.PI) / 180;
  const a = o.c * Math.cos(hr), b = o.c * Math.sin(hr);
  const l_ = o.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = o.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = o.l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].some((v) => v < -0.001 || v > 1.001);
}
const outOfGamut = Object.entries(T).filter(([, v]) => gamut(v)).map(([k]) => k);
console.log(`\nOut of sRGB gamut (need P3 fallback or accepted clamp): ${outOfGamut.join(", ") || "none"}`);

// --- implemented-state spot checks ---
check("IMPLEMENTED white on emerald-800 hover", T.white, T["emerald-800"], 4.5, "button");
check("IMPLEMENTED white on --destructive hover (red-700)", T.white, T["red-700"], 4.5, "button");
// worst-case overlay: black/70 over a pure-white poster (lightest possible backdrop)
const worst70 = blend({ ...T.black, a: 0.7 }, T.white);
const worst80 = blend({ ...T.black, a: 0.8 }, T.white);
check("IMPLEMENTED amber-400 star on black/70 over white poster", T["amber-400"], worst70, 3.0, "overlay worst");
check("IMPLEMENTED blue-400 text on black/80 over white poster", T["blue-400"], worst80, 4.5, "overlay worst");
// focus ring (non-text indicator, 3.0) — pointer for better-accessibility
check("ring neutral-500 on dark bg", T["neutral-500"], bgDark, 3.0, "focus ring");
// toast type icons (icon threshold 3.0) — now consumed via *-foreground tokens
check("IMPLEMENTED emerald-700 toast icon on popover (light)", T["emerald-700"], cardLight, 3.0, "toast icon");
check("IMPLEMENTED amber-700 toast icon on popover (light)", T["amber-700"], cardLight, 3.0, "toast icon");
check("IMPLEMENTED blue-700 toast icon on popover (light)", T["blue-700"], cardLight, 3.0, "toast icon");
check("IMPLEMENTED red-700 toast icon on popover (light)", T["red-700"], cardLight, 3.0, "toast icon");
check("emerald-400 toast icon on popover (dark)", T["emerald-400"], cardDark, 3.0, "toast icon");
check("amber-400 toast icon on popover (dark)", T["amber-400"], cardDark, 3.0, "toast icon");
// hover states of the /15-bg icon-buttons
check("IMPLEMENTED emerald-700 icon on emerald/15 over card (hover)", T["emerald-700"], blend({ ...T["emerald-500"], a: 0.15 }, cardLight), 3.0, "icon hover");
check("IMPLEMENTED ring neutral-500 on card (light)", T["neutral-500"], cardLight, 3.0, "focus ring");

// --- implemented-state pairs (unified destructive token, overlay chips) ---
// --destructive is now flat red-600 in BOTH themes (solid fill for buttons/badges);
// soft error text/icons are carried by --destructive-foreground (red-700 / red-400)
check("IMPLEMENTED white on --destructive fill (red-600, light)", T.white, T["red-600"], 4.5, "button");
check("IMPLEMENTED white on --destructive fill (red-600, dark)", T.white, T["red-600"], 4.5, "button");
check("IMPLEMENTED red-700 (via --destructive-foreground) text on light card", T["red-700"], cardLight, 4.5, "error text");
check("IMPLEMENTED red-700 icon on destructive/10 over card", T["red-700"], blend({ ...T["red-500"], a: 0.1 }, cardLight), 3.0, "icon");
check("IMPLEMENTED red-700 icon on destructive/15 over card (hover)", T["red-700"], blend({ ...T["red-500"], a: 0.15 }, cardLight), 3.0, "icon hover");
check("IMPLEMENTED badge error: red-700 on destructive/8 over card (light)", T["red-700"], blend({ ...T["red-600"], a: 0.08 }, cardLight), 4.5, "badge");
check("IMPLEMENTED badge error: red-400 on destructive/16 over dark card", T["red-400"], blend({ ...T["red-600"], a: 0.16 }, cardDark), 4.5, "badge");
check("IMPLEMENTED amber-200 on amber-900/20 over dark (watchlist alert)", T["amber-200"], blend({ ...T["amber-900"], a: 0.2 }, bgDark), 4.5, "alert");
check("IMPLEMENTED amber-400 star on black/60 over white poster (media-card)", T["amber-400"], blend({ ...T.black, a: 0.6 }, T.white), 3.0, "overlay worst");
// --- sanity assertions (converter correctness) ---
const assert = (name, cond) => {
  if (!cond) console.error(`SANITY FAIL: ${name}`);
};
assert("white is #ffffff", hex(T.white) === "#ffffff");
assert("black is #000000", hex(T.black) === "#000000");
assert("neutral-800 is #262626", hex(T["neutral-800"]) === "#262626");
assert("neutral-50 is #fafafa", hex(T["neutral-50"]) === "#fafafa");
assert("blue-600 is #155dfc (Tailwind v4)", hex(T["blue-600"]) === "#155dfc");
assert("emerald-600 is #009966 (Tailwind v4)", hex(T["emerald-600"]) === "#009966");
assert("amber-600 is #e17100 (Tailwind v4)", hex(T["amber-600"]) === "#e17100");
assert("red-600 is #e7000b (Tailwind v4)", hex(T["red-600"]) === "#e7000b");
assert("emerald-500 is #00bc7d (Tailwind v4)", hex(T["emerald-500"]) === "#00bc7d");
assert(
  "white on red-600 is 4.76",
  Math.abs(ratio(T.white, T["red-600"]) - 4.76) < 0.01
);

// --- report ---
const pad = (s, n) => String(s).padEnd(n);
console.log(
  rows
    .map((r) =>
      `${r.pass ? "PASS" : "FAIL"}  ${r.ratio.toFixed(2).padStart(5)}:1  (min ${r.threshold})  [${pad(r.where, 12)}] ${r.name}`
    )
    .join("\n")
);
const fails = rows.filter((r) => !r.pass);
console.log(`\n${rows.length - fails.length}/${rows.length} pass`);
// hex of key colors for reference
console.log(
  `\nbgDark ${hex(bgDark)}  cardDark ${hex(cardDark)}  mutedFL ${hex(mutedFL)}  mutedFD ${hex(mutedFD)}`
);
