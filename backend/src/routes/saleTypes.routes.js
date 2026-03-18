const express = require('express');
const router = express.Router();
const { allAsync, runAsync } = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, async (_req, res) => {
  try {
    const rows = await allAsync(`SELECT * FROM sale_types WHERE active = 1`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { type_name, description, commission_rate } = req.body;
  try {
    await runAsync(
      `INSERT INTO sale_types (type_name, description, commission_rate) VALUES (?, ?, ?)`,
      [type_name, description, commission_rate]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { type_name, description, commission_rate, active } = req.body;
  try {
    await runAsync(
      `UPDATE sale_types SET type_name=?, description=?, commission_rate=?, active=? WHERE id=?`,
      [type_name, description, commission_rate, active, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync(`UPDATE sale_types SET active = 0 WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
