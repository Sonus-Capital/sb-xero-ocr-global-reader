FROM apify/actor-node:20

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --loglevel verbose

# Copy the rest of the actor source
COPY . ./

# Default command
CMD ["node", "main.js"]
