// One-time importer for Paprika-style HTML recipe exports.
//
// Run locally (from the project root, so @supabase/supabase-js resolves):
//
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_secret> \
//     node scripts/import-recipes.mjs "/path/to/Recipes"
//
// The service_role key is in Supabase: Project Settings → API → service_role.
// It bypasses RLS, so it can insert recipes and upload images. Do NOT commit it
// or paste it anywhere shared — pass it only as an env var when running.
//
// Add --dry to parse and preview without writing anything.
//
// Behaviour: skips recipes whose title already exists for the family (no
// duplicates), brings over categories, ingredients, steps, notes, and uploads
// each recipe's photo to the recipe-photos bucket.

import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const RECIPES_DIR =
  args.find((a) => !a.startsWith("--")) || process.env.RECIPES_DIR || ".";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjkcvolhhhmtnmgxprqv.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FAMILY_ID =
  process.env.FAMILY_ID || "39cf89ce-ad23-4105-ac45-8fef87ce278b";
const OWNER_ID =
  process.env.OWNER_ID || "25f9b68f-3a56-48e0-bc4b-c5686790f9c3";
const BUCKET = "recipe-photos";

const UNITS = new Set([
  "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
  "cup", "cups", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "g", "gram", "grams", "kg", "ml", "l", "liter", "liters",
  "clove", "cloves", "can", "cans", "pinch", "stick", "sticks",
  "slice", "slices", "quart", "quarts", "pint", "pints", "head", "bunch",
]);

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
const strip = (s) => decode(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function parseFile(html) {
  const title = (() => {
    const m = /<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    return m ? strip(m[1]) : null;
  })();

  const category = (() => {
    const m = /<p[^>]*itemprop="recipeCategory"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    return m ? strip(m[1]) || null : null;
  })();

  let image = null;
  const imgTag = /<img\b[^>]*itemprop="image"[^>]*>/.exec(html);
  if (imgTag) {
    const src = /src="([^"]+)"/.exec(imgTag[0]);
    if (src) image = src[1];
  }

  const ingredients = [];
  const re = /<p[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1];
    const qtyM = /<strong>([\s\S]*?)<\/strong>/.exec(inner);
    const qty = qtyM ? strip(qtyM[1]) : "";
    const rest = strip(inner.replace(/<strong>[\s\S]*?<\/strong>/, ""));
    let unit = null;
    let name = rest;
    const parts = rest.split(" ");
    if (parts.length > 1 && UNITS.has(parts[0].toLowerCase())) {
      unit = parts[0];
      name = parts.slice(1).join(" ");
    }
    if (name || qty) ingredients.push({ qty, unit, name });
  }

  const blockText = (frag) =>
    decode(
      frag
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n"),
    ).trim();

  let instructions = "";
  const dir = /<div[^>]*itemprop="recipeInstructions"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  if (dir) instructions = blockText(dir[1]);

  let notes = "";
  const nm = /<div[^>]*itemprop="comment"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  if (nm) notes = blockText(nm[1]);

  return { title, category, image, ingredients, instructions, notes };
}

async function main() {
  const files = readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith(".html"))
    .sort();
  const parsed = files
    .map((f) => ({ file: f, ...parseFile(readFileSync(path.join(RECIPES_DIR, f), "utf8")) }))
    .filter((r) => r.title);

  console.log(`Parsed ${parsed.length} recipes from ${RECIPES_DIR}`);

  if (DRY) {
    console.log("\nDRY RUN — nothing written. Sample:");
    console.log(JSON.stringify(parsed.slice(0, 2), null, 2));
    return;
  }

  if (!SERVICE_KEY) {
    console.error(
      "\nMissing SUPABASE_SERVICE_ROLE_KEY. Get it from Supabase → Project Settings → API → service_role, then re-run with it set.",
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: existing, error: exErr } = await supabase
    .from("recipes")
    .select("title")
    .eq("family_id", FAMILY_ID);
  if (exErr) {
    console.error("Could not read existing recipes:", exErr.message);
    process.exit(1);
  }
  const have = new Set((existing ?? []).map((r) => r.title.trim().toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let photos = 0;
  let errors = 0;

  for (const r of parsed) {
    const key = r.title.trim().toLowerCase();
    if (have.has(key)) {
      skipped++;
      continue;
    }
    have.add(key);

    const { data: rec, error } = await supabase
      .from("recipes")
      .insert({
        family_id: FAMILY_ID,
        created_by: OWNER_ID,
        title: r.title,
        category: r.category,
        instructions: r.instructions || "",
        description: r.notes || null,
      })
      .select("id")
      .single();
    if (error || !rec) {
      console.error(`✗ ${r.title}: ${error?.message ?? "insert failed"}`);
      errors++;
      continue;
    }

    if (r.ingredients.length > 0) {
      const rows = r.ingredients.map((ing, i) => ({
        recipe_id: rec.id,
        free_text: ing.name || null,
        quantity: ing.qty || null,
        unit: ing.unit || null,
        is_heading: false,
        sort_order: i,
      }));
      const { error: ie } = await supabase
        .from("recipe_ingredients")
        .insert(rows);
      if (ie) console.error(`  ingredient error (${r.title}): ${ie.message}`);
    }

    let photoNote = "";
    if (r.image) {
      try {
        const rel = decodeURIComponent(r.image);
        const abs = path.join(RECIPES_DIR, rel);
        if (existsSync(abs)) {
          const buf = readFileSync(abs);
          const ext = (rel.split(".").pop() || "jpg").toLowerCase();
          const ct =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : ext === "heic"
                  ? "image/heic"
                  : "image/jpeg";
          const dest = `${FAMILY_ID}/recipes/${rec.id}/${path.basename(rel)}`;
          const { error: ue } = await supabase.storage
            .from(BUCKET)
            .upload(dest, buf, { contentType: ct, upsert: true });
          if (ue) {
            console.error(`  photo error (${r.title}): ${ue.message}`);
          } else {
            await supabase.from("recipes").update({ image_url: dest }).eq("id", rec.id);
            photos++;
            photoNote = " (+photo)";
          }
        }
      } catch (e) {
        console.error(`  photo error (${r.title}): ${e.message}`);
      }
    }

    imported++;
    console.log(`✓ ${r.title}${photoNote}`);
  }

  console.log(
    `\nDone. Imported ${imported}, skipped ${skipped} (already existed), photos uploaded ${photos}, errors ${errors}.`,
  );
}

main();
