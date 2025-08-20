const axios = require('axios');
const config = require('../config/config');

class AIService {
    constructor() {
        this.apiKey = config.deepseekApiKey;
        this.apiUrl = config.deepseekApiUrl;
    }

    async generateResponse(messages) {
        try {
            const response = await axios.post(this.apiUrl, {
                model: 'deepseek-chat',
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7
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
}

module.exports = new AIService();