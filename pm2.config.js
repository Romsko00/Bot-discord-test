module.exports = {
  apps: [

  {
    name: 'vns-bot-main',
    script: 'index.js',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      INSTANCE_TYPE: 'main',
      PM2: 'true'
    },
    error_file: 'logs/error-main.log',
    out_file: 'logs/out-main.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_restarts: 5,
    min_uptime: '30s',
    listen_timeout: 30000,
    kill_timeout: 10000,
    wait_ready: true,
    max_restart_delay: 10000,
    exp_backoff_restart_delay: 1000,
    instance_var: 'INSTANCE_ID',
    cron_restart: '0 */6 * * *'
  },

  {
    name: 'vns-bot-tasks',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      INSTANCE_TYPE: 'tasks',
      PM2: 'true'
    },
    error_file: 'logs/error-tasks.log',
    out_file: 'logs/out-tasks.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_restarts: 3,
    min_uptime: '1m',
    listen_timeout: 60000,
    kill_timeout: 15000,
    wait_ready: true,
    instance_var: 'INSTANCE_ID',

    cron_restart: '0 4 * * *'
  }]

};
