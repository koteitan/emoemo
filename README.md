[English](README.md) | [Japanese](README-ja.md)

# emoemo 🥰

A web app to manage Nostr custom emoji ([NIP-30](https://github.com/nostr-protocol/nips/blob/master/30.md)).
As a successor to emojito / emojis-iota, you can create, browse, and edit your emoji list
(kind:10030) and emoji sets (kind:30030).

Live: https://koteitan.github.io/emoemo/

## Features

- **Login**: NIP-07 browser extension (Alby, nos2x, etc.). Browsing sets works without login.
- **Find emoji sets**: list recent kind:30030 and search via NIP-50 relays.
- **My emoji list (kind:10030)**: edit and publish individual emoji and set references (`a` tags).
- **Emoji sets (kind:30030)**: create and edit — title, identifier (d), emoji (shortcode + image URL).
- **Image upload**: upload to nostr.build via NIP-96 / NIP-98, or paste an image URL.

## Tech stack

- TypeScript + Vite + React
- [rx-nostr](https://github.com/penpenpng/rx-nostr) for relay communication
- [react-i18next](https://github.com/i18next/react-i18next) for ja/en switching

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # production build (dist/)
```

## Deploy

Pushing to the `main` branch triggers GitHub Actions (`.github/workflows/deploy.yml`) to build
and publish to GitHub Pages. The first time only, set the Pages build source to Actions:

```sh
gh api repos/koteitan/emoemo/pages -X POST -f build_type=workflow
```

## License

[MIT](LICENSE) © koteitan
