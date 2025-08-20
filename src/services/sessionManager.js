const config = require('../config/config');
const logger = require('./logger');
const humanModeManager = require('./humanModeManager');

class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    getSession(userId, chatId = null) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                messages: [],
                lastActivity: Date.now(),
                chatId: chatId
            });
        }
        
        const session = this.sessions.get(userId);
        if (chatId) session.chatId = chatId;
        return session;
    }

    addMessage(userId, role, content, chatId = null) {
        const session = this.getSession(userId, chatId);
        session.messages.push({ role, content });
        session.lastActivity = Date.now();
    }

    getMessages(userId, chatId = null) {
        const session = this.getSession(userId, chatId);
        return session.messages.slice(-config.maxMessages);
    }

    clearSession(userId) {
        if (this.sessions.has(userId)) {
            this.sessions.get(userId).messages = [];
        }
    }

    async checkInactiveSessions(client) {
        const now = Date.now();
        
        for (const [userId, session] of this.sessions.entries()) {
            // Si está en modo humano, NO limpiar la sesión por inactividad
            if (humanModeManager.isHumanMode(userId)) {
                continue; // Saltar este usuario, el humano decide cuándo terminar
            }
            
            if (now - session.lastActivity > config.sessionTimeout && session.messages.length > 0) {
                // Enviar mensaje de finalización
                if (session.chatId && client) {
                    try {
                        const chat = await client.getChatById(session.chatId);
                        await chat.sendMessage('⏰ Tu sesión de conversación ha finalizado por inactividad. Puedes escribirme nuevamente para iniciar una nueva conversación.');
                    } catch (error) {
                        console.error('Error enviando mensaje de finalización:', error);
                    }
                }
                
                this.clearSession(userId);
                logger.log('SYSTEM', 'Conversación reiniciada por inactividad', userId);
            }
        }
    }

    startCleanupTimer(client) {
        setInterval(() => {
            this.checkInactiveSessions(client);
        }, config.checkInterval);
    }
}

module.exports = new SessionManager();