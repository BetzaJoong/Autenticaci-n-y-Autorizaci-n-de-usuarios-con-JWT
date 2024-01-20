//_____authMiddleware_____

const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET;

const validateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token no proporcionado' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

module.exports = validateToken;
