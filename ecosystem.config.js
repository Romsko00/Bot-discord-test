module.exports = {
  apps: [{
    name: 'zoom-bot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1536M',
    node_args: '--max_old_space_size=2048',


    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      PM2: 'true',
      NODE_OPTIONS: '--max_old_space_size=2048'
    },


    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    time: true,


    max_restarts: 10,
    min_uptime: '30s',
    listen_timeout: 60000,
    kill_timeout: 5000,
    wait_ready: true,
    max_restart_delay: 5000,
    min_restart_delay: 1000,


    watch: false,
    ignore_watch: [
    'node_modules',
    'logs',
    '.git',
    '.github',
    '.vscode',
    '*.log',
    '*.md',
    '*.txt',
    '*.json',
    '*.yaml',
    '*.yml'],



    instance_var: 'INSTANCE_ID',
    cron_restart: '0 */6 * * *',
    restart_delay: 5000,
    exp_backoff_restart_delay: 1000,


    interpreter_args: '--max-http-header-size=16384'
  }]
};
