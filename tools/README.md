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

### No faker dependency

The obvious candidate (`xefi/faker-php`) generates person names and Latin lorem, not product
names, so the catalogue has to be written by hand either way; and it pins PHP to `>=8.3 <8.6`,
which is a ceiling to inherit for a fixture script. `demo-catalogue.php` holds the vocabulary, so
the shop can be re-themed without touching the generator.
