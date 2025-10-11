// ============================================
// AUTH CONTROLLER (auth.controller.js)
// ============================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAsync, runAsync } = require('../config/database');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    
    const user = await getAsync(
      'SELECT * FROM users WHERE username = ? AND active = 1',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

const register = async (req, res) => {
  try {
    const { username, password, full_name, role = 'vendedor' } = req.body;
    
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await getAsync('SELECT id FROM users WHERE username = ?', [username]);
    
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar usuario
    const result = await runAsync(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, full_name, role]
    );
    
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: { id: result.id, username, full_name, role }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await getAsync(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

module.exports = { login, register, getProfile };

