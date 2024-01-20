const { Pool } = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 

require('dotenv').config();

//Agrego mis Middlewares
const morganMiddleware = require('./middlewares/morganMiddleware');
const corsMiddleware = require('./middlewares/corsMiddleware');
const validateToken = require('./middlewares/authMiddleware');

const app = express();
const port = 3000;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const secretKey = process.env.JWT_SECRET;

app.use(bodyParser.json());
app.use(morganMiddleware);
app.use(corsMiddleware);

// Ruta para realizar login y generar token JWT
app.post('/login', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [req.body.email]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Correo electrónico no registrado' });
        }

        const validPassword = await bcrypt.compare(req.body.password, rows[0].password);

        if (validPassword) {
            // Generar un token JWT sin expiración
            const token = jwt.sign({ email: req.body.email, rol: rows[0].rol, lenguage: rows[0].lenguage }, secretKey);

            // Enviar el token como parte de la respuesta
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Ruta para registrar nuevos usuarios
app.post('/usuarios', async (req, res) => {
    try {
        if (!req.body || !req.body.password || !req.body.email || req.body.rol === 'valor_predeterminado' || req.body.lenguage === 'valor_predeterminado') {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        // Verificar si el correo electrónico ya está registrado
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE email = $1', [req.body.email]);

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }

        // Cifrar la contraseña
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const newUser = await pool.query('INSERT INTO usuarios (email, password, rol, lenguage) VALUES ($1, $2, $3, $4) RETURNING *', [req.body.email, hashedPassword, req.body.rol, req.body.lenguage]);

        // Generar un token JWT y devolverlo al cliente
        const token = jwt.sign({ email: req.body.email, rol: req.body.rol, lenguage: req.body.lenguage }, secretKey, { expiresIn: '1h' });

        res.json({ token, user: newUser.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


// Ruta para obtener datos de usuario autenticado
app.get('/usuarios', validateToken, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT email, rol, lenguage FROM usuarios WHERE email = $1', [req.user.email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


// Ruta para obtener la lista completa de usuarios (sin autenticación)
app.get('/todos-los-usuarios', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT email, rol, lenguage FROM usuarios');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' });
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});




