FROM apify/actor-node:3.5.2

COPY package.json package-lock.json* ./
RUN npm install --only=prod

COPY . ./

CMD ["npm", "start"]
