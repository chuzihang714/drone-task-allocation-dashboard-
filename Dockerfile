# 1. 基础镜像
FROM node:20-alpine AS builder

WORKDIR /app

# 2. 安装依赖并编译打包
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 3. 运行镜像
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# 暴露端口 3000
EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "run", "start"]