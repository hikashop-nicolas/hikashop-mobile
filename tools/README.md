# Test-site tooling

## seed-demo-shop.php

Fills a local HikaShop with a shop that looks like a shop: products, categories, customers with
addresses, and a year of orders. The app needs enough rows to exercise paging and search, and it
needs those rows to be presentable — `Vol test product 217` proves the list works and makes a
screenshot useless.

```sh
php tools/seed-demo-shop.php --site=/usr/local/var/www/joomla6
php tools/seed-demo-shop.php --site=... --products=300 --customers=300 --orders=300
php tools/seed-demo-shop.php --site=... --clean
```

Everything it writes is tagged — product codes start with `DEMO-`, customer emails end in
`@example.com`, order numbers start with `DEMO`. `--clean` removes exactly those, so a shop's own
data is never touched.

Re-running is safe and produces the same shop: each item's data is seeded from its own index, so
a second run neither duplicates rows nor renames the ones already there.

What it aims for, and why:

- **Products** read like real ones. Names are assembled from a department's qualifiers and its
  things, and a variant belongs to the thing rather than the department, so a sleeping bag is
  offered by comfort rating and a water bottle by volume.
- **Not everything is perfect.** A few products are out of stock, a few unpublished, some orders
  cancelled or refunded. A fixture where everything is fine hides how the awkward cases look.
- **Customers come from several countries.** A list of names all from one place looks staged in a
  screenshot, and it hides how the address format behaves elsewhere.
- **Orders span a year** with a mild upward trend, a slow swell, week-to-week noise and quieter
  weekends, so the dashboard's ranges each have a shape worth looking at, and the
  period-on-period figures move in both directions.
- **A little of the trade is in another currency**, so the conversion in the statistics is
  exercised rather than assumed.

Addresses use invented street names: this data ends up in screenshots, so nothing in it should
point at a real person.

## Themes

A theme is the vocabulary a shop is built from — departments, the things they sell, the options
those come in, the people who buy them, and a palette. It holds no logic, so a new shop is a new
data file rather than a new script.

```sh
php tools/seed-demo-shop.php --site=... --theme=general-store   # the default
php tools/seed-demo-shop.php --site=... --theme=shoes
```

`themes/shoes.php` exists mainly to prove the generator is not the general store: everything that
differs between the two is data. It also leans harder on variants, since almost everything a shoe
shop sells comes in a colour and a size.

### Variants

A thing that names characteristics becomes a parent product with a variant per combination. The
option and its values are characteristics; each variant is a product joined to its values, and
each variant carries **its own image**, which is the mechanism behind the picture changing when a
customer picks a colour.

The number of values per option is capped rather than the number of combinations. Seven colours
and seven sizes is forty-nine variants for one shoe; capping the combinations instead would leave
it offered in every size but only the first three colours, which is not what a shop looks like.

### One caveat when switching themes

`--clean` does not remove characteristics, because it cannot tell the ones it created from the
ones the shop already had — deleting "Size: M" could destroy a real shop's data. Seeding a second
theme onto the same site therefore leaves the first theme's colours and sizes behind, and a jumper
ends up offered in shoe sizes. Use one theme per site, or remove the unused values by hand.

## Product images

By default the seeder draws a tile per product: a gradient in the department's colours with a
composition seeded from the product's name. Instant, offline, no licence to honour, and nothing
added to the repo. It is honestly a placeholder, which is better than a stock photo of a beach
against a cast iron skillet.

For screenshots that go somewhere people will see them, `--ai-images` fetches real product
photographs from a local image model through LocalAI's OpenAI-compatible endpoint:

```sh
local-ai run flux.1-dev-ggml                     # or any image model in its gallery
php tools/seed-demo-shop.php --site=... --ai-images=http://localhost:8081
php tools/seed-demo-shop.php --site=... --ai-images=http://localhost:8081 --ai-model=flux.1-dev-ggml
```

Two things make that practical rather than an overnight job:

- **One image per kind of product, not per product.** "Cast Iron Skillet — 24 cm" and "Copper
  Skillet — 26 cm" are the same photograph as far as a listing is concerned, so a 300-product shop
  needs 48 images. At roughly 20 seconds each on a CPU that is about a quarter of an hour, against
  nearly two hours for one per product.
- **Cached on disk by prompt**, under `tools/cache/images` (git-ignored). A second run costs
  nothing, and the cache can be copied between machines.

Anything that goes wrong falls back to the drawn tile: no server, a timeout, an unexpected
response. A fixture must not fail because an optional service is not running.

Note LocalAI defaults to port 8080, which is where the local Joomla stack already listens — run it
elsewhere and pass the URL.

### No faker dependency

The obvious candidate (`xefi/faker-php`) generates person names and Latin lorem, not product
names, so the catalogue has to be written by hand either way; and it pins PHP to `>=8.3 <8.6`,
which is a ceiling to inherit for a fixture script. `demo-catalogue.php` holds the vocabulary, so
the shop can be re-themed without touching the generator.
