FROM node:22-bookworm-slim

# Install additional dependencies for enhanced browser capabilities
RUN apt-get update && apt-get install -y \
    # Dependencies for Chromium with stealth capabilities
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    # Fonts for better rendering
    fonts-liberation \
    fonts-noto-color-emoji \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN mkdir /app
WORKDIR /app

COPY ["package.json", "/app/"]
COPY ["package-lock.json", "/app/"]
RUN npm -v
RUN npm update -g --no-fund
RUN npm -v
RUN npm ci --omit=dev --no-fund --legacy-peer-deps
RUN npx patchright install chromium --with-deps

COPY ["src", "/app/src"]

# Set environment variables for browser optimization
ENV PATCHRIGHT_BROWSER_PATH=/usr/bin/chromium-browser
ENV PATCHRIGHT_SKIP_BROWSER_DOWNLOAD=1

ENTRYPOINT ["npm", "run", "start"]
