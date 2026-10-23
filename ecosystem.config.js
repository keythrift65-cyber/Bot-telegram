// Configuración de pm2 para mantener el bot funcionando 24/7
module.exports = {
  apps: [
    {
      name: "bot-oposiciones",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1, // Con long polling solo puede haber UNA instancia
      autorestart: true,
      // Si se cae, espera cada vez más entre reinicios (hasta 15 s) y no se rinde nunca
      exp_backoff_restart_delay: 1000,
      max_restarts: 100000,
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
