export default () => ({
  port: parseInt(process.env.PORT || '8000', 10),
  database_url: {
    url: process.env.DATABASE_URL,
  },
  mailgun: {
    username: process.env.MAILGUN_USERNAME || '',
    api_key: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
  },
  node_env: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDISHOST || process.env.REDIS_HOST || 'localhost',
    port:
      parseInt(process.env.REDISPORT || '6379', 10) ||
      parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || process.env.REDIS_PASSWORD,
    prefix: process.env.REDIS_PREFIX || 'autoworx:',
  },
  carApi: {
    token: process.env.CAR_API_TOKEN,
    secret: process.env.CAR_API_SECRET,
  },
  sendgrid: {
    api_key: process.env.SENDGRID_KEY,
  },
  accessSecret: process.env.ACCESS_SECRET,
  infobip: {
    baseUrl: process.env.INFOBIP_BASE_URL, // e.g. "rr7w1k.api.infobip.com"
    apiKey: process.env.INFOBIP_API_KEY,
    domain: process.env.INFOBIP_DOMAIN, // your verified domain
  },
});
