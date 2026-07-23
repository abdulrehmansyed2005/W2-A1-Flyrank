# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine

# Create app directory inside the container
WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the rest of the source
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
