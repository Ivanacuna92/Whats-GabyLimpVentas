const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const logger = require('../services/logger');
const humanModeManager = require('../services/humanModeManager');
const salesManager = require('../services/salesManager');
const conversationAnalyzer = require('../services/conversationAnalyzer');
const authService = require('../services/authService');
const csvService = require('../services/csvService');
const { requireAuth, requireAdmin, requireSupportOrAdmin } = require('../middleware/auth');
const ViteExpress = require('vite-express');

class WebServer {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: true,
            credentials: true
        }));
        this.app.use(express.json());
        this.app.use(cookieParser());
        
        // En producción, servir archivos estáticos de React build
        if (process.env.NODE_ENV === 'production') {
            this.app.use(express.static(path.join(__dirname, '../../dist')));
        }
    }

    setupRoutes() {
        // ===== RUTAS PÚBLICAS DE AUTENTICACIÓN =====
        
        // Endpoint para obtener código QR de WhatsApp
        this.app.get('/api/qr', (req, res) => {
            try {
                const bot = global.whatsappBot;
                if (!bot || !bot.currentQR) {
                    return res.json({ 
                        qr: null, 
                        message: 'No hay código QR disponible. El bot puede estar ya conectado o reiniciándose.' 
                    });
                }
                
                res.json({ 
                    qr: bot.currentQR,
                    message: 'Escanea este código con WhatsApp'
                });
            } catch (error) {
                console.error('Error obteniendo QR:', error);
                res.status(500).json({ error: 'Error obteniendo código QR' });
            }
        });
        
        // Endpoint para cerrar sesión y generar nuevo QR
        this.app.post('/api/logout', async (req, res) => {
            try {
                const bot = global.whatsappBot;
                if (!bot) {
                    return res.status(400).json({ 
                        success: false,
                        message: 'Bot no está inicializado' 
                    });
                }
                
                const result = await bot.logout();
                
                if (result) {
                    res.json({ 
                        success: true,
                        message: 'Sesión cerrada. Nuevo QR disponible en 2 segundos.' 
                    });
                } else {
                    res.status(500).json({ 
                        success: false,
                        message: 'Error al cerrar sesión' 
                    });
                }
            } catch (error) {
                console.error('Error en logout:', error);
                res.status(500).json({ 
                    success: false,
                    error: 'Error al procesar logout' 
                });
            }
        });
        
        // Página HTML para mostrar el QR
        this.app.get('/qr', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 2rem;
                            border-radius: 10px;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                            text-align: center;
                        }
                        h1 { color: #333; margin-bottom: 1rem; }
                        #qrcode { margin: 20px auto; }
                        #status { 
                            padding: 10px; 
                            border-radius: 5px; 
                            margin-top: 10px;
                        }
                        .success { background: #4caf50; color: white; }
                        .waiting { background: #ff9800; color: white; }
                        .error { background: #f44336; color: white; }
                    </style>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                </head>
                <body>
                    <div class="container">
                        <h1>WhatsApp QR Code</h1>
                        <div id="qrcode"></div>
                        <div id="status" class="waiting">Cargando código QR...</div>
                        <button onclick="resetSession()" style="margin-top: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                            🔄 Reiniciar Sesión
                        </button>
                    </div>
                    
                    <script>
                        let qrcode = null;
                        
                        async function resetSession() {
                            if (confirm('¿Estás seguro de que quieres reiniciar la sesión de WhatsApp?')) {
                                try {
                                    const response = await fetch('/api/logout', { method: 'POST' });
                                    const data = await response.json();
                                    
                                    const statusEl = document.getElementById('status');
                                    if (data.success) {
                                        statusEl.textContent = 'Reiniciando sesión... Espera el nuevo QR';
                                        statusEl.className = 'waiting';
                                        // Esperar 3 segundos antes de verificar el nuevo QR
                                        setTimeout(checkQR, 3000);
                                    } else {
                                        statusEl.textContent = 'Error: ' + data.message;
                                        statusEl.className = 'error';
                                    }
                                } catch (error) {
                                    document.getElementById('status').textContent = 'Error: ' + error.message;
                                    document.getElementById('status').className = 'error';
                                }
                            }
                        }
                        
                        async function checkQR() {
                            try {
                                const response = await fetch('/api/qr');
                                const data = await response.json();
                                
                                const statusEl = document.getElementById('status');
                                const qrEl = document.getElementById('qrcode');
                                
                                if (data.qr) {
                                    statusEl.textContent = 'Escanea el código con WhatsApp';
                                    statusEl.className = 'waiting';
                                    
                                    if (qrcode) {
                                        qrcode.clear();
                                        qrcode.makeCode(data.qr);
                                    } else {
                                        qrcode = new QRCode(qrEl, {
                                            text: data.qr,
                                            width: 256,
                                            height: 256
                                        });
                                    }
                                } else {
                                    if (qrcode) {
                                        qrcode.clear();
                                        qrcode = null;
                                    }
                                    qrEl.innerHTML = '';
                                    statusEl.textContent = data.message || 'Bot conectado o reiniciándose';
                                    statusEl.className = 'success';
                                }
                            } catch (error) {
                                document.getElementById('status').textContent = 'Error: ' + error.message;
                                document.getElementById('status').className = 'error';
                            }
                        }
                        
                        // Verificar cada 3 segundos
                        checkQR();
                        setInterval(checkQR, 3000);
                    </script>
                </body>
                </html>
            `);
        });
        
        // Login
        this.app.post('/api/auth/login', async (req, res) => {
            try {
                const { email, password } = req.body;
                
                if (!email || !password) {
                    return res.status(400).json({ 
                        error: 'Email y contraseña son requeridos' 
                    });
                }

                const loginResult = await authService.login(email, password);
                
                // Establecer cookie httpOnly
                res.cookie('auth_token', loginResult.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    expires: loginResult.expiresAt
                });

                res.json({
                    success: true,
                    user: loginResult.user,
                    expiresAt: loginResult.expiresAt
                });
            } catch (error) {
                res.status(401).json({ 
                    error: 'Error de autenticación', 
                    message: error.message 
                });
            }
        });

        // Logout
        this.app.post('/api/auth/logout', async (req, res) => {
            try {
                const token = req.cookies?.auth_token;
                if (token) {
                    await authService.logout(token);
                }
                
                res.clearCookie('auth_token');
                res.json({ success: true });
            } catch (error) {
                console.error('Error en logout:', error);
                res.status(500).json({ error: 'Error cerrando sesión' });
            }
        });

        // Verificar sesión actual
        this.app.get('/api/auth/me', requireAuth, (req, res) => {
            res.json({
                user: req.user,
                expiresAt: req.sessionExpiresAt
            });
        });

        // ===== TODAS LAS DEMÁS RUTAS REQUIEREN AUTENTICACIÓN =====
        this.app.use('/api', requireAuth);

        // API endpoint para obtener logs
        this.app.get('/api/logs/:date?', async (req, res) => {
            try {
                const date = req.params.date || null;
                const logs = await logger.getLogs(date);
                res.json(Array.isArray(logs) ? logs : []);
            } catch (error) {
                console.error('Error obteniendo logs:', error);
                res.status(500).json([]);
            }
        });

        // API endpoint para obtener fechas disponibles
        this.app.get('/api/dates', async (req, res) => {
            try {
                const dates = await logger.getAvailableDates();
                res.json(Array.isArray(dates) ? dates : []);
            } catch (error) {
                console.error('Error obteniendo fechas:', error);
                res.status(500).json([]);
            }
        });

        // API endpoint para estadísticas
        this.app.get('/api/stats/:date?', async (req, res) => {
            try {
                const date = req.params.date || null;
                const logs = await logger.getLogs(date);
                
                const stats = this.calculateStats(logs);
                res.json(stats);
            } catch (error) {
                console.error('Error obteniendo estadísticas:', error);
                res.status(500).json({ error: 'Error obteniendo estadísticas' });
            }
        });

        // API endpoint para conversaciones por usuario
        this.app.get('/api/conversations/:userId/:date?', async (req, res) => {
            try {
                const { userId, date } = req.params;
                const logs = await logger.getLogs(date);
                
                const userLogs = logs.filter(log => log.userId === userId);
                
                // Formatear mensajes para incluir mensajes de sistema
                const formattedLogs = userLogs.map(log => {
                    // Detectar mensajes de finalización de sesión
                    if (log.type === 'BOT' && log.message && log.message.includes('⏰') && log.message.includes('sesión')) {
                        return {
                            ...log,
                            type: 'SYSTEM',
                            isSessionEnd: true
                        };
                    }
                    return log;
                });
                
                res.json(formattedLogs);
            } catch (error) {
                console.error('Error obteniendo conversaciones:', error);
                res.status(500).json({ error: 'Error obteniendo conversaciones' });
            }
        });

        // API endpoints para gestión de modo humano
        this.app.get('/api/human-states', async (req, res) => {
            try {
                const humanStates = await humanModeManager.getAllHumanStates();
                res.json(humanStates);
            } catch (error) {
                console.error('Error obteniendo estados humanos:', error);
                res.status(500).json({ error: 'Error obteniendo estados humanos' });
            }
        });

        this.app.post('/api/human-states', (req, res) => {
            try {
                const { phone, isHumanMode, mode } = req.body;
                
                if (!phone) {
                    return res.status(400).json({ error: 'Phone number is required' });
                }
                
                // Si se proporciona un modo específico (support, human, ai)
                if (mode) {
                    humanModeManager.setMode(phone, mode === 'ai' ? false : mode);
                    const modeText = mode === 'support' ? 'SOPORTE' : mode === 'human' ? 'HUMANO' : 'IA';
                    logger.log('SYSTEM', `Modo ${modeText} establecido para ${phone}`);
                    
                    res.json({ 
                        success: true, 
                        phone, 
                        mode,
                        isHumanMode: mode === 'human',
                        message: `Modo ${modeText} activado para ${phone}`
                    });
                } else {
                    // Compatibilidad con el método anterior
                    humanModeManager.setHumanMode(phone, isHumanMode);
                    logger.log('SYSTEM', `Modo ${isHumanMode ? 'HUMANO' : 'IA'} establecido para ${phone}`);
                    
                    res.json({ 
                        success: true, 
                        phone, 
                        isHumanMode,
                        message: `Modo ${isHumanMode ? 'HUMANO' : 'IA'} activado para ${phone}`
                    });
                }
            } catch (error) {
                console.error('Error actualizando estado humano:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        this.app.delete('/api/human-states/:phone', (req, res) => {
            try {
                const { phone } = req.params;
                humanModeManager.removeContact(phone);
                logger.log('SYSTEM', `Contacto ${phone} removido de gestión humana`);
                
                res.json({ 
                    success: true, 
                    message: `Contacto ${phone} removido`
                });
            } catch (error) {
                console.error('Error removiendo contacto:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        // API endpoint para obtener reportes con información de ventas
        this.app.get('/api/reports/:date?', async (req, res) => {
            try {
                let dateParam = req.params.date || 'all';
                let logs = [];
                
                // Manejar diferentes tipos de fecha
                if (dateParam === 'all') {
                    // Obtener TODOS los logs de la BD sin filtro de fecha
                    logs = await logger.getLogs(null, 10000); // null = sin filtro de fecha, 10000 = límite alto
                } else if (dateParam === 'month') {
                    // Obtener todos los logs del mes actual
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    
                    // Obtener todos los días del mes
                    const daysInMonth = new Date(year, today.getMonth() + 1, 0).getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
                        const dayLogs = await logger.getLogs(dateStr);
                        logs = logs.concat(dayLogs);
                    }
                } else if (dateParam === 'week') {
                    // Obtener logs de la última semana
                    const today = new Date();
                    for (let i = 0; i < 7; i++) {
                        const date = new Date(today);
                        date.setDate(date.getDate() - i);
                        const dateStr = date.toISOString().split('T')[0];
                        const dayLogs = await logger.getLogs(dateStr);
                        logs = logs.concat(dayLogs);
                    }
                } else if (dateParam === 'today') {
                    const date = new Date().toISOString().split('T')[0];
                    logs = await logger.getLogs(date);
                } else if (dateParam === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const date = yesterday.toISOString().split('T')[0];
                    logs = await logger.getLogs(date);
                } else {
                    // Fecha específica
                    logs = await logger.getLogs(dateParam);
                }
                const salesData = await salesManager.getAllSalesData();
                const humanStates = await humanModeManager.getAllHumanStates();
                
                // Agrupar conversaciones por usuario
                const conversationsByUser = {};
                
                logs.forEach(log => {
                    if (!log.userId) return;
                    
                    // Obtener fecha del log
                    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                    
                    if (!conversationsByUser[log.userId]) {
                        conversationsByUser[log.userId] = {
                            id: '',
                            telefono: log.userId,
                            fecha: logDate,
                            hora: '',
                            mensajes: 0,
                            posibleVenta: false,
                            ventaCerrada: false,
                            citaAgendada: false,
                            soporteActivado: false,
                            modoHumano: false,
                            conversacion: [],
                            primerMensaje: null,
                            ultimoMensaje: null
                        };
                    }
                    
                    const conv = conversationsByUser[log.userId];
                    
                    // Contar mensajes (incluir todos los tipos relevantes)
                    if (log.type === 'USER' || log.type === 'BOT' || log.type === 'HUMAN' || 
                        log.role === 'cliente' || log.role === 'bot' || log.role === 'soporte') {
                        conv.mensajes++;
                        conv.conversacion.push({
                            type: log.type,
                            role: log.role,
                            message: log.message,
                            timestamp: log.timestamp
                        });
                        
                        // Registrar primer y último mensaje
                        if (!conv.primerMensaje) {
                            conv.primerMensaje = log.timestamp;
                            conv.hora = new Date(log.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                        conv.ultimoMensaje = log.timestamp;
                    }
                    
                    // Detectar si hubo soporte o modo humano
                    if (log.type === 'HUMAN' || log.role === 'soporte') {
                        conv.soporteActivado = true;
                    }
                    if (log.type === 'SYSTEM' && log.message && log.message.includes('Modo SOPORTE activado')) {
                        conv.soporteActivado = true;
                    }
                    if (log.type === 'SYSTEM' && log.message && log.message.includes('Modo HUMANO establecido')) {
                        conv.modoHumano = true;
                    }
                });
                
                // Generar reportes finales
                const reports = [];
                let idCounter = 1;
                
                for (const [userId, conv] of Object.entries(conversationsByUser)) {
                    // Generar ID único para la conversación usando la fecha real del log
                    const conversationId = salesManager.generateConversationId(userId, conv.fecha);
                    conv.id = `${conv.fecha}-${String(idCounter).padStart(3, '0')}`;
                    
                    // Obtener estado de ventas (AWAIT es crítico aquí)
                    const saleStatus = await salesManager.getSaleStatus(conversationId);
                    conv.posibleVenta = saleStatus.posibleVenta || false;
                    conv.ventaCerrada = saleStatus.ventaCerrada || saleStatus.analizadoIA || false;
                    conv.analizadoIA = saleStatus.analizadoIA || false;
                    conv.citaAgendada = saleStatus.citaAgendada || false;
                    
                    console.log(`Estado cargado para ${userId}:`, {
                        posibleVenta: conv.posibleVenta,
                        analizadoIA: conv.analizadoIA,
                        citaAgendada: conv.citaAgendada
                    });
                    
                    // Verificar estado actual de modo humano/soporte
                    const currentMode = humanModeManager.getMode(userId);
                    if (currentMode === 'support') {
                        conv.soporteActivado = true;
                    } else if (currentMode === 'human' || currentMode === true) {
                        conv.modoHumano = true;
                    }
                    
                    reports.push(conv);
                    idCounter++;
                }
                
                // Ordenar por hora de primer mensaje
                reports.sort((a, b) => {
                    if (a.primerMensaje && b.primerMensaje) {
                        return new Date(a.primerMensaje) - new Date(b.primerMensaje);
                    }
                    return 0;
                });
                
                res.json(reports);
            } catch (error) {
                console.error('Error generando reportes:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        // API endpoint para actualizar estado de venta
        this.app.post('/api/reports/sale-status', async (req, res) => {
            try {
                const { conversationId, phone, date, posibleVenta, ventaCerrada, citaAgendada, notas } = req.body;
                
                let id = conversationId;
                if (!id && phone && date) {
                    id = salesManager.generateConversationId(phone, date);
                }
                
                if (!id) {
                    return res.status(400).json({ error: 'Se requiere conversationId o phone y date' });
                }
                
                // Guardar en la base de datos usando setSaleStatus
                const result = await salesManager.setSaleStatus(id, {
                    posibleVenta,
                    ventaCerrada,
                    citaAgendada,
                    notas
                });
                
                res.json({ success: true, data: result });
            } catch (error) {
                console.error('Error actualizando estado de venta:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        // API endpoint para obtener estadísticas de ventas
        this.app.get('/api/sales-stats/:date?', (req, res) => {
            try {
                const date = req.params.date || null;
                const stats = salesManager.getSalesStats(date);
                res.json(stats);
            } catch (error) {
                console.error('Error obteniendo estadísticas de ventas:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        // API endpoint para analizar conversación con IA
        this.app.post('/api/analyze-conversation', async (req, res) => {
            try {
                const { messages } = req.body;
                
                if (!messages || !Array.isArray(messages)) {
                    return res.status(400).json({ error: 'Se requiere un array de mensajes' });
                }
                
                const analysis = await conversationAnalyzer.analyzeConversation(messages);
                res.json(analysis);
            } catch (error) {
                console.error('Error analizando conversación:', error);
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        });

        // ===== ENDPOINTS DE GESTIÓN DE CSV (SOLO ADMIN) =====
        
        // Configurar multer para subida de archivos
        const upload = multer({ 
            limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                    cb(null, true);
                } else {
                    cb(new Error('Solo se permiten archivos CSV'));
                }
            }
        });

        // Subir archivo CSV
        this.app.post('/api/csv/upload', requireAdmin, upload.single('csv'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No se proporcionó archivo CSV' });
                }

                const result = await csvService.saveCSV(
                    req.file.originalname,
                    req.file.buffer.toString('utf8')
                );

                res.json(result);
            } catch (error) {
                console.error('Error subiendo CSV:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Listar archivos CSV subidos
        this.app.get('/api/csv/list', requireAdmin, async (req, res) => {
            try {
                const files = await csvService.listCSVFiles();
                res.json({ files });
            } catch (error) {
                console.error('Error listando CSVs:', error);
                res.status(500).json({ error: 'Error obteniendo lista de archivos' });
            }
        });

        // Eliminar archivo CSV
        this.app.delete('/api/csv/delete/:filename', requireAdmin, async (req, res) => {
            try {
                const result = await csvService.deleteCSV(req.params.filename);
                res.json(result);
            } catch (error) {
                console.error('Error eliminando CSV:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Descargar plantilla CSV
        this.app.get('/api/csv/template', (req, res) => {
            try {
                const templateContent = `Parque Industrial,Ubicación,Tipo,Ancho,Largo,Area (m2),Precio,Estado,Información Extra,Ventajas Estratégicas
Vernes,Carr. México - Qro,Nave Industrial,50,30,1500,750000,Disponible,Incluye oficinas administrativas,Acceso directo a autopistas principales
LuisOnorio,Av. Constituyentes,Micronave,25,20,500,350000,Pre-Venta,Cuenta con muelle de carga,Zona de alto flujo comercial`;

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="plantilla_naves.csv"');
                res.send(templateContent);
            } catch (error) {
                console.error('Error descargando plantilla CSV:', error);
                res.status(500).json({ error: 'Error generando plantilla' });
            }
        });

        // Buscar en CSVs (endpoint interno para la IA)
        this.app.post('/api/csv/search', requireAuth, async (req, res) => {
            try {
                const { query } = req.body;
                if (!query) {
                    return res.status(400).json({ error: 'Query es requerido' });
                }

                const results = await csvService.searchInCSV(query);
                res.json({ results });
            } catch (error) {
                console.error('Error buscando en CSV:', error);
                res.status(500).json({ error: 'Error en la búsqueda' });
            }
        });

        // Servir React app para todas las rutas no-API (solo en producción)
        if (process.env.NODE_ENV === 'production') {
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
            });
        }

        // API endpoint para finalizar conversación
        this.app.post('/api/end-conversation', async (req, res) => {
            try {
                const { phone } = req.body;
                
                if (!phone) {
                    return res.status(400).json({ 
                        error: 'Phone is required',
                        details: 'Debe proporcionar el teléfono'
                    });
                }
                
                // Verificar si hay una instancia activa del bot
                if (!global.whatsappBot || !global.whatsappBot.sock) {
                    return res.status(503).json({ 
                        error: 'WhatsApp bot not available',
                        details: 'El bot de WhatsApp no está conectado'
                    });
                }
                
                // Formatear el número de teléfono para WhatsApp (Baileys usa @s.whatsapp.net)
                const formattedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                
                // Enviar mensaje de finalización
                const endMessage = '⏰ Tu sesión de conversación ha finalizado. Puedes escribirme nuevamente para iniciar una nueva conversación.';
                await global.whatsappBot.sock.sendMessage(formattedPhone, { text: endMessage });
                
                // Registrar el mensaje de finalización en los logs como mensaje del BOT
                logger.log('BOT', endMessage, phone);
                
                // Limpiar la sesión
                const sessionManager = require('../services/sessionManager');
                sessionManager.clearSession(phone);
                
                // Cambiar a modo IA si estaba en modo humano
                humanModeManager.setMode(phone, false);
                
                // Registrar el evento
                logger.log('SYSTEM', `Conversación finalizada manualmente para ${phone}`, phone);
                
                res.json({ 
                    success: true, 
                    message: 'Conversación finalizada correctamente',
                    phone: phone
                });
                
            } catch (error) {
                console.error('Error finalizando conversación:', error);
                res.status(500).json({ 
                    error: 'Error al finalizar conversación',
                    details: error.message 
                });
            }
        });

        // API endpoint para enviar mensajes
        this.app.post('/api/send-message', requireAuth, async (req, res) => {
            try {
                const { phone, message } = req.body;
                
                if (!phone || !message) {
                    return res.status(400).json({ 
                        error: 'Phone and message are required',
                        details: 'Debe proporcionar el teléfono y el mensaje'
                    });
                }
                
                // Verificar si hay una instancia activa del bot
                if (!global.whatsappBot) {
                    return res.status(503).json({ 
                        error: 'WhatsApp bot not available',
                        details: 'La instancia del bot no está disponible'
                    });
                }
                
                if (!global.whatsappBot.sock) {
                    return res.status(503).json({ 
                        error: 'WhatsApp client not connected',
                        details: 'El cliente de WhatsApp no está conectado. Por favor, escanee el código QR.'
                    });
                }
                
                // Formatear el número de teléfono para WhatsApp (Baileys usa @s.whatsapp.net)
                const formattedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                
                // Enviar mensaje através del cliente de WhatsApp
                await global.whatsappBot.sock.sendMessage(formattedPhone, { text: message });
                
                // Registrar el mensaje enviado por el humano con el nombre del usuario
                const senderName = req.user ? req.user.name : 'Soporte';
                // Usar 'soporte' como role para la base de datos
                await logger.log('soporte', message, phone.replace('@s.whatsapp.net', ''), senderName);
                
                res.json({ 
                    success: true, 
                    message: 'Mensaje enviado correctamente',
                    phone: phone,
                    sentMessage: message
                });
                
            } catch (error) {
                console.error('Error enviando mensaje:', error);
                
                let errorMessage = 'Error interno del servidor';
                if (error.message.includes('Chat not found')) {
                    errorMessage = 'No se encontró el chat con este número';
                } else if (error.message.includes('not registered')) {
                    errorMessage = 'El número no está registrado en WhatsApp';
                } else if (error.message.includes('Session not authenticated')) {
                    errorMessage = 'El bot no está autenticado en WhatsApp';
                }
                
                res.status(500).json({ 
                    error: 'Failed to send message',
                    details: errorMessage,
                    originalError: error.message
                });
            }
        });
    }

    calculateStats(logs) {
        const stats = {
            totalMessages: 0,
            userMessages: 0,
            botMessages: 0,
            errors: 0,
            uniqueUsers: new Set(),
            messagesByHour: {},
            averageResponseLength: 0
        };

        let totalResponseLength = 0;
        let responseCount = 0;

        // Verificar que logs sea un array
        if (!Array.isArray(logs)) {
            console.warn('calculateStats: logs no es un array', typeof logs);
            return {
                ...stats,
                uniqueUsers: stats.uniqueUsers.size
            };
        }

        logs.forEach(log => {
            if (log.type === 'USER') {
                stats.userMessages++;
                stats.totalMessages++;
                if (log.userId) stats.uniqueUsers.add(log.userId);
            } else if (log.type === 'BOT') {
                stats.botMessages++;
                stats.totalMessages++;
                totalResponseLength += log.message.length;
                responseCount++;
            } else if (log.type === 'ERROR') {
                stats.errors++;
            }

            // Agrupar por hora
            const hour = new Date(log.timestamp).getHours();
            stats.messagesByHour[hour] = (stats.messagesByHour[hour] || 0) + 1;
        });

        stats.uniqueUsers = stats.uniqueUsers.size;
        stats.averageResponseLength = responseCount > 0 ? 
            Math.round(totalResponseLength / responseCount) : 0;

        return stats;
    }

    async start() {
        if (process.env.NODE_ENV === 'production') {
            // En producción, usar servidor Express normal
            this.app.listen(this.port, () => {
                console.log(`📊 Servidor web de reportes en http://localhost:${this.port}`);
                logger.log('SYSTEM', `Servidor web iniciado en puerto ${this.port}`);
            });
        } else {
            // En desarrollo, usar ViteExpress para integrar Vite
            const server = this.app.listen(this.port, () => {
                console.log(`📊 Servidor web con Vite en http://localhost:${this.port}`);
                logger.log('SYSTEM', `Servidor web con Vite iniciado en puerto ${this.port}`);
            });
            
            // Configurar ViteExpress
            ViteExpress.config({ 
                mode: 'development',
                viteConfigFile: path.join(__dirname, '../../vite.config.js')
            });
            
            // Bind Vite middleware a Express
            await ViteExpress.bind(this.app, server);
        }
    }
}

module.exports = WebServer;