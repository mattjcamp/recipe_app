// Parse a recipe out of a fetched web page.
//
// Most recipe sites embed schema.org "Recipe" data as JSON-LD
// (<script type="application/ld+json">). That's the reliable signal, so it's
// the primary path; if a page has none, we fall back to just its title and let
// the user fill in the rest.

export type ImportedIngredientRow = {
  ingredient_id: null;
  name: string;
  quantity: string;
  unit: string;
};

export type ParsedRecipe = {
  title: string;
  category: string;
  notes: string; // maps to recipe description
  instructions: string; // markdown (headings + bulleted steps)
  ingredients: ImportedIngredientRow[];
  sourceUrl: string;
  warning?: string; // set when only partial data could be extracted
};

// ---- text helpers ---------------------------------------------------------

// Common named entities seen in recipe text (some sites double-encode JSON-LD).
const NAMED_ENTITIES: Record<string, string> = {
  deg: "°", frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔",
  frac18: "⅛", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", times: "×", divide: "÷", middot: "·", trade: "™",
  reg: "®", copy: "©", szlig: "ß", eacute: "é", egrave: "è", ecirc: "ê",
  agrave: "à", acirc: "â", aacute: "á", ccedil: "ç", ntilde: "ñ", iacute: "í",
  oacute: "ó", uacute: "ú", ouml: "ö", auml: "ä", uuml: "ü", euml: "ë",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
        ? NAMED_ENTITIES[name.toLowerCase()]
        : m,
    )
    .replace(/&amp;/gi, "&");
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

// Collapse to a single clean line.
function clean(value: unknown): string {
  return decodeEntities(stripTags(String(value ?? "")))
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

// Best-effort "give me a string" from JSON-LD's many shapes.
function firstString(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (Array.isArray(x)) return x.length ? firstString(x[0]) : "";
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    return firstString(o.name ?? o.text ?? o["@value"] ?? "");
  }
  return "";
}

// ---- JSON-LD discovery ----------------------------------------------------

type JsonValue = unknown;

function findRecipeNode(html: string): Record<string, unknown> | null {
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // some sites emit invalid JSON-LD; skip it
    }
    const found = searchRecipe(parsed);
    if (found) return found;
  }
  return null;
}

function searchRecipe(node: JsonValue): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = searchRecipe(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const types = (Array.isArray(t) ? t : t ? [t] : []) as unknown[];
  if (types.some((x) => typeof x === "string" && x.toLowerCase() === "recipe")) {
    return obj;
  }
  if (obj["@graph"]) return searchRecipe(obj["@graph"]);
  return null;
}

// ---- instructions ---------------------------------------------------------

function formatInstructions(ri: unknown): string {
  const lines: string[] = [];

  const pushStep = (text: unknown) => {
    const c = clean(text);
    if (c) lines.push(`- ${c}`);
  };

  const handle = (node: unknown) => {
    if (node == null) return;
    if (typeof node === "string") {
      const parts = node
        .split(/\r?\n/)
        .map((s) => clean(s))
        .filter(Boolean);
      if (parts.length > 1) parts.forEach((p) => lines.push(`- ${p}`));
      else pushStep(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(handle);
      return;
    }
    if (typeof node === "object") {
      const o = node as Record<string, unknown>;
      const type = String(o["@type"] ?? "").toLowerCase();
      if (type === "howtosection") {
        const name = clean(o.name);
        if (name) lines.push(`# ${name}`);
        handle(o.itemListElement);
        return;
      }
      pushStep(o.text ?? o.name);
    }
  };

  handle(ri);
  return lines.join("\n");
}

// ---- public API -----------------------------------------------------------

function metaTitle(html: string): string {
  const og =
    html.match(
      /<meta[^>]+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["']/i,
    );
  if (og) return clean(og[1]);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? clean(t[1]) : "";
}

export function parseRecipeFromHtml(html: string, sourceUrl: string): ParsedRecipe {
  const node = findRecipeNode(html);

  if (node) {
    const ingredients = asArray(node.recipeIngredient)
      .map((x) => clean(firstString(x)))
      .filter(Boolean)
      .map(
        (name): ImportedIngredientRow => ({
          ingredient_id: null,
          name,
          quantity: "",
          unit: "",
        }),
      );

    return {
      title: clean(firstString(node.name)) || "Imported recipe",
      category: clean(firstString(node.recipeCategory)),
      notes: clean(firstString(node.description)),
      instructions: formatInstructions(node.recipeInstructions),
      ingredients,
      sourceUrl,
    };
  }

  return {
    title: metaTitle(html) || "Imported recipe",
    category: "",
    notes: "",
    instructions: "",
    ingredients: [],
    sourceUrl,
    warning:
      "We couldn't find structured recipe data on that page, so only the title was imported. Add the ingredients and steps below.",
  };
}
