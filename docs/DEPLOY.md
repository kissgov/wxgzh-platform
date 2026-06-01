# 宝塔面板部署指南

## 一、环境准备

### 1. 宝塔面板安装以下软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Nginx | 1.22+ | Web 服务器 |
| PostgreSQL | 16+ | 数据库 |
| Redis | 7+ | 缓存/队列 |
| Node.js | 20.x | 后端运行时 |
| PM2 | 最新 | 进程守护 |

### 2. 安装 Node.js

宝塔 → 软件商店 → 搜索 Node.js → 安装 v20.x

### 3. 安装 PM2

```bash
npm install -g pm2
```

### 4. 安装 pnpm

```bash
npm install -g pnpm
```

---

## 二、数据库配置

### 1. PostgreSQL

宝塔 → 数据库 → PostgreSQL → 添加数据库：
- 数据库名: `wxgzh_prod`
- 用户名: `wxgzh`
- 密码: `你的密码`

### 2. Redis

宝塔 → 软件商店 → Redis → 设置密码

---

## 三、项目部署

### 1. 上传代码

将项目上传到 `/www/wwwroot/wxgzh`

### 2. 配置环境变量

```bash
cd /www/wwwroot/wxgzh
cp .env.production .env
```

编辑 `.env` 文件，修改：
- `DATABASE_URL` — 数据库密码
- `REDIS_URL` — Redis 密码
- `JWT_SECRET` — 随机 32+ 字符
- `ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `OSS_SECRET_KEY` — MinIO 密码
- `CORS_ORIGINS` — 你的域名

### 3. 执行部署

```bash
cd /www/wwwroot/wxgzh
chmod +x deploy.sh
./deploy.sh
```

---

## 四、Nginx 配置

1. 宝塔 → 网站 → 添加站点
2. 域名填写你的域名
3. 根目录选择: `/www/wwwroot/wxgzh/apps/web/dist`
4. 在「配置文件」中粘贴 `nginx.conf` 的内容

---

## 五、SSL 证书

宝塔 → 网站 → 设置 → SSL → Let's Encrypt 申请

---

## 六、验证

1. 访问 `https://your-domain.com` → 前端登录页
2. 访问 `https://your-domain.com/api/docs` → Swagger API 文档
3. 默认管理员: `admin@wxgzh.com` / `admin123`

---

## 七、日常运维

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs wxgzh-api

# 重启
pm2 restart wxgzh-api

# 更新代码后重新部署
cd /www/wwwroot/wxgzh
git pull
./deploy.sh
```

---

## 八、防火墙

宝塔 → 安全 → 放行以下端口：
- 80 (HTTP)
- 443 (HTTPS)
- 3000 (API，仅本地)
- 5432 (PostgreSQL，仅本地)
- 6379 (Redis，仅本地)
