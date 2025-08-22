const authService = require('../services/authService');

// Middleware que requiere autenticación para todas las rutas
const requireAuth = async (req, res, next) => {
    try {
        // Obtener token de las cookies o headers
        const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'No autorizado', 
                message: 'Token de autenticación requerido' 
            });
        }

        // Verificar sesión
        const session = await authService.verifySession(token);
        
        if (!session) {
            return res.status(401).json({ 
                error: 'No autorizado', 
                message: 'Token inválido o expirado' 
            });
        }

        // Agregar información del usuario al request
        req.user = session.user;
        req.sessionExpiresAt = session.expiresAt;
        
        next();
    } catch (error) {
        console.error('Error en middleware de autenticación:', error);
        return res.status(500).json({ 
            error: 'Error del servidor', 
            message: 'Error verificando autenticación' 
        });
    }
};

// Middleware que requiere rol de admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            error: 'Acceso denegado', 
            message: 'Se requieren permisos de administrador' 
        });
    }
    next();
};

// Middleware que permite acceso a admin y support
const requireSupportOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'support')) {
        return res.status(403).json({ 
            error: 'Acceso denegado', 
            message: 'Se requieren permisos de soporte' 
        });
    }
    next();
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireSupportOrAdmin
};