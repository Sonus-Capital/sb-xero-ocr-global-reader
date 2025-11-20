FROM apify/actor-node:20

# Workdir is already /usr/src/app in the base image, but set it explicitly
WORKDIR /usr/src/app

# Install only production dependencies (including pdf-parse)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --loglevel verbose

# Copy the rest of the actor source
COPY . ./

# Start the actor
CMD ["node", "main.js"]
