FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates procps && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY index.js app.js index.html ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--max-old-space-size=64", "index.js"]
