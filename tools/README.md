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

Three sources, tried in order, each falling through to the next:

1. **Pexels** (`--stock-images`). Real photographs, free, and its licence explicitly allows using
   them as part of a template you distribute. Declines anything with a colour, for the reason
   below.
2. **A generated image** (`--ai-images`). Handles the colour case, and anything stock has no
   photograph of.
3. **A drawn tile** (the default). A gradient in the department's colours with a composition
   seeded from the product's name. Instant, offline, no licence to honour, nothing added to the
   repo. Honestly a placeholder.

### Why stock cannot do variants

The point of a variant image is the *same* boot in seven colours, so the frontend swaps the photo
when a customer picks one. A search returns seven different boots. So a thing offered in colours
is generated end to end, base image included, rather than jumping from a photograph to a rendering
the moment someone picks a colour.

### Why stock needs supervising

Searching is only as good as the word. "Chelsea Boot" is excellent; "Shoe Trees" returns shoes
hanging from trees in a forest. A theme can therefore name a better query per thing:

```php
['name' => 'Shoe Trees', 'suffixes' => ['S', 'M', 'L'], 'stock' => 'wooden shoe last'],
```

Every pick is written to `tools/cache/stock-picks.html`: each photograph next to the query that
chose it, on one page. A wrong one is obvious in the time it takes to scroll, which is the point —
otherwise you find it in a screenshot later.

The key comes from `PEXELS_API_KEY` in the environment, as with the generated images. Registering
for one is free.

### Why Pexels and not a paid stock account

Distributing an image inside something end users install needs an **Extended** licence on both
Adobe Stock and Shutterstock, at roughly $80-100 an image; their standard licences prohibit it
outright, and cap reproduction at 500,000 copies besides. That rules paid stock out of the exact
case this tool is aimed at, sample data shipped with HikaShop. Pexels, Pixabay and Unsplash permit
it, restricted only from rebuilding a competing stock service.

### Generated images

For the colour variants, and anything stock has no photograph of, `--ai-images` fetches product
photographs from any OpenAI-compatible images endpoint. A hosted one is the practical choice — see
below for why the local one is not, on this machine:

```sh
export DEMO_IMAGE_API_KEY=...                    # never passed as a flag; see "The key" below
php tools/seed-demo-shop.php --site=... \
    --ai-images=https://api.together.xyz \
    --ai-model=black-forest-labs/FLUX.1-schnell
```

Or against a local LocalAI, which needs no key:

```sh
local-ai run flux.1-dev-ggml                     # or any image model in its gallery
php tools/seed-demo-shop.php --site=... --ai-images=http://localhost:8081
```

The two families of endpoint disagree on one field: OpenAI and LocalAI take `size`, Together and
fal take `width`/`height`. The client tries one, falls back to the other, and remembers which
answered, so the URL is the only thing that has to be right.

**The key** is read from `DEMO_IMAGE_API_KEY` rather than taken as an option, so it stays out of
the shell history and out of anything that logs a command line. Export it in your own shell.

Two things make that practical rather than an overnight job:

- **One image per kind of product, not per product.** "Cast Iron Skillet — 24 cm" and "Copper
  Skillet — 26 cm" are the same photograph as far as a listing is concerned, so a 300-product shop
  needs 48 images. At roughly 20 seconds each on a CPU that is about a quarter of an hour, against
  nearly two hours for one per product.
- **Cached on disk by prompt**, under `tools/cache/images` (git-ignored). A second run costs
  nothing, and the cache can be copied between machines.

Anything that goes wrong falls back to the drawn tile: no server, a timeout, an unexpected
response. A fixture must not fail because an optional service is not running.

### What the output actually looks like

Tried against LocalAI's all-in-one CPU image, which ships Stable Diffusion 1.5 quantised:

- **The results are usable.** A chelsea boot and a frying pan both came back as credible catalogue
  photographs on a plain ground.
- **The prompt has to be short.** The first version named the department, the angle and a style
  phrase, and produced an extreme close-up of a texture rather than the object. Subject first,
  ground second, a short negative list. That is what is written above.
- **Colour names are approximate.** "Tan" came back orange. Good enough for a variant to look
  different from its siblings, not good enough to match a swatch.
- **On a CPU it is 10-13 minutes per image.** One per kind of product is a long evening; one per
  product and variant is not worth attempting.

Note LocalAI defaults to port 8080, which is where the local Joomla stack already listens — run it
elsewhere and pass the URL.

### Why not locally, on this machine

The Radeon Pro 5500M is unreachable from a container: Docker on macOS has no GPU passthrough, and
LocalAI publishes a `darwin-arm64` build only. Native Mac tools that do use Metal (Draw Things has
an HTTP server on port 7860) are written for Apple Silicon, and the consistent advice is that
Intel Macs get little acceleration. Even a good outcome there is minutes per image, against
roughly a second on a hosted endpoint, and a build to maintain.

The cache is keyed by prompt, so this is not a lock-in: images generated anywhere drop into
`tools/cache/images` and are picked up.

### Choosing a hosted endpoint

Costs for the ~1,200 images a full run wants (one per kind of product, per colour variant, per
category, plus second views):

| Endpoint | Model | Per image | ~1,200 images |
|---|---|---|---|
| Together | FLUX.1-schnell | ~$0.003 | ~$4 |
| fal | FLUX.1-schnell | ~$0.025 | ~$30 |
| Replicate | FLUX.1-schnell | ~$0.03-0.05 | ~$36-60 |

FLUX.1-schnell is worth preferring over Stable Diffusion beyond the price: it is Apache 2.0, so
its output carries no use restriction. That matters if this ever becomes HikaShop's sample data
and the photographs ship to customers — SD 1.5's OpenRAIL-M licence does attach conditions.

### No faker dependency

The obvious candidate (`xefi/faker-php`) generates person names and Latin lorem, not product
names, so the catalogue has to be written by hand either way; and it pins PHP to `>=8.3 <8.6`,
which is a ceiling to inherit for a fixture script. `demo-catalogue.php` holds the vocabulary, so
the shop can be re-themed without touching the generator.
