// Hand-written subset of the DB types matching supabase/schema.sql.
// For a full generated version run:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Role = "owner" | "member";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Family {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: Role;
}

export interface Location {
  id: string;
  family_id: string;
  store: string | null;
  aisle: string | null;
  aisle_num: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  email: string;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Ingredient {
  id: string;
  family_id: string;
  name: string;
  default_unit: string | null;
  category: string | null;
  aisle: string | null;
  notes: string | null;
  image_path: string | null;
  location_id: string | null;
}

export interface Recipe {
  id: string;
  family_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_url: string | null;
  source_url: string | null;
  instructions: string[];
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string | null;
  free_text: string | null;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  sort_order: number;
}

export interface GroceryList {
  id: string;
  family_id: string;
  name: string;
  is_archived: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroceryListItem {
  id: string;
  list_id: string;
  ingredient_id: string | null;
  free_text: string | null;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
  image_path: string | null;
  notes: string | null;
  aisle: string | null;
  location_id: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}
