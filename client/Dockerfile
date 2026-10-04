FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
# `vite preview` serves the built app and proxies /api to the backend (see vite.config.ts).
CMD ["npx", "vite", "preview", "--host"]
