// PM2 进程管理配置 — 宝塔面板 + V2.0 蓝绿部署
// 双 slot: wxgzh-api-blue (:3000) / wxgzh-api-green (:3001)
// 切换通过 /etc/nginx/slot.conf 控制的 nginx 上游实现。
module.exports = {
  apps: [
    {
      name: 'wxgzh-api-blue',
      cwd: './apps/server',
      script: 'dist/main.js',
      instances: 1, // 蓝绿单实例即可, 横向扩在 nginx upstream 层做
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        APP_PORT: '3000',
        APP_SLOT: 'blue',
      },
      error_file: '/www/wwwlogs/wxgzh-api-blue-error.log',
      out_file: '/www/wwwlogs/wxgzh-api-blue-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'wxgzh-api-green',
      cwd: './apps/server',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        APP_PORT: '3001',
        APP_SLOT: 'green',
      },
      error_file: '/www/wwwlogs/wxgzh-api-green-error.log',
      out_file: '/www/wwwlogs/wxgzh-api-green-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'wxgzh-worker',
      cwd: './apps/server',
      script: 'dist/worker.js',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/www/wwwlogs/wxgzh-worker-error.log',
      out_file: '/www/wwwlogs/wxgzh-worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
