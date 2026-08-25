FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p data && chmod 777 data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
