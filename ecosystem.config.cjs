// pm2 start ecosystem.config.cjs
//
// Running tsx directly rather than through `npm start` keeps one process between
// pm2 and the server: no npm wrapper to swallow reload signals, and the restart
// counters mean something.
module.exports = {
  apps: [
    {
      name: 'translator',
      cwd: __dirname,
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'server/index.ts',
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
  ],
}
