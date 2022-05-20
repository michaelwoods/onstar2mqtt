ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache \
    nodejs \
    npm \
    git

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
COPY ["package-lock.json", "/app/"]
RUN npm install --no-fund

COPY ["src", "/app/src"]

COPY run.sh /app/
RUN chmod a+x /app/run.sh

CMD [ "/app/run.sh" ]
