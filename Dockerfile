FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY apps ./apps
COPY scripts ./scripts

RUN npm run typecheck

ENV HEADLESS=true

CMD ["npm", "run", "worker"]
