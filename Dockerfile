FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Copiar código fuente
COPY . .

# Asegurar directorio para audios generados
RUN mkdir -p public/audio

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
