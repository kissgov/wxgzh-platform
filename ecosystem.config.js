// PM2 进程管理配置 — 宝塔面板部署
module.exports = {
  apps: [
    {
      name: 'wxgzh-api',
      cwd: './apps/server',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        APP_PORT: '3000',
      },
      error_file: '/www/wwwlogs/wxgzh-api-error.log',
      out_file: '/www/wwwlogs/wxgzh-api-out.log',
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
