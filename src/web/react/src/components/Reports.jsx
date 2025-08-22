import React, { useState, useEffect } from 'react';
import { getReports, updateSaleStatus, analyzeConversation } from '../services/api';

function Reports() {
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadReports();
  }, [selectedDate]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getReports(selectedDate);
      setReports(data);
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaleStatusChange = async (report, field, value) => {
    try {
      // Generar el ID de conversación basado en teléfono y fecha
      const phone = report.telefono.replace('@c.us', '');
      const date = report.fecha;
      
      await updateSaleStatus(null, { 
        phone,
        date,
        [field]: value 
      });
      
      setReports(reports.map(r => 
        r.id === report.id ? { ...r, [field]: value } : r
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Error actualizando estado de venta:', error);
    }
  };

  const formatPhone = (phone) => {
    // Remover @c.us si existe
    return phone.replace('@c.us', '');
  };

  const getStatusBadge = (report) => {
    if (report.ventaCerrada) {
      return <span className="px-2 py-1 text-xs rounded-full bg-navetec-secondary-3/20 text-navetec-primary-dark">Venta Cerrada</span>;
    }
    if (report.citaAgendada) {
      return <span className="px-2 py-1 text-xs rounded-full bg-navetec-secondary-1/20 text-navetec-secondary-1">Cita Agendada</span>;
    }
    if (report.posibleVenta) {
      return <span className="px-2 py-1 text-xs rounded-full bg-navetec-secondary-2/20 text-navetec-primary">Posible Venta</span>;
    }
    if (report.soporteActivado) {
      return <span className="px-2 py-1 text-xs rounded-full bg-navetec-primary-light/20 text-navetec-primary-light">Soporte</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Normal</span>;
  };

  const analyzeAllConversations = async () => {
    setAnalyzing(true);
    
    // Contar conversaciones con mensajes
    const conversationsToAnalyze = reports.filter(r => r.conversacion && r.conversacion.length > 0);
    setAnalyzeProgress({ current: 0, total: conversationsToAnalyze.length });
    
    try {
      for (let i = 0; i < conversationsToAnalyze.length; i++) {
        const report = conversationsToAnalyze[i];
        
        // Actualizar progreso
        setAnalyzeProgress({ current: i + 1, total: conversationsToAnalyze.length });
        
        // Marcar esta conversación como "analizando"
        setReports(prev => prev.map(r => 
          r.id === report.id 
            ? { ...r, isAnalyzing: true }
            : r
        ));
        
        const analysis = await analyzeConversation(report.conversacion);
        
        // Actualizar el estado en el backend
        await updateSaleStatus(null, {
          phone: report.telefono.replace('@c.us', ''),
          date: report.fecha,
          posibleVenta: analysis.posibleVenta,
          ventaCerrada: analysis.ventaCerrada,
          citaAgendada: analysis.citaAgendada
        });

        // Actualizar el estado local y quitar marca de analizando
        setReports(prev => prev.map(r => 
          r.id === report.id 
            ? { ...r, ...analysis, isAnalyzing: false }
            : r
        ));

        // Pequeña pausa entre análisis
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Recargar reportes para obtener datos actualizados del servidor
      await loadReports();
      
    } catch (error) {
      console.error('Error analizando conversaciones:', error);
      alert('Error al analizar conversaciones');
      // Quitar todas las marcas de analizando en caso de error
      setReports(prev => prev.map(r => ({ ...r, isAnalyzing: false })));
    } finally {
      setAnalyzing(false);
      setAnalyzeProgress({ current: 0, total: 0 });
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Hora', 'Teléfono', 'Mensajes', 'Posible Venta', 'Venta Cerrada', 'Cita Agendada', 'Soporte'];
    const csvContent = [
      headers.join(','),
      ...reports.map(r => [
        r.id,
        r.fecha,
        r.hora,
        formatPhone(r.telefono),
        r.mensajes,
        r.posibleVenta ? 'Sí' : 'No',
        r.ventaCerrada ? 'Sí' : 'No',
        r.citaAgendada ? 'Sí' : 'No',
        r.soporteActivado ? 'Sí' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-full overflow-auto">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-light text-navetec-primary">Reporte de Conversaciones</h2>
        <div className="flex gap-4 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-navetec-primary"
          />
          <button
            onClick={analyzeAllConversations}
            className="px-4 py-2 bg-navetec-primary text-white rounded-md hover:bg-navetec-primary-dark transition-all mr-2 min-w-[180px]"
            disabled={reports.length === 0 || analyzing}
          >
            {analyzing 
              ? `Analizando... ${analyzeProgress.current}/${analyzeProgress.total}` 
              : 'Analizar con IA'}
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-navetec-primary-dark text-white rounded-md hover:bg-navetec-secondary-4 transition-all"
            disabled={reports.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {analyzing && analyzeProgress.total > 0 && (
        <div className="mb-4 bg-navetec-secondary-2/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-navetec-primary">
              Analizando conversaciones con IA...
            </span>
            <span className="text-sm text-navetec-primary-dark">
              {Math.round((analyzeProgress.current / analyzeProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-navetec-secondary-2/30 rounded-full h-2">
            <div 
              className="bg-navetec-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navetec-primary"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mensajes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posible Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venta Cerrada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cita Agendada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                    No hay conversaciones para esta fecha
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className={`hover:bg-gray-50 transition-all ${report.isAnalyzing ? 'bg-navetec-secondary-2/10 animate-pulse' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {report.isAnalyzing && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navetec-primary mr-2"></div>
                        )}
                        {report.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{report.fecha}</div>
                      <div className="text-xs">{report.hora}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPhone(report.telefono)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="font-medium">{report.mensajes}</span>
                        <span className="ml-1 text-xs text-gray-400">msgs</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(report)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={report.posibleVenta}
                        onChange={(e) => handleSaleStatusChange(report, 'posibleVenta', e.target.checked)}
                        className="h-4 w-4 text-navetec-primary focus:ring-navetec-primary border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={report.ventaCerrada}
                        onChange={(e) => handleSaleStatusChange(report, 'ventaCerrada', e.target.checked)}
                        className="h-4 w-4 text-navetec-primary focus:ring-navetec-primary border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={report.citaAgendada || false}
                        onChange={(e) => handleSaleStatusChange(report, 'citaAgendada', e.target.checked)}
                        className="h-4 w-4 text-navetec-primary focus:ring-navetec-primary border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          // Crear objeto de contacto completo
                          const contact = {
                            phone: report.telefono,
                            messages: report.conversacion || [],
                            totalMessages: report.mensajes || 0,
                            userMessages: 0,
                            botMessages: 0,
                            firstContact: report.primerMensaje || new Date().toISOString(),
                            lastActivity: report.ultimoMensaje || new Date().toISOString(),
                            lastMessage: null,
                            isHumanMode: report.modoHumano || false,
                            mode: report.soporteActivado ? 'support' : (report.modoHumano ? 'human' : 'ai')
                          };
                          
                          // Contar mensajes por tipo
                          if (report.conversacion) {
                            report.conversacion.forEach(msg => {
                              if (msg.type === 'USER') contact.userMessages++;
                              if (msg.type === 'BOT' || msg.type === 'HUMAN') contact.botMessages++;
                            });
                            
                            // Obtener último mensaje
                            const lastMsg = report.conversacion[report.conversacion.length - 1];
                            if (lastMsg) {
                              contact.lastMessage = {
                                text: lastMsg.message,
                                time: lastMsg.timestamp,
                                type: lastMsg.type.toLowerCase()
                              };
                            }
                          }
                          
                          // Emitir evento con contacto completo
                          window.dispatchEvent(new CustomEvent('showChat', { detail: contact }));
                        }}
                        className="text-black hover:text-gray-600 font-medium"
                      >
                        Ver Chat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen estadístico */}
      {reports.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Total Conversaciones</div>
              <div className="text-2xl font-semibold text-navetec-primary-dark">{reports.length}</div>
            </div>
            <div className="bg-navetec-secondary-2/10 rounded-lg p-4">
              <div className="text-sm text-navetec-primary">Posibles Ventas</div>
              <div className="text-2xl font-semibold text-navetec-primary-dark">
                {reports.filter(r => r.posibleVenta).length}
              </div>
            </div>
            <div className="bg-navetec-secondary-3/10 rounded-lg p-4">
              <div className="text-sm text-navetec-secondary-3">Ventas Cerradas</div>
              <div className="text-2xl font-semibold text-navetec-primary-dark">
                {reports.filter(r => r.ventaCerrada).length}
              </div>
            </div>
            <div className="bg-navetec-secondary-1/10 rounded-lg p-4">
              <div className="text-sm text-navetec-secondary-1">Citas Agendadas</div>
              <div className="text-2xl font-semibold text-navetec-primary-dark">
                {reports.filter(r => r.citaAgendada).length}
              </div>
            </div>
            <div className="bg-navetec-primary-light/10 rounded-lg p-4">
              <div className="text-sm text-navetec-primary-light">Con Soporte</div>
              <div className="text-2xl font-semibold text-navetec-primary-dark">
                {reports.filter(r => r.soporteActivado).length}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default Reports;