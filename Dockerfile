FROM apify/actor-node:20

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --loglevel verbose

COPY . ./

CMD ["node", "main.js"]
