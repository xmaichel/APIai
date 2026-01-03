# Dockerfile alternativo para EasyPanel
FROM oven/bun:latest

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN bun install

# Copiar el resto de los archivos
COPY . .

# Exponer el puerto (EasyPanel puede usar cualquier puerto, se configura en el panel)
EXPOSE 4000

# Comando para iniciar la aplicación
CMD ["bun", "run", "index.ts"]

