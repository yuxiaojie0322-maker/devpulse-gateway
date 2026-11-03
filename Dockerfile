FROM python:3.11-slim

WORKDIR /app

# 安装必要依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    psmisc \
    procps \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["python", "main.py"]

