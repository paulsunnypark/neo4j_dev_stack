# Development Dockerfile for Vite React App
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Expose Vite's default dev server port
EXPOSE 5173

# Start the Vite dev server with networking enabled for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
