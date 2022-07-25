FROM node:18-alpine

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
COPY ["package-lock.json", "/app/"]
RUN npm ci --omit=dev --no-fund && npm cache clean --force

COPY ["src", "/app/src"]

ENTRYPOINT ["npm", "run", "start"]
