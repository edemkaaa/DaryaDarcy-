// Описывает прежний PM2-процесс API. Не является конфигурацией количества реплик текущего Compose.
// PM2 запускает один прежний bundle на loopback:3000; количество современных API задаётся Compose.
module.exports = {
  apps: [
    {
      name: "daryadarcy-api",
      cwd: "/var/www/daryadarcy",
      script: "dist/index.mjs",
      interpreter: "/usr/bin/node",
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "127.0.0.1",
      },
    },
  ],
};
