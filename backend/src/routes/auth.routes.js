// ============================================
// AUTH ROUTES (auth.routes.js)
// ============================================
const express = require('express');
const router = express.Router();
const { login, register, getProfile } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/profile', verifyToken, getProfile);

module.exports = router;
