const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('../services/logger');
const humanModeManager = require('../services/humanModeManager');

class WebServer {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        // Servir archivos estáticos de React build (cuando esté compilado)
        this.app.use(express.static(path.join(__dirname, '../../dist')));
    }

    setupRoutes() {
        // API endpoint para obtener logs
        this.app.get('/api/logs/:date?', (req, res) => {
            const date = req.params.date || null;
            const logs = logger.getLogs(date);
            res.json(logs);
        });

        // API endpoint para obtener fechas disponibles
        this.app.get('/api/dates', (req, res) => {
            const dates = logger.getAvailableDates();
            res.json(dates);
        });

        // API endpoint para estadísticas
        this.app.get('/api/stats/:date?', (req, res) => {
            const date = req.params.date || null;
            const logs = logger.getLogs(date);
            
            const stats = this.calculateStats(logs);
            res.json(stats);
        });

        // API endpoint para conversaciones por usuario
        this.app.get('/api/conversations/:userId/:date?', (req, res) => {
            const { userId, date } = req.params;
            const logs = logger.getLogs(date);
            
            const userLogs = logs.filter(log => log.userId === userId);
            res.json(userLogs);
        });

        // API endpoints para gestión de modo humano
        this.app.get('/api/human-states', (req, res) => {
            const humanStates = humanModeManager.getAllHumanStates();
            res.json(humanStates);
        });

        this.app.post('/api/human-states', (req, res) => {
            try {
                const { phone, isHumanMode } = req.body;
                
                if (!phone) {
                    return res.status(400).json({ error: 'Phone number is required' });
                }
                
                humanModeManager.setHumanMode(phone, isHumanMode);
                logger.log('SYSTEM', `Modo ${isHumanMode ? 'HUMANO' : 'IA'} establecido para ${phone}`);
                
                res.json({ 
                    success: true, 
                    phone, 
                    isHumanMode,
                    message: `Modo ${isHumanMode ? 'HUMANO' : 'IA'} activado para ${phone}`
                });
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

        // Servir React app para todas las rutas no-API
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
        });

        // API endpoint para enviar mensajes
        this.app.post('/api/send-message', async (req, res) => {
            try {
                const { phone, message } = req.body;
                
                if (!phone || !message) {
                    return res.status(400).json({ 
                        error: 'Phone and message are required',
                        details: 'Debe proporcionar el teléfono y el mensaje'
                    });
                }
                
                // Verificar si hay una instancia activa del bot
                if (!global.whatsappBot || !global.whatsappBot.client) {
                    return res.status(503).json({ 
                        error: 'WhatsApp bot not available',
                        details: 'El bot de WhatsApp no está conectado'
                    });
                }
                
                // Formatear el número de teléfono para WhatsApp
                const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;
                
                // Enviar mensaje através del cliente de WhatsApp
                await global.whatsappBot.client.sendMessage(formattedPhone, message);
                
                // Registrar el mensaje enviado por el humano
                logger.log('HUMAN', `Humano: ${message}`, phone);
                
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

    start() {
        this.app.listen(this.port, () => {
            console.log(`📊 Servidor web de reportes en http://localhost:${this.port}`);
            logger.log('SYSTEM', `Servidor web iniciado en puerto ${this.port}`);
        });
    }
}

module.exports = WebServer;