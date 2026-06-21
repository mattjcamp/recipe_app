# recipe_app

Share recipes, grocery lists and meal plans

# Idea

App written in Next.js and TypeScript that will be hosted on a webpage, but also used as an app on a phone. It will require user accounts and access to the phone's camera. The purpose of the app is to organize grocery lists, pantries, recipes, mealplans and macro tracking. Users will each have their own accounts and be part of a "family" that will share the content. Most data will be associated with a Family. Users can have their own content as well (especially for macro tracking). It may need to use https://capacitorjs.com/ if we want to use the phone camera.

# Questions

- How will we handle authentication? We we want real user account profiles and realtime updates to data
- Should we use Vercel for hosting?
- Do we need a database for storage? Or will local file buckets be enough?

# User Hierarchy

The app content belongs to a family. A family is a group of one or more users who share content. When a user joins a family, he shares all lists with the other members of the family. Any family member can update any list and all family members will see the same content even after it has been updated.

# Components
- Log In
- Grocery List
- Pantry
- Recipes
- Meal Schedule

# Data Model Formats

## JSON-LD (Schema.org/Recipe)

- What it is: The modern gold standard recommended by Google. Instead of marking up standard HTML text, developers place a hidden block of code on the page (called JSON-LD) that maps out the entire recipe in a format machines can easily read.
- Why it’s used: It powers "rich snippets" in search results, displaying star ratings, calorie counts, and prep times right under the search link.
- How it looks: `<script type="application/ld+json"> { "@context": "https://schema.org", "@type": "Recipe", "name": "Chocolate Chip Cookies", ... } </script>`

## h-recipe (Microformats)

- What it is: The direct semantic markup standard. It works by adding specific class names directly to the HTML tags of the page.
- Why it’s used: It allows browser extensions and aggregators to "read" the recipe directly from the text of the webpage without relying on hidden scripts.
- How it looks: `<div class="h-recipe"> <h1 class="p-name">Pancakes</h1> <ul class="p-ingredient"><li>Milk</li></ul> <div class="e-instructions">Mix the batter...</div> </div>`