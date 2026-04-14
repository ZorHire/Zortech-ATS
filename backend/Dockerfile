FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript @types/node && npx tsc && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
