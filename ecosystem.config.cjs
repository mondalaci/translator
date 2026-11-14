// Optional pm2 setup: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'translator',
      cwd: __dirname,
      script: 'npm',
      args: 'start',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
  ],
}
