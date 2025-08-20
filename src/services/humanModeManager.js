const fs = require('fs');
const path = require('path');

class HumanModeManager {
    constructor() {
        this.humanStatesFile = path.join(__dirname, '../../data/human-states.json');
        this.humanStates = this.loadHumanStates();
    }

    loadHumanStates() {
        try {
            // Crear directorio data si no existe
            const dataDir = path.dirname(this.humanStatesFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Cargar estados existentes o crear archivo vacío
            if (fs.existsSync(this.humanStatesFile)) {
                const data = fs.readFileSync(this.humanStatesFile, 'utf8');
                return JSON.parse(data);
            } else {
                return {};
            }
        } catch (error) {
            console.error('Error cargando estados humanos:', error);
            return {};
        }
    }

    saveHumanStates() {
        try {
            fs.writeFileSync(this.humanStatesFile, JSON.stringify(this.humanStates, null, 2));
        } catch (error) {
            console.error('Error guardando estados humanos:', error);
        }
    }

    setHumanMode(phone, isHumanMode) {
        this.humanStates[phone] = isHumanMode;
        this.saveHumanStates();
        console.log(`Modo ${isHumanMode ? 'HUMANO' : 'IA'} establecido para ${phone}`);
    }

    isHumanMode(phone) {
        return this.humanStates[phone] || false;
    }

    getAllHumanStates() {
        return { ...this.humanStates };
    }

    removeContact(phone) {
        delete this.humanStates[phone];
        this.saveHumanStates();
    }

    getHumanModeContacts() {
        return Object.keys(this.humanStates).filter(phone => this.humanStates[phone]);
    }

    getAIModeContacts() {
        return Object.keys(this.humanStates).filter(phone => !this.humanStates[phone]);
    }
}

module.exports = new HumanModeManager();