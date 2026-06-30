# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files for production install
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/build ./build

# Define the command to run the MCP server
ENTRYPOINT ["node", "build/index.js"]