FROM node:12

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
RUN npm install

COPY ["src", "/app/src"]

ENTRYPOINT ["npm", "run", "start"]
