const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const config = require('../config/config');
const logger = require('../services/logger');
const aiService = require('../services/aiService');
const sessionManager = require('../services/sessionManager');
const promptLoader = require('../services/promptLoader');
const humanModeManager = require('../services/humanModeManager');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.systemPrompt = promptLoader.getPrompt();
        this.store = null;
        this.currentQR = null;
    }

    async start() {
        console.log('Iniciando bot de WhatsApp con Baileys...');
        config.validateApiKey();
        
        // Configurar autenticación multi-archivo
        const { state, saveCreds } = await useMultiFileAuthState('./auth_baileys');
        
        // Crear socket de WhatsApp
        this.sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['WhatsBot', 'Chrome', '1.0.0']
        });
        
        // Guardar credenciales cuando se actualicen
        this.sock.ev.on('creds.update', saveCreds);
        
        // Manejar actualizaciones de conexión
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('Escanea este código QR con WhatsApp:');
                console.log('O visita: http://tu-servidor:4242/qr');
                this.currentQR = qr;
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Conexión cerrada debido a', lastDisconnect?.error, ', reconectando:', shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(() => this.start(), 5000);
                }
            } else if (connection === 'open') {
                console.log('¡Bot de WhatsApp conectado y listo!');
                this.currentQR = null; // Limpiar QR al conectar
                logger.log('SYSTEM', 'Bot iniciado correctamente con Baileys');
                sessionManager.startCleanupTimer(this.sock);
            }
        });
        
        // Manejar mensajes entrantes
        this.sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message) return;
                
                // Log para debugging
                console.log('Mensaje recibido - fromMe:', msg.key.fromMe, 'remoteJid:', msg.key.remoteJid);
                
                // Ignorar mensajes propios
                if (msg.key.fromMe) {
                    console.log('Ignorando mensaje propio');
                    return;
                }
                
                // Obtener el número del remitente
                const from = msg.key.remoteJid;
                const isGroup = from.endsWith('@g.us');
                
                // Solo responder a mensajes privados
                if (isGroup) return;
                
                // Obtener el texto del mensaje
                const conversation = msg.message.conversation || 
                                   msg.message.extendedTextMessage?.text || 
                                   '';
                
                // Ignorar mensajes sin texto
                if (!conversation || conversation.trim() === '') {
                    console.log('Mensaje ignorado - Sin contenido de texto');
                    return;
                }
                
                // Extraer información del usuario
                const userId = from.replace('@s.whatsapp.net', '');
                const userName = msg.pushName || userId;
                
                await logger.log('cliente', conversation, userId, userName);
                
                // Verificar si está en modo humano o soporte
                const isHuman = await humanModeManager.isHumanMode(userId);
                const isSupport = await humanModeManager.isSupportMode(userId);
                
                if (isHuman || isSupport) {
                    const mode = isSupport ? 'SOPORTE' : 'HUMANO';
                    await logger.log('SYSTEM', `Mensaje ignorado - Modo ${mode} activo para ${userName} (${userId})`);
                    return;
                }
                
                // Procesar mensaje y generar respuesta
                const response = await this.processMessage(userId, conversation, from);
                
                // Enviar respuesta
                await this.sock.sendMessage(from, { text: response });
                await logger.log('bot', response, userId, userName);
                
            } catch (error) {
                await this.handleError(error, m.messages[0]);
            }
        });
    }
    
    async processMessage(userId, userMessage, chatId) {
        // Agregar mensaje del usuario a la sesión
        await sessionManager.addMessage(userId, 'user', userMessage, chatId);
        
        // Preparar mensajes para la IA
        const messages = [
            { role: 'system', content: this.systemPrompt },
            ...(await sessionManager.getMessages(userId, chatId))
        ];
        
        // Generar respuesta con IA
        const aiResponse = await aiService.generateResponse(messages);
        
        // Verificar si la respuesta contiene el marcador de activar soporte
        if (aiResponse.includes('{{ACTIVAR_SOPORTE}}')) {
            // Remover el marcador de la respuesta
            const cleanResponse = aiResponse.replace('{{ACTIVAR_SOPORTE}}', '').trim();
            
            // Activar modo soporte
            await humanModeManager.setMode(userId, 'support');
            await sessionManager.updateSessionMode(userId, chatId, 'support');
            
            // Agregar respuesta limpia a la sesión
            await sessionManager.addMessage(userId, 'assistant', cleanResponse, chatId);
            
            // Registrar en logs
            await logger.log('SYSTEM', `Modo SOPORTE activado automáticamente para ${userId}`);
            
            return cleanResponse;
        }
        
        // Agregar respuesta de IA a la sesión
        await sessionManager.addMessage(userId, 'assistant', aiResponse, chatId);
        
        return aiResponse;
    }
    
    async handleError(error, message) {
        console.error('Error procesando mensaje:', error);
        
        const from = message.key.remoteJid;
        const userId = from.replace('@s.whatsapp.net', '');
        
        let errorMessage = 'Lo siento, ocurrió un error. Inténtalo de nuevo.';
        
        if (error.message.includes('autenticación') || error.message.includes('API key')) {
            errorMessage = 'Error de configuración del bot. Por favor, contacta al administrador.';
        }
        
        try {
            await this.sock.sendMessage(from, { text: errorMessage });
            logger.log('ERROR', error.message, userId);
        } catch (sendError) {
            console.error('Error enviando mensaje de error:', sendError);
        }
    }
    
    async stop() {
        console.log('Cerrando bot...');
        if (this.sock) {
            this.sock.end();
        }
    }
}

module.exports = WhatsAppBot;