const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse/sync');

class CSVService {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data', 'naves');
    this.ensureDataDir();
    
    // Campos obligatorios que DEBE tener el CSV
    this.requiredFields = [
      'Parque Industrial',
      'Ubicación',
      'Tipo',
      'Ancho',
      'Largo',
      'Area (m2)',
      'Precio',
      'Estado',
      'Información Extra',
      'Ventajas Estratégicas'
    ];
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creando directorio de datos:', error);
    }
  }

  async saveCSV(filename, content) {
    try {
      // Primero parsear para validar
      const records = csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      // Validar que tenga registros
      if (records.length === 0) {
        throw new Error('El archivo CSV está vacío o no tiene datos válidos');
      }

      // Obtener los campos del CSV
      const csvFields = Object.keys(records[0]);
      
      // Validar que todos los campos requeridos estén presentes
      const missingFields = this.requiredFields.filter(field => 
        !csvFields.includes(field)
      );
      
      if (missingFields.length > 0) {
        throw new Error(`ERROR: Faltan los siguientes campos obligatorios en el CSV:\n${missingFields.join(', ')}\n\nEl archivo debe tener TODOS estos campos: ${this.requiredFields.join(', ')}`);
      }
      
      // Validar que no haya campos extras no esperados
      const extraFields = csvFields.filter(field => 
        !this.requiredFields.includes(field)
      );
      
      if (extraFields.length > 0) {
        throw new Error(`ERROR: El archivo contiene campos no permitidos:\n${extraFields.join(', ')}\n\nSolo se permiten estos campos: ${this.requiredFields.join(', ')}`);
      }

      // Validar que cada registro tenga datos válidos
      records.forEach((record, index) => {
        // Verificar que los campos numéricos sean válidos
        if (record['Ancho'] && isNaN(parseFloat(record['Ancho']))) {
          throw new Error(`Fila ${index + 2}: El campo 'Ancho' debe ser un número`);
        }
        if (record['Largo'] && isNaN(parseFloat(record['Largo']))) {
          throw new Error(`Fila ${index + 2}: El campo 'Largo' debe ser un número`);
        }
        if (record['Area (m2)'] && isNaN(parseFloat(record['Area (m2)']))) {
          throw new Error(`Fila ${index + 2}: El campo 'Area (m2)' debe ser un número`);
        }
        if (record['Precio'] && isNaN(parseFloat(record['Precio']))) {
          throw new Error(`Fila ${index + 2}: El campo 'Precio' debe ser un número`);
        }
      });

      // ELIMINAR TODOS LOS ARCHIVOS CSV EXISTENTES
      const existingFiles = await fs.readdir(this.dataDir);
      for (const file of existingFiles) {
        if (file.endsWith('.csv')) {
          await fs.unlink(path.join(this.dataDir, file));
          console.log(`Archivo anterior eliminado: ${file}`);
        }
      }
      
      // Guardar el nuevo archivo con timestamp para evitar duplicados
      const timestamp = new Date().toISOString().split('T')[0];
      const newFilename = `naves_${timestamp}.csv`;
      const filePath = path.join(this.dataDir, newFilename);
      await fs.writeFile(filePath, content);

      return {
        success: true,
        filename: newFilename,
        rowsProcessed: records.length,
        records
      };
    } catch (error) {
      console.error('Error guardando CSV:', error);
      throw new Error(error.message);
    }
  }

  async getAllRecords() {
    try {
      const files = await this.listCSVFiles();
      let allRecords = [];

      for (const file of files) {
        const filePath = path.join(this.dataDir, file.name);
        const content = await fs.readFile(filePath, 'utf8');
        
        try {
          const records = csv.parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
          });
          
          allRecords = allRecords.concat(records);
        } catch (parseError) {
          console.error(`Error parseando archivo ${file.name}:`, parseError);
        }
      }

      return allRecords;
    } catch (error) {
      console.error('Error obteniendo todos los registros:', error);
      return [];
    }
  }

  async searchInCSV(query) {
    try {
      const records = await this.getAllRecords();
      
      // Normalizar la consulta
      const normalizedQuery = query.toLowerCase().trim();
      
      // Buscar en todos los campos
      const results = records.filter(record => {
        return Object.values(record).some(value => {
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(normalizedQuery);
        });
      });

      // Si hay resultados exactos por parque industrial, priorizar esos
      const exactMatches = results.filter(r => 
        r['Parque Industrial'] && 
        r['Parque Industrial'].toLowerCase() === normalizedQuery
      );

      if (exactMatches.length > 0) {
        return exactMatches;
      }

      return results;
    } catch (error) {
      console.error('Error buscando en CSV:', error);
      return [];
    }
  }

  async searchByField(fieldName, value) {
    try {
      const records = await this.getAllRecords();
      const normalizedValue = value.toLowerCase().trim();
      
      return records.filter(record => {
        const fieldValue = record[fieldName];
        if (!fieldValue) return false;
        return String(fieldValue).toLowerCase().includes(normalizedValue);
      });
    } catch (error) {
      console.error('Error buscando por campo:', error);
      return [];
    }
  }

  async listCSVFiles() {
    try {
      const files = await fs.readdir(this.dataDir);
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      
      const fileDetails = await Promise.all(
        csvFiles.map(async (filename) => {
          const filePath = path.join(this.dataDir, filename);
          const stats = await fs.stat(filePath);
          
          // Contar registros
          let records = 0;
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = csv.parse(content, {
              columns: true,
              skip_empty_lines: true
            });
            records = parsed.length;
          } catch (e) {
            console.error(`Error contando registros en ${filename}:`, e);
          }
          
          return {
            name: filename,
            uploadDate: stats.mtime,
            size: stats.size,
            records
          };
        })
      );
      
      return fileDetails.sort((a, b) => b.uploadDate - a.uploadDate);
    } catch (error) {
      console.error('Error listando archivos CSV:', error);
      return [];
    }
  }

  async deleteCSV(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      await fs.unlink(filePath);
      return { success: true, message: `Archivo ${filename} eliminado` };
    } catch (error) {
      console.error('Error eliminando CSV:', error);
      throw new Error('Error eliminando archivo: ' + error.message);
    }
  }

  formatRecordForDisplay(record) {
    let formatted = [];
    
    if (record['Parque Industrial']) {
      formatted.push(`📍 Parque Industrial: ${record['Parque Industrial']}`);
    }
    if (record['Ubicación']) {
      formatted.push(`📌 Ubicación: ${record['Ubicación']}`);
    }
    if (record['Tipo']) {
      formatted.push(`🏭 Tipo: ${record['Tipo']}`);
    }
    if (record['Area (m2)']) {
      formatted.push(`📐 Área: ${record['Area (m2)']} m²`);
    }
    if (record['Ancho'] && record['Largo']) {
      formatted.push(`📏 Dimensiones: ${record['Ancho']}m x ${record['Largo']}m`);
    }
    if (record['Precio']) {
      const precio = parseFloat(record['Precio']);
      const precioFormateado = precio.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0
      });
      formatted.push(`💰 Precio: ${precioFormateado}`);
    }
    if (record['Estado']) {
      const emoji = record['Estado'].toLowerCase() === 'disponible' ? '✅' : 
                    record['Estado'].toLowerCase() === 'sold out' ? '❌' : '⏳';
      formatted.push(`${emoji} Estado: ${record['Estado']}`);
    }
    if (record['Información Extra']) {
      formatted.push(`ℹ️ Info adicional: ${record['Información Extra']}`);
    }
    if (record['Ventajas Estratégicas']) {
      formatted.push(`🎯 Ventajas estratégicas: ${record['Ventajas Estratégicas']}`);
    }
    
    return formatted.join('\n');
  }
}

module.exports = new CSVService();