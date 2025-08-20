const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config/config');
const logger = require('../services/logger');
const aiService = require('../services/aiService');
const sessionManager = require('../services/sessionManager');
const promptLoader = require('../services/promptLoader');
const humanModeManager = require('../services/humanModeManager');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true, // Modo sin ventana (solo terminal)
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        this.systemPrompt = promptLoader.getPrompt();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('qr', this.handleQR.bind(this));
        this.client.on('ready', this.handleReady.bind(this));
        this.client.on('message_create', this.handleMessage.bind(this));
        this.client.on('disconnected', this.handleDisconnected.bind(this));
    }

    handleQR(qr) {
        console.log('Escanea este código QR con WhatsApp:');
        qrcode.generate(qr, { small: true });
    }

    handleReady() {
        console.log('¡Bot de WhatsApp conectado y listo!');
        logger.log('SYSTEM', 'Bot iniciado correctamente');
        sessionManager.startCleanupTimer(this.client);
    }

    async handleMessage(message) {
        // Ignorar mensajes propios
        if (message.fromMe) return;
        
        // Ignorar mensajes que no son texto
        if (message.type !== 'chat') {
            console.log(`Mensaje ignorado - Tipo no soportado: ${message.type} (solo acepto texto)`);
            return;
        }
        
        // Ignorar mensajes sin contenido de texto
        if (!message.body || message.body.trim() === '') {
            console.log('Mensaje ignorado - Sin contenido de texto');
            return;
        }
        
        // Obtener información del chat
        const chat = await message.getChat();
        
        // Solo responder a mensajes privados
        if (chat.isGroup) return;
        
        // Obtener información del contacto
        const contact = await message.getContact();
        const userId = contact.id.user;
        const userName = contact.name || contact.pushname || userId;
        
        // Solo responder al número autorizado
        if (userId !== '5213332248353') {
            console.log(`Mensaje ignorado de ${userId} - Solo respondo a 521333224835`);
            return;
        }
        
        
        logger.log('USER', `${userName}: ${message.body}`, userId);
        
        // Verificar si está en modo humano
        if (humanModeManager.isHumanMode(userId)) {
            logger.log('SYSTEM', `Mensaje ignorado - Modo HUMANO activo para ${userName} (${userId})`, userId);
            return; // No responder automáticamente cuando está en modo humano
        }
        
        try {
            const response = await this.processMessage(userId, message.body, chat.id._serialized);
            await message.reply(response);
            logger.log('BOT', response, userId);
        } catch (error) {
            await this.handleError(error, message, userId);
        }
    }

    async processMessage(userId, userMessage, chatId) {
        // Agregar mensaje del usuario a la sesión
        sessionManager.addMessage(userId, 'user', userMessage, chatId);
        
        // Preparar mensajes para la IA
        const messages = [
            { role: 'system', content: this.systemPrompt },
            ...sessionManager.getMessages(userId, chatId)
        ];
        
        // Generar respuesta con IA
        const aiResponse = await aiService.generateResponse(messages);
        
        // Agregar respuesta de IA a la sesión
        sessionManager.addMessage(userId, 'assistant', aiResponse, chatId);
        
        return aiResponse;
    }

    async handleError(error, message, userId) {
        console.error('Error procesando mensaje:', error);
        
        let errorMessage = 'Lo siento, ocurrió un error. Inténtalo de nuevo.';
        
        if (error.message.includes('autenticación') || error.message.includes('API key')) {
            errorMessage = 'Error de configuración del bot. Por favor, contacta al administrador.';
        }
        
        await message.reply(errorMessage);
        logger.log('ERROR', error.message, userId);
    }

    handleDisconnected(reason) {
        console.log('Cliente desconectado:', reason);
        logger.log('SYSTEM', `Bot desconectado: ${reason}`);
    }

    async start() {
        console.log('Iniciando bot de WhatsApp...');
        config.validateApiKey();
        await this.client.initialize();
    }

    async stop() {
        console.log('Cerrando bot...');
        await this.client.destroy();
    }
}

module.exports = WhatsAppBot;