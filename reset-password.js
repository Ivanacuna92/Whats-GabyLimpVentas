#!/usr/bin/env node

const bcrypt = require('bcrypt');
const database = require('./src/services/database');

async function resetUserPassword() {
    try {
        // Conectar a la base de datos
        await database.connect();

        // Obtener parámetros de línea de comandos
        const args = process.argv.slice(2);

        if (args.length < 2) {
            console.log('Uso: node reset-password.js <email> <nueva-contraseña>');
            console.log('Ejemplo: node reset-password.js admin@whatspanel.com nuevapassword123');
            process.exit(1);
        }

        const email = args[0];
        const newPassword = args[1];

        // Buscar usuario por email
        const user = await database.findOne('support_users', 'email = ?', [email]);

        if (!user) {
            console.log(`❌ No se encontró usuario con email: ${email}`);
            process.exit(1);
        }

        console.log(`📧 Usuario encontrado: ${user.name} (${user.email}) - Rol: ${user.role}`);

        // Generar hash de la nueva contraseña
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña en la base de datos
        await database.update(
            'support_users',
            { password_hash: passwordHash },
            'id = ?',
            [user.id]
        );

        console.log('✅ Contraseña actualizada exitosamente');
        console.log(`📧 Email: ${email}`);
        console.log(`🔐 Nueva contraseña: ${newPassword}`);

        // Cerrar conexión
        await database.close();

    } catch (error) {
        console.error('❌ Error reseteando contraseña:', error);
        await database.close();
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    resetUserPassword();
}

module.exports = { resetUserPassword };