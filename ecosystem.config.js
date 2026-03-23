module.exports = {
  apps: [
    {
      name: 'mealie-gcal-sync',
      script: './sync_master.js',
      cron_restart: '0 * * * *',
      autorestart: false,
      watch: false,
    },
  ],
};
