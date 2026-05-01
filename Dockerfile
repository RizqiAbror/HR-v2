# Gunakan image Node.js versi 20
FROM node:20-alpine

# Set working directory di dalam container
WORKDIR /usr/src/app

# Salin file package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Install dependencies
RUN npm install

# Salin semua source code ke dalam container
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Buka port 3000
EXPOSE 3000

# Command untuk menjalankan aplikasi
CMD ["npm", "start"]
