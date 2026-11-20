'use strict';

const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');

module.exports = {
  PORT: Number(process.env.PORT || 5000),
  HOST: process.env.HOST || '127.0.0.1',
  DATA_FILE: process.env.HITAYU_DATA_FILE || path.join(__dirname, 'data', 'store.json'),
  UPLOAD_DIR: process.env.HITAYU_UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
  FRONTEND_PUBLIC_DIR: path.join(ROOT_DIR, 'frontend', 'public'),
  FRONTEND_DIST_DIR: path.join(ROOT_DIR, 'frontend', 'dist'),
  SECRET_KEY: process.env.HITAYU_SECRET_KEY || crypto.randomBytes(32).toString('hex'),
  TOKEN_TTL_SEC: Number(process.env.HITAYU_TOKEN_TTL || 60 * 60 * 24),
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  ALLOWED_IMAGE_EXTS: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  ALLOWED_VIDEO_EXTS: new Set(['.mp4', '.webm']),
  AUTH_RATE_LIMIT_MAX: Number(process.env.HITAYU_AUTH_RATE_MAX || 20),
  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.HITAYU_AUTH_RATE_WINDOW_MS || 60000),
};
