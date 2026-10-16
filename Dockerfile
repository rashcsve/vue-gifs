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
# .env.local is mounted as a BuildKit secret so the key never lands in an image layer.
# Vite still inlines it into dist/ (moved server-side in PLAN step 13).
# required=true: without .env.local the build fails instead of shipping an app with no key.
RUN --mount=type=secret,id=env_local,target=/app/.env.local,required=true npm run build

# Local preview only, not a production image: it keeps devDependencies because `vite preview` needs vite
FROM deps AS preview
COPY vite.config.ts ./
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD ["npm", "run", "preview"]
