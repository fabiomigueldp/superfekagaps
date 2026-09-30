# Nunito HUD font

Genuine Nunito from the official Google Fonts repository, self-hosted under the
SIL Open Font License 1.1. The unmodified original license is `Nunito-OFL.txt`.

- Source: https://github.com/google/fonts/blob/main/ofl/nunito/Nunito%5Bwght%5D.ttf
- Original Git blob SHA: `2ec1f4b0676c83ef33049db87b311171699e9192`
- Source license: https://github.com/google/fonts/blob/main/ofl/nunito/OFL.txt
- License Git blob SHA: `c8210f08ca3cece05b4f7baa428afe8e1abe3293`
- Retrieved: 2026-09-30 via the authorized GitHub connector

`nunito-latin-portuguese-600-900.woff2` is one variable, upright font supporting
all weights from 600 through 900, including semibold (600), bold (700),
extrabold (800), and black (900). It is 52,348 bytes.

The subset includes Basic Latin, Latin-1, available combining accents, common
punctuation, and selected additional Latin characters and symbols. Portuguese
precomposed uppercase/lowercase accents, numerals, bullets, typographic quotes,
en/em dashes, and ellipsis were verified against the final WOFF2 character map.

Prepared with fontTools 4.61.1: subset the original variable TTF, keep its weight
axis from 600 to 900 with default 600, remove TrueType hints, preserve standard
layout features and English naming/license metadata, then compress as WOFF2
using Brotli font mode and quality 11. This is a font subset, not a replacement
or synthetic-weight fallback. The source TTF remains unmodified upstream.

```css
@font-face {
  font-family: 'Nunito';
  src: url('/assets/world/fonts/nunito-latin-portuguese-600-900.woff2') format('woff2');
  font-style: normal;
  font-weight: 600 900;
  font-display: swap;
}
```

WOFF2 SHA-256:
`35909fcc443b9e2ead21e4b6bcb68866e24c8dd4cc097d7844b2793a504b97cc`
