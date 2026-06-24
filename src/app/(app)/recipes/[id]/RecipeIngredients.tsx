"use client";

import { useState } from "react";
import type { RecipeIngredient } from "@/lib/database.types";
import { scaleQuantityText } from "@/lib/quantity";

const FACTORS = [0.5, 1, 1.5, 2, 3];

function label(f: number) {
  if (f === 0.5) return "½×";
  if (f === 1.5) return "1½×";
  return `${f}×`;
}

export default function RecipeIngredients({
  ings,
}: {
  ings: RecipeIngredient[];
}) {
  const [factor, setFactor] = useState(1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs uppercase tracking-wide text-slate-400">
          Scale
        </span>
        {FACTORS.map((f) => (
          <button
            key={f}
            onClick={() => setFactor(f)}
            className={`rounded-lg border px-2.5 py-1 text-sm font-medium ${
              factor === f
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label(f)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 text-slate-700">
        {ings.map((ing) => {
          if (ing.is_heading) {
            return (
              <h3
                key={ing.id}
                className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-500 first:mt-0"
              >
                {ing.free_text}
              </h3>
            );
          }
          const qty = scaleQuantityText(ing.quantity, factor);
          const measure = [qty, ing.unit].filter(Boolean).join(" ");
          return (
            <div key={ing.id} className="pl-1">
              • {ing.free_text}
              {measure && `, ${measure}`}
            </div>
          );
        })}
      </div>
    </div>
  );
}
