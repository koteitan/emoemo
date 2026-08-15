[English](README.md) | [Japanese](README-ja.md)

# emoemo 🥰

Nostr のカスタム絵文字（[NIP-30](https://github.com/nostr-protocol/nips/blob/master/30.md)）を管理する Web アプリです。
emojito / emojis-iota の後継として、絵文字リスト（kind:10030）と絵文字セット（kind:30030）を作成・閲覧・編集できます。

公開URL: https://koteitan.github.io/emoemo/

## 機能

- **ログイン**: NIP-07 ブラウザ拡張（Alby, nos2x など）。未ログインでもセットの閲覧は可能。
- **絵文字セットを探す**: 最近の kind:30030 を一覧表示、NIP-50 対応リレーで検索。
- **マイ絵文字リスト（kind:10030）**: 個別の絵文字とセット参照（`a` タグ）を編集して公開。
- **絵文字セット（kind:30030）**: 作成・編集。タイトル・識別子(d)・絵文字（ショートコード + 画像URL）。
- **画像アップロード**: nostr.build へ NIP-96 / NIP-98 でアップロード、またはURL直接入力。

## 技術スタック

- TypeScript + Vite + React
- [rx-nostr](https://github.com/penpenpng/rx-nostr) でリレー通信
- [react-i18next](https://github.com/i18next/react-i18next) で日英切り替え

## 開発

```sh
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド（dist/）
```

## デプロイ

`main` ブランチへの push で GitHub Actions（`.github/workflows/deploy.yml`）がビルドして
GitHub Pages に公開します。初回のみ Pages のビルドソースを Actions に設定してください:

```sh
gh api repos/koteitan/emoemo/pages -X POST -f build_type=workflow
```

## ライセンス

[MIT](LICENSE) © koteitan
