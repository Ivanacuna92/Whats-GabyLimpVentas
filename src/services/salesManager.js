const database = require('./database');

class SalesManager {
    constructor() {
        this.localCache = new Map(); // Cache local para rendimiento
        this.initializeCache();
    }

    async initializeCache() {
        try {
            // Cargar datos desde la BD al iniciar
            const salesData = await database.findAll('sales_status');
            salesData.forEach(sale => {
                this.localCache.set(sale.user_id, {
                    stage: sale.stage,
                    interest_level: sale.interest_level,
                    products_interested: JSON.parse(sale.products_interested || '[]'),
                    objections: JSON.parse(sale.objections || '[]'),
                    next_action: sale.next_action,
                    notes: sale.notes,
                    posibleVenta: sale.posible_venta === 1,
                    analizadoIA: sale.analizado_ia === 1,
                    citaAgendada: sale.cita_agendada === 1,
                    last_interaction: sale.last_interaction,
                    created_at: sale.created_at
                });
            });
            console.log(`✅ Cargados ${salesData.length} registros de ventas desde BD`);
        } catch (error) {
            console.error('Error inicializando cache de ventas:', error);
        }
    }

    generateConversationId(phone, date) {
        // Generar un ID único pero consistente basado en teléfono y fecha
        const dateStr = date || new Date().toISOString().split('T')[0];
        const phoneClean = phone.replace(/[^0-9]/g, '');
        return `${phoneClean}_${dateStr}`;
    }

    async setSaleStatus(conversationId, data) {
        try {
            // El conversationId es phone_date
            const [phone] = conversationId.split('_');
            
            console.log(`Guardando en BD para ${phone}:`, {
                posibleVenta: data.posibleVenta,
                analizadoIA: true,
                citaAgendada: data.citaAgendada
            });
            
            // Buscar o crear registro en BD
            const existing = await database.findOne('sales_status', 'user_id = ?', [phone]);
            
            if (existing) {
                // Actualizar registro existente
                const updateResult = await database.update('sales_status', {
                    posible_venta: data.posibleVenta ? 1 : 0,
                    analizado_ia: 1, // Siempre 1 cuando se analiza con IA
                    cita_agendada: data.citaAgendada ? 1 : 0,
                    notes: data.notas || existing.notes,
                    last_interaction: new Date()
                }, 'user_id = ?', [phone]);
                console.log('✅ Registro actualizado en BD:', updateResult);
            } else {
                // Crear nuevo registro
                const insertResult = await database.insert('sales_status', {
                    user_id: phone,
                    stage: 'analyzed',
                    interest_level: data.posibleVenta ? 5 : 0,
                    posible_venta: data.posibleVenta ? 1 : 0,
                    analizado_ia: 1, // Siempre 1 cuando se analiza con IA
                    cita_agendada: data.citaAgendada ? 1 : 0,
                    products_interested: '[]',
                    objections: '[]',
                    next_action: '',
                    notes: data.notas || ''
                });
                console.log('✅ Nuevo registro creado en BD:', insertResult);
            }

            // Actualizar cache local
            this.localCache.set(phone, {
                ...this.localCache.get(phone),
                posibleVenta: data.posibleVenta,
                analizadoIA: true,
                citaAgendada: data.citaAgendada,
                notas: data.notas
            });

            return { success: true, saved: true };
        } catch (error) {
            console.error('❌ Error guardando estado de venta en BD:', error);
            throw error;
        }
    }

    async updateSaleStatus(userId, data) {
        try {
            // Verificar si existe registro previo
            const existing = await database.findOne('sales_status', 'user_id = ?', [userId]);
            
            let saleData;
            if (existing) {
                // Actualizar registro existente
                const updateData = {
                    last_interaction: new Date()
                };
                
                if (data.stage !== undefined) updateData.stage = data.stage;
                if (data.interest_level !== undefined) updateData.interest_level = data.interest_level;
                if (data.products_interested !== undefined) updateData.products_interested = JSON.stringify(data.products_interested);
                if (data.objections !== undefined) updateData.objections = JSON.stringify(data.objections);
                if (data.next_action !== undefined) updateData.next_action = data.next_action;
                if (data.notes !== undefined) updateData.notes = data.notes;
                
                await database.update('sales_status', updateData, 'user_id = ?', [userId]);
                
                // Actualizar cache local
                const cached = this.localCache.get(userId) || {};
                saleData = { ...cached, ...data, last_interaction: new Date() };
                this.localCache.set(userId, saleData);
            } else {
                // Crear nuevo registro
                saleData = {
                    stage: data.stage || 'initial_contact',
                    interest_level: data.interest_level || 0,
                    products_interested: data.products_interested || [],
                    objections: data.objections || [],
                    next_action: data.next_action || '',
                    notes: data.notes || '',
                    last_interaction: new Date(),
                    created_at: new Date()
                };
                
                await database.insert('sales_status', {
                    user_id: userId,
                    stage: saleData.stage,
                    interest_level: saleData.interest_level,
                    products_interested: JSON.stringify(saleData.products_interested),
                    objections: JSON.stringify(saleData.objections),
                    next_action: saleData.next_action,
                    notes: saleData.notes
                });
                
                this.localCache.set(userId, saleData);
            }
            
            return saleData;
        } catch (error) {
            console.error('Error actualizando estado de venta:', error);
            throw error;
        }
    }

    async getSaleStatus(userId) {
        try {
            // Si el userId viene como conversationId (phone_date), extraer el phone
            const phone = userId.includes('_') ? userId.split('_')[0] : userId;
            
            // Verificar cache local primero
            if (this.localCache.has(phone)) {
                const cached = this.localCache.get(phone);
                return {
                    ...cached,
                    posibleVenta: cached.posibleVenta || cached.posible_venta || false,
                    analizadoIA: cached.analizadoIA || cached.analizado_ia || false,
                    ventaCerrada: cached.analizadoIA || cached.analizado_ia || false, // Mantener compatibilidad
                    citaAgendada: cached.citaAgendada || cached.cita_agendada || false
                };
            }
            
            // Buscar en BD
            const dbData = await database.findOne('sales_status', 'user_id = ?', [phone]);
            if (dbData) {
                const saleData = {
                    stage: dbData.stage,
                    interest_level: dbData.interest_level,
                    products_interested: JSON.parse(dbData.products_interested || '[]'),
                    objections: JSON.parse(dbData.objections || '[]'),
                    next_action: dbData.next_action,
                    posibleVenta: dbData.posible_venta === 1,
                    analizadoIA: dbData.analizado_ia === 1,
                    ventaCerrada: dbData.analizado_ia === 1, // Mantener compatibilidad
                    citaAgendada: dbData.cita_agendada === 1,
                    notes: dbData.notes,
                    last_interaction: dbData.last_interaction,
                    created_at: dbData.created_at
                };
                
                this.localCache.set(userId, saleData);
                return saleData;
            }
            
            // Retornar estado por defecto
            return {
                stage: 'initial_contact',
                interest_level: 0,
                products_interested: [],
                objections: [],
                next_action: '',
                notes: '',
                last_interaction: null,
                created_at: null
            };
        } catch (error) {
            console.error('Error obteniendo estado de venta:', error);
            return {
                stage: 'initial_contact',
                interest_level: 0,
                products_interested: [],
                objections: [],
                next_action: '',
                notes: ''
            };
        }
    }

    async getAllSalesData() {
        try {
            const salesData = await database.findAll('sales_status', '1=1', [], 'last_interaction DESC');
            return salesData.map(sale => ({
                user_id: sale.user_id,
                stage: sale.stage,
                interest_level: sale.interest_level,
                products_interested: JSON.parse(sale.products_interested || '[]'),
                objections: JSON.parse(sale.objections || '[]'),
                next_action: sale.next_action,
                notes: sale.notes,
                last_interaction: sale.last_interaction,
                created_at: sale.created_at
            }));
        } catch (error) {
            console.error('Error obteniendo todos los datos de ventas:', error);
            return [];
        }
    }

    async getSalesByStage(stage) {
        try {
            const sales = await database.findAll('sales_status', 'stage = ?', [stage], 'last_interaction DESC');
            return sales.map(sale => ({
                user_id: sale.user_id,
                stage: sale.stage,
                interest_level: sale.interest_level,
                products_interested: JSON.parse(sale.products_interested || '[]'),
                objections: JSON.parse(sale.objections || '[]'),
                next_action: sale.next_action,
                notes: sale.notes,
                last_interaction: sale.last_interaction,
                created_at: sale.created_at
            }));
        } catch (error) {
            console.error('Error obteniendo ventas por etapa:', error);
            return [];
        }
    }

    async markAsPotentialSale(userId, products = [], notes = '') {
        return await this.updateSaleStatus(userId, {
            stage: 'interested',
            interest_level: 5,
            products_interested: products,
            next_action: 'Seguimiento de interés',
            notes: notes
        });
    }

    async markAsQualifiedLead(userId, products = [], objections = [], notes = '') {
        return await this.updateSaleStatus(userId, {
            stage: 'qualified',
            interest_level: 7,
            products_interested: products,
            objections: objections,
            next_action: 'Preparar propuesta',
            notes: notes
        });
    }

    async markAsProposal(userId, notes = '') {
        return await this.updateSaleStatus(userId, {
            stage: 'proposal',
            interest_level: 8,
            next_action: 'Esperar respuesta de propuesta',
            notes: notes
        });
    }

    async markAsSoldSale(userId, products = [], notes = '') {
        return await this.updateSaleStatus(userId, {
            stage: 'closed_won',
            interest_level: 10,
            products_interested: products,
            next_action: 'Proceso de entrega',
            notes: notes
        });
    }

    async markAsLostSale(userId, objections = [], notes = '') {
        return await this.updateSaleStatus(userId, {
            stage: 'closed_lost',
            interest_level: 0,
            objections: objections,
            next_action: 'Seguimiento a largo plazo',
            notes: notes
        });
    }

    async getSalesStats(startDate = null, endDate = null) {
        try {
            let query = 'SELECT stage, interest_level, created_at FROM sales_status';
            let params = [];
            
            if (startDate && endDate) {
                query += ' WHERE created_at BETWEEN ? AND ?';
                params.push(startDate, endDate);
            } else if (startDate) {
                query += ' WHERE created_at >= ?';
                params.push(startDate);
            }
            
            const salesData = await database.query(query, params);
            
            const stats = {
                total: salesData.length,
                initial_contact: 0,
                interested: 0,
                qualified: 0,
                proposal: 0,
                closed_won: 0,
                closed_lost: 0,
                avg_interest_level: 0,
                conversion_rate: 0
            };
            
            let totalInterest = 0;
            salesData.forEach(sale => {
                stats[sale.stage] = (stats[sale.stage] || 0) + 1;
                totalInterest += sale.interest_level;
            });
            
            if (salesData.length > 0) {
                stats.avg_interest_level = (totalInterest / salesData.length).toFixed(2);
                stats.conversion_rate = ((stats.closed_won / salesData.length) * 100).toFixed(2);
            }
            
            return stats;
        } catch (error) {
            console.error('Error obteniendo estadísticas de ventas:', error);
            return {
                total: 0,
                initial_contact: 0,
                interested: 0,
                qualified: 0,
                proposal: 0,
                closed_won: 0,
                closed_lost: 0,
                avg_interest_level: 0,
                conversion_rate: 0
            };
        }
    }

    async getHotLeads(limit = 10) {
        try {
            const query = `
                SELECT user_id, stage, interest_level, products_interested, next_action, last_interaction
                FROM sales_status 
                WHERE stage IN ('interested', 'qualified', 'proposal') 
                AND interest_level >= 6
                ORDER BY interest_level DESC, last_interaction DESC
                LIMIT ?
            `;
            
            const leads = await database.query(query, [limit]);
            return leads.map(lead => ({
                user_id: lead.user_id,
                stage: lead.stage,
                interest_level: lead.interest_level,
                products_interested: JSON.parse(lead.products_interested || '[]'),
                next_action: lead.next_action,
                last_interaction: lead.last_interaction
            }));
        } catch (error) {
            console.error('Error obteniendo leads calientes:', error);
            return [];
        }
    }

    async getStaleLeads(days = 7) {
        try {
            const query = `
                SELECT user_id, stage, interest_level, next_action, last_interaction
                FROM sales_status 
                WHERE stage NOT IN ('closed_won', 'closed_lost')
                AND last_interaction < DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY last_interaction ASC
            `;
            
            const leads = await database.query(query, [days]);
            return leads.map(lead => ({
                user_id: lead.user_id,
                stage: lead.stage,
                interest_level: lead.interest_level,
                next_action: lead.next_action,
                last_interaction: lead.last_interaction,
                days_since_contact: Math.floor((new Date() - new Date(lead.last_interaction)) / (1000 * 60 * 60 * 24))
            }));
        } catch (error) {
            console.error('Error obteniendo leads obsoletos:', error);
            return [];
        }
    }

    // Limpiar registros antiguos (leads cerrados hace más de 180 días)
    async cleanupOldSales() {
        try {
            await database.query(
                `DELETE FROM sales_status 
                 WHERE stage IN ('closed_won', 'closed_lost') 
                 AND last_interaction < DATE_SUB(NOW(), INTERVAL 180 DAY)`
            );
            console.log('Ventas antiguas limpiadas');
        } catch (error) {
            console.error('Error limpiando ventas antiguas:', error);
        }
    }

    // Sincronizar cache con BD
    async syncCacheWithDB() {
        try {
            const salesData = await database.findAll('sales_status');
            this.localCache.clear();
            
            salesData.forEach(sale => {
                this.localCache.set(sale.user_id, {
                    stage: sale.stage,
                    interest_level: sale.interest_level,
                    products_interested: JSON.parse(sale.products_interested || '[]'),
                    objections: JSON.parse(sale.objections || '[]'),
                    next_action: sale.next_action,
                    notes: sale.notes,
                    last_interaction: sale.last_interaction,
                    created_at: sale.created_at
                });
            });
        } catch (error) {
            console.error('Error sincronizando cache de ventas:', error);
        }
    }

    // Iniciar sincronización periódica
    startSyncTimer() {
        setInterval(() => {
            this.syncCacheWithDB();
        }, 120000); // Sincronizar cada 2 minutos
    }
}

module.exports = new SalesManager();