FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript @types/node && npx tsc && npm prune --omit=dev

COPY start.sh ./
RUN chmod +x start.sh

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["./start.sh"]
