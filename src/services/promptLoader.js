const fs = require('fs');
const path = require('path');

class PromptLoader {
    constructor() {
        this.promptPath = path.join(process.cwd(), 'prompt.txt');
    }

    load() {
        try {
            return fs.readFileSync(this.promptPath, 'utf8');
        } catch (error) {
            console.error('Error cargando prompt.txt:', error);
            return 'Eres un asistente virtual útil y amigable. Responde de manera clara y concisa en español.';
        }
    }

    update(newPrompt) {
        try {
            fs.writeFileSync(this.promptPath, newPrompt, 'utf8');
            return true;
        } catch (error) {
            console.error('Error actualizando prompt:', error);
            return false;
        }
    }

    getPrompt() {
        return this.load();
    }
}

module.exports = new PromptLoader();