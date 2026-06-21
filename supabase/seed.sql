-- =============================================================================
-- Recipe App — seed data
-- A starter catalog of common ingredients so grocery lists / recipes have
-- something to autocomplete against on day one.
--
-- Idempotent: re-running is safe (ingredients.name is unique).
-- Apply after schema.sql:  supabase db push  then run this, or paste in the
-- SQL editor.
-- =============================================================================

insert into ingredients (name, default_unit, category) values
  -- Produce
  ('Apple',            'each', 'produce'),
  ('Banana',           'each', 'produce'),
  ('Lemon',            'each', 'produce'),
  ('Lime',             'each', 'produce'),
  ('Avocado',          'each', 'produce'),
  ('Tomato',           'each', 'produce'),
  ('Onion',            'each', 'produce'),
  ('Red Onion',        'each', 'produce'),
  ('Garlic',           'clove','produce'),
  ('Potato',           'each', 'produce'),
  ('Sweet Potato',     'each', 'produce'),
  ('Carrot',           'each', 'produce'),
  ('Celery',           'stalk','produce'),
  ('Bell Pepper',      'each', 'produce'),
  ('Broccoli',         'head', 'produce'),
  ('Spinach',          'cup',  'produce'),
  ('Lettuce',          'head', 'produce'),
  ('Cucumber',         'each', 'produce'),
  ('Mushroom',         'cup',  'produce'),
  ('Ginger',           'g',    'produce'),
  ('Cilantro',         'bunch','produce'),
  ('Parsley',          'bunch','produce'),
  ('Basil',            'bunch','produce'),

  -- Dairy & eggs
  ('Milk',             'cup',  'dairy'),
  ('Butter',           'tbsp', 'dairy'),
  ('Eggs',             'each', 'dairy'),
  ('Cheddar Cheese',   'g',    'dairy'),
  ('Parmesan Cheese',  'g',    'dairy'),
  ('Mozzarella',       'g',    'dairy'),
  ('Cream Cheese',     'g',    'dairy'),
  ('Greek Yogurt',     'cup',  'dairy'),
  ('Sour Cream',       'cup',  'dairy'),
  ('Heavy Cream',      'cup',  'dairy'),

  -- Meat & seafood
  ('Chicken Breast',   'g',    'meat'),
  ('Chicken Thigh',    'g',    'meat'),
  ('Ground Beef',      'g',    'meat'),
  ('Bacon',            'slice','meat'),
  ('Pork Chop',        'each', 'meat'),
  ('Salmon Fillet',    'each', 'seafood'),
  ('Shrimp',           'g',    'seafood'),
  ('Tuna',             'can',  'seafood'),

  -- Pantry / dry goods
  ('All-Purpose Flour','cup',  'pantry'),
  ('Sugar',            'cup',  'pantry'),
  ('Brown Sugar',      'cup',  'pantry'),
  ('Salt',             'tsp',  'pantry'),
  ('Black Pepper',     'tsp',  'pantry'),
  ('Baking Soda',      'tsp',  'pantry'),
  ('Baking Powder',    'tsp',  'pantry'),
  ('Olive Oil',        'tbsp', 'pantry'),
  ('Vegetable Oil',    'tbsp', 'pantry'),
  ('White Rice',       'cup',  'pantry'),
  ('Pasta',            'g',    'pantry'),
  ('Spaghetti',        'g',    'pantry'),
  ('Canned Tomatoes',  'can',  'pantry'),
  ('Tomato Paste',     'tbsp', 'pantry'),
  ('Chicken Stock',    'cup',  'pantry'),
  ('Black Beans',      'can',  'pantry'),
  ('Chickpeas',        'can',  'pantry'),
  ('Soy Sauce',        'tbsp', 'pantry'),
  ('Honey',            'tbsp', 'pantry'),
  ('Vanilla Extract',  'tsp',  'pantry'),
  ('Oats',             'cup',  'pantry'),
  ('Peanut Butter',    'tbsp', 'pantry'),
  ('Chocolate Chips',  'cup',  'pantry'),
  ('Cinnamon',         'tsp',  'spices'),
  ('Cumin',            'tsp',  'spices'),
  ('Paprika',          'tsp',  'spices'),
  ('Chili Powder',     'tsp',  'spices'),
  ('Oregano',          'tsp',  'spices'),

  -- Bakery & misc
  ('Bread',            'slice','bakery'),
  ('Tortilla',         'each', 'bakery'),
  ('Bagel',            'each', 'bakery'),

  -- Beverages
  ('Coffee',           'g',    'beverages'),
  ('Orange Juice',     'cup',  'beverages')
on conflict (name) do nothing;
