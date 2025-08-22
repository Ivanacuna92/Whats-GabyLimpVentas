import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, toggleHumanMode, endConversation } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ChatPanel({ contact, onUpdateContact }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingConversation, setEndingConversation] = useState(false);
  const [supportHandledContacts, setSupportHandledContacts] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (contact) {
      setIsLoading(true);
      // Simular un pequeño delay para mostrar el loading
      const timer = setTimeout(() => {
        setIsLoading(false);
        scrollToBottom();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [contact]);

  useEffect(() => {
    scrollToBottom();
  }, [contact?.messages]);
  
  useEffect(() => {
    // Mostrar modal solo si es modo soporte Y no hay mensajes HUMAN
    if (contact?.mode === 'support' && contact?.phone) {
      // Verificar si ya hay mensajes de HUMAN en la conversación
      const hasHumanMessages = contact.messages?.some(msg => msg.type === 'HUMAN');
      
      // Solo mostrar si:
      // 1. No hay mensajes HUMAN (nadie ha tomado control)
      // 2. No se ha mostrado antes para este contacto en esta sesión
      if (!hasHumanMessages && !supportHandledContacts.has(contact.phone)) {
        setShowSupportModal(true);
        setSupportHandledContacts(prev => new Set([...prev, contact.phone]));
      } else if (hasHumanMessages) {
        // Si ya hay mensajes HUMAN, cerrar el modal si está abierto
        setShowSupportModal(false);
      }
    }
  }, [contact?.mode, contact?.phone, contact?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!message.trim() || !contact || sending) return;

    if (!contact.isHumanMode && contact.mode !== 'support') {
      // No usar alert, simplemente no enviar
      return;
    }

    setSending(true);
    try {
      await sendMessage(contact.phone, message);
      setMessage('');
      
      const newMessage = {
        type: 'HUMAN',
        message: message,
        timestamp: new Date().toISOString()
      };
      
      onUpdateContact({
        ...contact,
        messages: [...(contact.messages || []), newMessage]
      });
    } catch (error) {
      alert('Error enviando mensaje: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleToggleMode = async () => {
    try {
      // Si está en modo soporte, cambiar a IA
      if (contact.mode === 'support') {
        await toggleHumanMode(contact.phone, false);
        onUpdateContact({ ...contact, isHumanMode: false, mode: 'ai' });
      } else {
        const newMode = !contact.isHumanMode;
        await toggleHumanMode(contact.phone, newMode);
        onUpdateContact({ ...contact, isHumanMode: newMode, mode: newMode ? 'human' : 'ai' });
      }
    } catch (error) {
      // Error silencioso
    }
  };

  const handleEndConversation = async () => {
    setEndingConversation(true);
    
    try {
      await endConversation(contact.phone);
      
      // Agregar mensaje de sistema a la conversación
      const systemMessage = {
        type: 'SYSTEM',
        message: '⏰ Tu sesión de conversación ha finalizado. Puedes escribirme nuevamente para iniciar una nueva conversación.',
        timestamp: new Date().toISOString()
      };
      
      onUpdateContact({
        ...contact,
        messages: [...(contact.messages || []), systemMessage],
        isHumanMode: false
      });
      
      setShowEndModal(false);
      setEndingConversation(false);
    } catch (error) {
      setEndingConversation(false);
      alert('Error finalizando conversación: ' + error.message);
    }
  };

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h3 className="text-2xl font-light text-navetec-primary mb-2">Selecciona un contacto</h3>
          <p className="text-gray-500">Elige una conversación para comenzar</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navetec-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando conversación...</p>
        </div>
      </div>
    );
  }

  const isSupport = contact.mode === 'support';
  const supportColor = '#EA580C'; // Naranja más sutil
  
  return (
    <div className="flex-1 flex flex-col bg-gray-50 transition-all duration-300" style={isSupport ? { backgroundColor: `${supportColor}10` } : {}}>
      <div className={`bg-white border-b px-6 py-4 flex items-center justify-between transition-all duration-300 ${isSupport ? 'border-orange-400' : 'border-gray-200'}`} style={isSupport ? { borderWidth: '2px', backgroundColor: '#FFF7ED' } : {}}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-light" style={{ backgroundColor: isSupport ? supportColor : '#00567D' }}>
              {isSupport ? '👤' : contact.phone.slice(-2)}
            </div>
            {isSupport && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium" style={{ color: isSupport ? supportColor : 'black' }}>{contact.phone}</h3>
              {isSupport && (
                <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded">
                  Atención Personalizada
                </span>
              )}
            </div>
            <span className="text-sm" style={{ color: isSupport ? supportColor : '#6B7280' }}>
              {contact.mode === 'support' ? 'Modo Soporte Activo' : contact.isHumanMode ? 'Modo Humano' : 'Modo IA'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {contact.mode === 'support' ? (
            <>
              <button 
                className="px-6 py-2 rounded-md border transition-all"
                style={{
                  borderColor: supportColor,
                  color: supportColor,
                  backgroundColor: 'white'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = supportColor;
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.color = supportColor;
                }}
                onClick={async () => {
                  // Cambiar a modo IA pero sin enviar mensaje de despedida
                  await toggleHumanMode(contact.phone, false);
                  onUpdateContact({ ...contact, isHumanMode: false, mode: 'ai' });
                  
                  // Enviar mensaje informando que el bot retoma
                  const transferMessage = "El soporte ha finalizado. Continuaré atendiéndote con mucho gusto. ¿Hay algo más en lo que pueda ayudarte?";
                  await sendMessage(contact.phone, transferMessage);
                  
                  const newMessage = {
                    type: 'BOT',
                    message: transferMessage,
                    timestamp: new Date().toISOString()
                  };
                  
                  onUpdateContact({
                    ...contact,
                    messages: [...(contact.messages || []), newMessage],
                    isHumanMode: false,
                    mode: 'ai'
                  });
                }}
                title="Regresar el control al bot"
              >
                FINALIZAR SOPORTE
              </button>
              <button 
                className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all"
                onClick={() => setShowEndModal(true)}
                title="Finalizar completamente la conversación"
              >
                FINALIZAR CONVERSACIÓN
              </button>
            </>
          ) : contact.isHumanMode ? (
            <>
              <button 
                className="px-6 py-2 rounded-md border border-navetec-primary text-navetec-primary hover:bg-navetec-primary hover:text-white transition-all"
                onClick={handleToggleMode}
              >
                ACTIVAR IA
              </button>
              <button 
                className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all"
                onClick={() => setShowEndModal(true)}
                title="Finalizar conversación y enviar mensaje de cierre al cliente"
              >
                FINALIZAR CONVERSACIÓN
              </button>
            </>
          ) : (
            <button 
              className="px-6 py-2 rounded-md border border-navetec-primary text-navetec-primary hover:bg-navetec-primary hover:text-white transition-all"
              onClick={handleToggleMode}
            >
              MODO HUMANO
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
        {contact.messages?.slice().reverse().map((msg, index) => {
          const isClient = msg.type === 'USER' || msg.type === 'CLIENTE' || msg.role === 'cliente';
          const isBotOrSupport = msg.type === 'BOT' || msg.type === 'SOPORTE' || msg.role === 'bot' || msg.role === 'soporte';
          const isHumanOrBot = msg.type === 'HUMAN' || msg.type === 'BOT' || isBotOrSupport;
          const isSystem = msg.type === 'SYSTEM' || (msg.type === 'BOT' && msg.message?.includes('⏰') && msg.message?.includes('sesión'));
          
          if (isSystem) {
            return (
              <div key={index} className="flex justify-center my-3">
                <div className="bg-gray-100 border border-gray-300 px-3 py-2 rounded-md max-w-md text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">
                      Sistema
                    </span>
                    <span className="text-xs text-gray-500">
                      •
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 leading-relaxed">
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          }
          
          return (
            <div 
              key={index} 
              className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                isClient
                  ? 'bg-gray-100 border border-gray-300 text-navetec-primary' 
                  : isBotOrSupport
                    ? (msg.role === 'soporte' || msg.type === 'SOPORTE' ? 'bg-navetec-secondary-1 text-white' : 'bg-navetec-primary text-white')
                    : 'bg-white border border-gray-200 text-navetec-primary'
              }`}>
                <div className="text-xs opacity-70 mb-1">
                  {isClient ? 'CLIENTE' : 
                   msg.role === 'soporte' || msg.type === 'SOPORTE' ? `SOPORTE${msg.userName ? ` - ${msg.userName}` : ''}` : 
                   msg.type === 'HUMAN' ? (contact.mode === 'support' ? 'SOPORTE' : 'HUMANO') : 
                   msg.type === 'BOT' ? 'BOT' : 'SISTEMA'}
                </div>
                <div className="text-sm">
                  {isClient || isHumanOrBot ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({children}) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({children}) => <li className="mb-1">{children}</li>,
                        code: ({inline, children}) => 
                          inline ? 
                            <code className={`${isClient ? 'bg-gray-300' : 'bg-gray-700'} px-1 rounded`}>{children}</code> :
                            <pre className={`${isClient ? 'bg-gray-200 text-gray-800' : 'bg-gray-900 text-gray-100'} p-2 rounded overflow-x-auto my-2`}><code>{children}</code></pre>,
                        strong: ({children}) => <strong className="font-bold">{children}</strong>,
                        em: ({children}) => <em className="italic">{children}</em>,
                        a: ({href, children}) => <a href={href} className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer">{children}</a>,
                        h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                        blockquote: ({children}) => <blockquote className={`border-l-2 ${isClient ? 'border-gray-400' : 'border-gray-500'} pl-2 my-2`}>{children}</blockquote>
                      }}
                    >
                      {msg.message}
                    </ReactMarkdown>
                  ) : (
                    msg.message
                  )}
                </div>
                <div className="text-xs opacity-50 mt-2">
                  {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 p-4 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder={contact.isHumanMode || contact.mode === 'support' ? 'Escribe un mensaje...' : 'Activa MODO HUMANO para escribir'}
          disabled={(!contact.isHumanMode && contact.mode !== 'support') || sending}
          className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:border-navetec-primary disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button 
          onClick={handleSend}
          disabled={(!contact.isHumanMode && contact.mode !== 'support') || sending || !message.trim()}
          className="px-6 py-2 rounded-md bg-navetec-primary text-white hover:bg-navetec-primary-dark transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'ENVIAR'}
        </button>
      </div>

      {/* Modal de soporte activado */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EA580C' }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-center" style={{ color: '#EA580C' }}>
              Cliente Solicita Soporte
            </h3>
            <p className="text-gray-600 mb-4 text-center">
              El cliente ha solicitado atención personalizada. Puedes tomar el control de la conversación.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4">
              <p className="text-sm text-orange-800">
                <strong>Cliente:</strong> {contact.phone}
              </p>
              <p className="text-sm text-orange-800 mt-1">
                <strong>Estado:</strong> Esperando respuesta de soporte
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSupportModal(false)}
                className="flex-1 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    // Obtener el nombre del usuario actual
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    const userName = currentUser.name || 'un especialista';
                    
                    const presentationMessage = `Hola, te atiende ${userName}. 👋\n\nSerá un placer ayudarte con tu consulta. ¿En qué puedo asistirte hoy?`;
                    
                    // Cerrar el modal inmediatamente
                    setShowSupportModal(false);
                    
                    // Enviar mensaje
                    await sendMessage(contact.phone, presentationMessage);
                    
                    const newMessage = {
                      type: 'HUMAN',
                      message: presentationMessage,
                      timestamp: new Date().toISOString()
                    };
                    
                    onUpdateContact({
                      ...contact,
                      messages: [...(contact.messages || []), newMessage]
                    });
                  } catch (error) {
                    // Mostrar el error al usuario
                    alert('Error al tomar control: ' + (error.message || 'Error desconocido'));
                  }
                }}
                className="flex-1 px-4 py-2 rounded-md text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#EA580C' }}
              >
                Tomar Control
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación finalizar */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 text-navetec-primary">
              Finalizar Conversación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas finalizar esta conversación? Se enviará un mensaje de cierre al cliente y la sesión cambiará a modo IA.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6">
              <p className="text-sm text-yellow-800">
                Se enviará al cliente: "⏰ Tu sesión de conversación ha finalizado. Puedes escribirme nuevamente para iniciar una nueva conversación."
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEndModal(false)}
                disabled={endingConversation}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEndConversation}
                disabled={endingConversation}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {endingConversation ? 'Finalizando...' : 'Finalizar Conversación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPanel;