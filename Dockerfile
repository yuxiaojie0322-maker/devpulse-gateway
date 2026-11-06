FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY index.js index.html ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--max-old-space-size=64", "index.js"]
