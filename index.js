const WhatsAppBot = require('./src/bot/whatsappBot');
const WebServer = require('./src/web/server');
const config = require('./src/config/config');
const databaseInit = require('./src/services/databaseInit');

// Crear instancia del bot
const bot = new WhatsAppBot();

// Exponer instancia del bot globalmente para el servidor web
global.whatsappBot = bot;

// Crear instancia del servidor web
const webServer = new WebServer(config.webPort);

// Iniciar bot y servidor web
async function start() {
    // Inicializar base de datos
    await databaseInit.createTables();
    
    await bot.start();
    webServer.start();
}

start().catch(console.error);

// Manejar cierre limpio
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando aplicación...');
    await bot.stop();
    process.exit(0);
});