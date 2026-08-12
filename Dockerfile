FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash curl ca-certificates tar libatomic1 libgl1 libglib2.0-0 libx11-6 libxext6 libxrandr2 libxrender1 lib32gcc-s1 lib32stdc++6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
COPY scripts ./scripts
RUN chmod +x scripts/*.sh && useradd -m -u 10001 ets2 && mkdir -p /data && chown -R ets2:ets2 /app /data
USER ets2
ENV PORT=3000 DATA_DIR=/data ETS2_HOME="/data/Euro Truck Simulator 2" ETS2_SERVER_DIR=/data/ets2-server COOKIE_SECURE=true
VOLUME ["/data"]
EXPOSE 3000 27015/udp 27016/udp
CMD ["node", "server.mjs"]
