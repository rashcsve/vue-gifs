# syntax=docker/dockerfile:1

# Node version matches .nvmrc
FROM node:22.19.0-alpine AS deps
WORKDIR /app
# No .git in the image, so skip husky's prepare hook (other install scripts still run)
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci

# Dev server; docker-compose.yml bind-mounts the source over /app
FROM deps AS dev
# Vite's server.open has no browser to open inside the container
ENV BROWSER=none
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
# No secrets at build time: the GIPHY key is only read by the /api/gifs proxy at runtime
RUN npm run build

# Local preview only, not a production image: it keeps devDependencies because `vite preview` needs vite.
# vite.config.ts serves the /api/gifs proxy (netlify/functions/gifs/gifs.ts, which imports src/config).
# GIPHY_API_KEY comes from docker-compose.yml's env_file at runtime, never from an image layer.
FROM deps AS preview
COPY vite.config.ts ./
COPY netlify ./netlify
COPY src/config ./src/config
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD ["npm", "run", "preview"]
