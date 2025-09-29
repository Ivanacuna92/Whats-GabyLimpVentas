/**
 * Servicio para validar ubicaciones del área metropolitana de CDMX
 */

class LocationValidator {
  constructor() {
    // Alcaldías de la Ciudad de México
    this.cdmxBorough = [
      "alvaro obregon",
      "azcapotzalco",
      "benito juarez",
      "coyoacan",
      "cuajimalpa",
      "cuauhtemoc",
      "gustavo a madero",
      "iztacalco",
      "iztapalapa",
      "magdalena contreras",
      "miguel hidalgo",
      "milpa alta",
      "tlahuac",
      "tlalpan",
      "venustiano carranza",
      "xochimilco",
    ];

    // Municipios del Estado de México en el área metropolitana
    this.edoMexMunicipalities = [
      "atizapan de zaragoza",
      "coacalco",
      "cuautitlan",
      "cuautitlan izcalli",
      "chalco",
      "chicoloapan",
      "chimalhuacan",
      "ecatepec",
      "huixquilucan",
      "ixtapaluca",
      "la paz",
      "naucalpan",
      "nezahualcoyotl",
      "nicolas romero",
      "tecamac",
      "tepotzotlan",
      "texcoco",
      "tlalnepantla",
      "tultitlan",
      "valle de chalco",
      "zumpango",
    ];

    // Municipios de Hidalgo cercanos al área metropolitana
    this.hidalgoMunicipalities = ["tizayuca"];

    // Otras zonas aceptables mencionadas en el prompt
    this.otherAcceptableAreas = [
      "satelite",
      "santa fe",
      "polanco",
      "reforma",
      "zona rosa",
      "condesa",
      "roma",
      "del valle",
      "doctores",
      "centro",
      "centro historico",
      "insurgentes",
      "perisur",
      "coyoacan",
      "xochimilco",
      "tlalpan",
    ];

    // Combinamos todas las áreas válidas
    this.validAreas = [
      ...this.cdmxBorough,
      ...this.edoMexMunicipalities,
      ...this.hidalgoMunicipalities,
      ...this.otherAcceptableAreas,
    ];
  }

  /**
   * Valida si una ubicación está dentro del área metropolitana de CDMX
   * @param {string} location - La ubicación a validar
   * @returns {boolean} - true si está en el área válida, false si no
   */
  isValidLocation(location) {
    if (!location || typeof location !== "string") {
      return false;
    }

    // Convertir a minúsculas y limpiar
    const cleanLocation = this.normalizeLocation(location);

    // Verificar si contiene alguna de las áreas válidas
    return this.validAreas.some((area) => {
      const normalizedArea = this.normalizeLocation(area);
      return (
        cleanLocation.includes(normalizedArea) ||
        normalizedArea.includes(cleanLocation)
      );
    });
  }

  /**
   * Normaliza una ubicación para comparación
   * @param {string} location - La ubicación a normalizar
   * @returns {string} - Ubicación normalizada
   */
  normalizeLocation(location) {
    return location
      .toLowerCase()
      .trim()
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u")
      .replace(/ñ/g, "n")
      .replace(/[.,\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extrae posibles ubicaciones de un texto
   * @param {string} text - Texto que puede contener ubicaciones
   * @returns {object} - Objeto con ubicaciones válidas e inválidas encontradas
   */
  extractPossibleLocations(text) {
    if (!text || typeof text !== "string") {
      return { validLocations: [], invalidLocations: [] };
    }

    const cleanText = this.normalizeLocation(text);
    const validLocations = [];
    const invalidLocations = [];

    // Lista de ubicaciones conocidas no válidas
    const knownInvalidAreas = [
      "guadalajara",
      "monterrey",
      "queretaro",
      "puebla",
      "tijuana",
      "cancun",
      "veracruz",
      "merida",
      "toluca",
      "leon",
      "aguascalientes",
      "morelia",
      "chihuahua",
      "saltillo",
      "hermosillo",
      "culiacan",
      "mazatlan",
      "torreon",
      "durango",
      "tampico",
      "reynosa",
      "matamoros",
      "nuevo laredo",
      "acapulco",
      "oaxaca",
      "tuxtla",
      "villahermosa",
      "campeche",
      "chetumal",
    ];

    // Buscar ubicaciones válidas
    this.validAreas.forEach((area) => {
      const normalizedArea = this.normalizeLocation(area);
      if (cleanText.includes(normalizedArea)) {
        validLocations.push(area);
      }
    });

    // Buscar ubicaciones inválidas conocidas
    knownInvalidAreas.forEach((area) => {
      const normalizedArea = this.normalizeLocation(area);
      if (cleanText.includes(normalizedArea)) {
        invalidLocations.push(area);
      }
    });

    return { validLocations, invalidLocations };
  }

  /**
   * Valida si un mensaje contiene una ubicación válida
   * @param {string} message - Mensaje del usuario
   * @returns {object} - Resultado de la validación con isValid y foundLocations
   */
  validateMessageLocation(message) {
    const { validLocations, invalidLocations } =
      this.extractPossibleLocations(message);

    return {
      isValid: validLocations.length > 0,
      foundLocations: validLocations,
      invalidLocations: invalidLocations,
      hasLocation: validLocations.length > 0 || invalidLocations.length > 0,
      originalMessage: message,
    };
  }

  /**
   * Genera mensaje de rechazo para ubicaciones no válidas
   * @param {string} userName - Nombre del usuario
   * @returns {string} - Mensaje de rechazo
   */
  getLocationRejectionMessage(userName = "") {
    const name = userName ? ` ${userName}` : "";
    return `Muchas gracias por tu tiempo${name}. Actualmente, no estamos enfocados en tu zona y, por ahora, no podremos seguir adelante con el proceso. Apreciamos mucho tu interés y esperamos poder colaborar más adelante. ¡Que tengas un gran día!`;
  }
}

module.exports = new LocationValidator();
