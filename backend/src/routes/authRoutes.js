const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { db } = require('../db/database');
const { getJwtSecret } = require('../utils/jwtConfig');

const authSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or fewer")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

router.post('/register', async (req, res) => {
  try {
    const parseResult = authSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { username, password } = parseResult.data;

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    
    const token = jwt.sign(
      { id: insert.lastInsertRowid, username },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({ success: true, token, username });
  } catch (error) {
    console.error("Auth register error:", error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parseResult = authSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { username, password } = parseResult.data;

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, username: user.username });
  } catch (error) {
    console.error("Auth login error:", error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
