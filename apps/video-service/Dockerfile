FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

# Use Debian's signed security repositories, not a third-party media binary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg=7:5.1.9-0+deb12u1 \
    && rm -rf /var/lib/apt/lists/*
RUN curl --fail --location --silent --show-error --max-time 90 \
      https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
    && echo '58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a  /usr/local/bin/yt-dlp' | sha256sum --check \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app
COPY --chown=node:node *.mjs ./
USER node
EXPOSE 8082
CMD ["node", "--max-old-space-size=128", "main.mjs"]
