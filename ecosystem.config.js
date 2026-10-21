// Configuración de pm2 para mantener el bot funcionando 24/7
module.exports = {
  apps: [
    {
      name: "bot-oposiciones",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1, // Con long polling solo puede haber UNA instancia
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
  ],
};
