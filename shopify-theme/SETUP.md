# Shopify Setup (Shopify Checkout)

## 1) Add files to your theme
Copy these files into your Shopify theme code editor:

- `assets/aveli.css`
- `assets/aveli.js`
- `sections/quiet-header-nav.liquid`
- `sections/quiet-carousel.liquid`
- `sections/quiet-music.liquid`
- `sections/quiet-products.liquid`

## 2) Load CSS/JS in `layout/theme.liquid`
Before `</head>` add:

```liquid
{{ 'aveli.css' | asset_url | stylesheet_tag }}
```

Before `</body>` add:

```liquid
{{ 'aveli.js' | asset_url | script_tag }}
```

## 3) Theme editor placement
In Customize:

1. Add `Quiet Header Nav` to your header group (or top of template)
2. Add `Quiet Carousel` to homepage template
3. Add `Quiet Music` to homepage template
4. Add `Quiet Products` to homepage template

## 4) Menu setup
In Shopify Admin:
- Online Store -> Navigation
- Create/select your main menu with links:
  - home
  - product
  - archive
  - contact
  - admin
- Select that menu in `Quiet Header Nav` section setting

## 5) Upload media and tracks
- Images/videos: set in `Quiet Carousel` blocks (image/video pickers)
- Audio tracks: upload audio in `Content -> Files`, copy file URL, paste into `Quiet Music` track block `Audio file URL`

## 6) Products with Shopify checkout
- Put products into a collection (e.g. `all` or `featured`)
- Set that collection in `Quiet Products`
- `buy` button goes to Shopify cart with variant and uses Shopify checkout (not Stripe)

## Notes
- Keep product photos on product records in Shopify.
- If you want direct one-click checkout behavior instead of cart link, I can switch buttons to a dedicated checkout flow.
