FROM node:lts
WORKDIR /codethreat-sast-cli
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
