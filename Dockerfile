FROM node:12

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
COPY ["package-lock.json", "/app/"]
RUN npm install --no-fund

COPY ["src", "/app/src"]

ENTRYPOINT ["npm", "run", "start"]
