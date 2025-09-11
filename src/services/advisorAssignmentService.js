const fs = require('fs');
const path = require('path');

class AdvisorAssignmentService {
    constructor() {
        this.advisors = [
            { name: 'Alicia Puente', phone: '+52 55 1234 5678' },
            { name: 'David Villagarcia', phone: '+52 55 2345 6789' },
            { name: 'Hector Lozano', phone: '+52 55 3456 7890' },
            { name: 'Percy Babb', phone: '+52 55 4567 8901' }
        ];
        
        this.dataFile = path.join(__dirname, '../../data/advisor-assignments.json');
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                this.currentIndex = data.currentIndex || 0;
                this.contactAssignments = new Map(data.contactAssignments || []);
            } else {
                this.currentIndex = 0;
                this.contactAssignments = new Map();
            }
        } catch (error) {
            console.error('Error loading advisor data:', error);
            this.currentIndex = 0;
            this.contactAssignments = new Map();
        }
    }

    saveData() {
        try {
            const dir = path.dirname(this.dataFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const data = {
                currentIndex: this.currentIndex,
                contactAssignments: Array.from(this.contactAssignments.entries()),
                lastUpdated: new Date().toISOString()
            };
            
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving advisor data:', error);
        }
    }

    getOrAssignAdvisor(contactNumber) {
        // Si el contacto ya tiene un asesor asignado, devolverlo
        if (this.contactAssignments.has(contactNumber)) {
            const advisorIndex = this.contactAssignments.get(contactNumber);
            return this.advisors[advisorIndex];
        }
        
        // Si no, asignar el siguiente asesor en la rotación
        const advisorIndex = this.currentIndex;
        const advisor = this.advisors[advisorIndex];
        
        // Guardar la asignación
        this.contactAssignments.set(contactNumber, advisorIndex);
        
        // Incrementar el índice para la próxima asignación nueva
        this.currentIndex = (this.currentIndex + 1) % this.advisors.length;
        
        // Persistir los cambios
        this.saveData();
        
        console.log(`Nuevo asesor asignado para ${contactNumber}: ${advisor.name}`);
        return advisor;
    }

    getAssignedAdvisor(contactNumber) {
        if (this.contactAssignments.has(contactNumber)) {
            const advisorIndex = this.contactAssignments.get(contactNumber);
            return this.advisors[advisorIndex];
        }
        return null;
    }

    getAllAdvisors() {
        return this.advisors;
    }

    getAllAssignments() {
        const assignments = [];
        for (const [contact, advisorIndex] of this.contactAssignments) {
            assignments.push({
                contact,
                advisor: this.advisors[advisorIndex]
            });
        }
        return assignments;
    }

    resetAssignments() {
        this.currentIndex = 0;
        this.contactAssignments.clear();
        this.saveData();
    }
}

module.exports = new AdvisorAssignmentService();