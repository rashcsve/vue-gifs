# GIF SPA in Vue.js

https://shimmering-blancmange-2b1e5e.netlify.app/

An application in Vue.js using Vite, Pinia and Vue-router showing gifs via the [GIPHY API](https://developers.giphy.com/docs/api/).

## Trends

![Screenshot 2022-07-17 at 21 32 16](https://user-images.githubusercontent.com/43743508/179422023-d7c301fe-11ca-4794-9020-52ae84ed90a0.png)

## Search

![Screenshot 2022-07-17 at 21 32 33](https://user-images.githubusercontent.com/43743508/179422039-0749793e-07ec-4633-a100-9435609ac423.png)

## Project Setup

```sh
npm install
cp .env.example .env.local   # then set GIPHY_API_KEY to your free GIPHY API key
```

The key stays on the server: the app calls `/api/gifs`, a Netlify function (`netlify/functions/gifs/gifs.ts`) that adds the key. `npm run dev` and `npm run preview` serve the same function through Vite, so no Netlify CLI is needed.

### Deploy

Netlify builds from GitHub (`netlify.toml`): `main` deploys to production, and every pull request gets a deploy preview link. Set `GIPHY_API_KEY` as a secret in the site's environment variables, with the Functions scope, for the Production and Deploy Preview contexts. PRs from forks don't get secrets by default, so their previews can't load GIFs.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
