FROM apify/actor-node:20

# Copy only package files first to leverage Docker cache
COPY package.json package-lock.json* ./

# Be verbose so the build watchdog sees regular output
RUN npm install --omit=dev --loglevel verbose

# Now copy the rest of the actor’s code
COPY . ./

# Default command
CMD ["node", "main.js"]
