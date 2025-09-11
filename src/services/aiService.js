const axios = require('axios');
const config = require('../config/config');
const csvService = require('./csvService');
const advisorAssignmentService = require('./advisorAssignmentService');

class AIService {
    constructor() {
        this.apiKey = config.deepseekApiKey;
        this.apiUrl = config.deepseekApiUrl;
    }

    async generateResponse(messages, contactNumber) {
        try {
            // Incluir datos de CSV en el prompt del sistema
            const enrichedMessages = await this.addCSVDataToSystemPrompt(messages, contactNumber);
            
            const response = await axios.post(this.apiUrl, {
                model: 'deepseek-chat',
                messages: enrichedMessages,
                max_tokens: 1000,
                temperature: 0.5
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error con DeepSeek API:', error.response?.data || error.message);
            
            if (error.response?.data?.error?.type === 'authentication_error') {
                throw new Error('Error de autenticación con API key');
            }
            
            throw new Error('Error generando respuesta de IA');
        }
    }

    async addCSVDataToSystemPrompt(messages, contactNumber) {
        try {
            // Obtener todos los datos de CSV
            const allRecords = await csvService.getAllRecords();
            
            if (allRecords.length === 0) {
                return messages;
            }
            
            // Formatear todos los registros
            const csvData = allRecords.map(record => 
                csvService.formatRecordForDisplay(record)
            ).join('\n\n---\n\n');
            
            // Obtener el asesor asignado para este contacto
            const assignedAdvisor = this.getOrAssignAdvisor(contactNumber);
            
            // Agregar CSV data y asesor al mensaje del sistema
            const enrichedMessages = [...messages];
            const systemMessage = enrichedMessages.find(m => m.role === 'system');
            
            if (systemMessage) {
                systemMessage.content = systemMessage.content + 
                    `\n\n*BASE DE DATOS DE NAVES DISPONIBLES:*\n\n${csvData}\n\n` +
                    `Usa esta información cuando el usuario pregunte sobre naves, parques industriales, precios, disponibilidad o cualquier tema relacionado. Si el usuario pregunta por algo específico que está en esta base de datos, úsala para responder de manera precisa y actualizada.\n\n` +
                    `*ASESOR ASIGNADO PARA ESTE CLIENTE:*\n` +
                    `Nombre: ${assignedAdvisor.name}\n` +
                    `Teléfono: ${assignedAdvisor.phone}\n\n` +
                    `IMPORTANTE: Cuando el cliente confirme interés o quiera seguir adelante con información sobre alguna nave, debes proporcionar ÚNICAMENTE los datos de contacto del asesor asignado arriba (${assignedAdvisor.name}), NO los de Paola González ni ningún otro asesor.`;
            }
            
            return enrichedMessages;
        } catch (error) {
            console.error('Error agregando datos CSV al prompt:', error);
            return messages;
        }
    }

    getOrAssignAdvisor(contactNumber) {
        // Usar el servicio centralizado que persiste las asignaciones
        return advisorAssignmentService.getOrAssignAdvisor(contactNumber);
    }
}

module.exports = new AIService();