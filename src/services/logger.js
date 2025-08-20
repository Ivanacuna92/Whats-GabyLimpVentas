const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    log(type, message, userId = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            userId,
            message
        };

        this.saveToFile(logEntry);
        this.printToConsole(timestamp, type, message, userId);
    }

    saveToFile(logEntry) {
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `${today}.json`);

        let logs = [];
        if (fs.existsSync(logFile)) {
            try {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            } catch (error) {
                console.error('Error leyendo logs:', error);
            }
        }

        logs.push(logEntry);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    }

    printToConsole(timestamp, type, message, userId) {
        const userInfo = userId ? ` (Usuario: ${userId})` : '';
        const time = timestamp.split('T')[1].split('.')[0]; // Solo hora:minuto:segundo
        
        // Colores ANSI para terminal con fondos para mejor contraste
        const colors = {
            SYSTEM: '\x1b[46m\x1b[30m',    // Fondo Cyan, texto negro
            USER: '\x1b[42m\x1b[30m',      // Fondo Verde, texto negro  
            BOT: '\x1b[43m\x1b[30m',       // Fondo Amarillo, texto negro
            ERROR: '\x1b[41m\x1b[37m',     // Fondo Rojo, texto blanco
            HUMAN: '\x1b[45m\x1b[37m',     // Fondo Magenta, texto blanco
            RESET: '\x1b[0m'                // Reset
        };
        
        const color = colors[type] || colors.RESET;
        console.log(`${color} [${time}] ${type} ${colors.RESET} ${message}${userInfo}`);
    }

    getLogs(date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `${targetDate}.json`);
        
        if (fs.existsSync(logFile)) {
            try {
                return JSON.parse(fs.readFileSync(logFile, 'utf8'));
            } catch (error) {
                console.error('Error leyendo logs:', error);
                return [];
            }
        }
        return [];
    }

    getAvailableDates() {
        try {
            const files = fs.readdirSync(this.logsDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''))
                .sort((a, b) => b.localeCompare(a));
        } catch (error) {
            return [];
        }
    }
}

module.exports = new Logger();