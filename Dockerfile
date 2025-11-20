FROM apify/actor-node:18

COPY package.json package-lock.json* ./
RUN npm install --only=prod

COPY . ./

CMD ["npm", "start"]
