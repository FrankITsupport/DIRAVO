# DIRAVO brand assets

Extracted from the vector artwork in `client data/DIRAVO ENGAGEMENTS HOUSE LOGOS.pdf`. The original client documents remain excluded from Git; these selected website assets can be committed with the website.

## Logos

- `brand/logo-horizontal.svg`: navy and gold, for light backgrounds and the main header.
- `brand/logo-horizontal-light.svg`: white and gold, for navy or other dark backgrounds.
- `brand/logo-stacked.svg`: stacked navy and gold layout.
- `brand/logo-stacked-light.svg`: stacked layout for dark backgrounds.
- `brand/symbol.svg`: the standalone navy and gold symbol.
- `brand/symbol-light.svg`: the standalone symbol for dark backgrounds.

The SVGs retain the PDF's vector paths and have transparent backgrounds with the surrounding page whitespace removed. Navy is `#102949` and gold is `#be8f37`. Display the full logo at a size where its smaller company-name line remains readable.

## Browser and device icons

The favicon uses the standalone symbol on a square white background for visibility in both light and dark browser interfaces.

- `favicons/favicon.svg`: scalable browser favicon.
- `favicons/favicon.ico`: includes 16, 32, and 48 pixel images.
- `favicons/favicon-16.png`, `favicon-32.png`, `favicon-48.png`: small PNG variants.
- `favicons/apple-touch-icon.png`: 180 pixel Apple touch icon.
- `favicons/favicon-192.png`, `favicon-512.png`: larger square icons.

Favicon links are included in the website HTML.

## Website integration

The logo and favicon variants are now linked in `index.html`. Photographs in `images/` are resized WebP derivatives of the client's originals, with responsive sizes for the hero, project gallery and confirmed team portraits. The self-hosted Manrope variable font is in `fonts/`, alongside its SIL Open Font License.

`images/hero-workshop.webp` and `images/hero-workshop-900.webp` are AI-generated decorative background imagery showing professional training and stakeholder engagement. They were generated with the built-in image generation tool, and are not documentary photographs of a DIRAVO project. The generation prompt is preserved in `images/hero-workshop.prompt.md`. A responsive translucent overlay is applied in CSS to protect the hero's text and controls. The original generated PNG is retained in the ignored `client data/generated images` folder.
