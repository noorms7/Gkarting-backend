export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    emailVerifySecret: process.env.JWT_EMAIL_VERIFY_SECRET,
    emailVerifyExpiresIn: process.env.JWT_EMAIL_VERIFY_EXPIRES_IN || '1d',
    resetPasswordSecret: process.env.JWT_RESET_PASSWORD_SECRET,
    resetPasswordExpiresIn: process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '1h',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    fromName: process.env.MAIL_FROM_NAME || 'GKarting',
    fromAddress: process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    trackLatitude: parseFloat(process.env.TRACK_LATITUDE || '34.4361'),
    trackLongitude: parseFloat(process.env.TRACK_LONGITUDE || '35.8497'),
  },

  weather: {
    apiKey: process.env.WEATHER_API_KEY,
    baseUrl:
      process.env.WEATHER_API_BASE_URL ||
      'https://api.openweathermap.org/data/2.5',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@gkarting.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  },
});
