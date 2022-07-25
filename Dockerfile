FROM node:18-alpine

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
COPY ["package-lock.json", "/app/"]
<<<<<<< HEAD
RUN npm ci --omit=dev --no-fund && npm cache clean --force
=======
RUN npm ci --omit=dev --no-fund
>>>>>>> a539375ae55cd013b9fb169e3180b5f96cd6b5d0

COPY ["src", "/app/src"]

ENTRYPOINT ["npm", "run", "start"]
