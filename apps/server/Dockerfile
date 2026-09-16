# Servidor de juego. El código TS se ejecuta con tsx (sin paso de transpilación separado),
# lo que permite resolver los paquetes del workspace (@game/config, @game/shared) tal cual.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN npm ci --omit=dev --workspace @game/server --include-workspace-root
WORKDIR /app/apps/server
EXPOSE 2567
CMD ["npm", "start"]
