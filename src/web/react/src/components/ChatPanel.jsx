import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, toggleHumanMode } from '../services/api';

function ChatPanel({ contact, onUpdateContact }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [contact?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!message.trim() || !contact || sending) return;

    if (!contact.isHumanMode) {
      alert('Debes activar el MODO HUMANO para enviar mensajes manualmente.');
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
      const newMode = !contact.isHumanMode;
      await toggleHumanMode(contact.phone, newMode);
      onUpdateContact({ ...contact, isHumanMode: newMode });
    } catch (error) {
      console.error('Error cambiando modo:', error);
    }
  };

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h3 className="text-2xl font-light text-black mb-2">Selecciona un contacto</h3>
          <p className="text-gray-500">Elige una conversación para comenzar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-light">
            {contact.phone.slice(-2)}
          </div>
          <div>
            <h3 className="text-black font-medium">{contact.phone}</h3>
            <span className="text-gray-500 text-sm">
              {contact.isHumanMode ? 'Modo Humano' : 'Modo IA'}
            </span>
          </div>
        </div>
        <button 
          className="px-6 py-2 rounded-md border border-black text-black hover:bg-black hover:text-white transition-all"
          onClick={handleToggleMode}
        >
          {contact.isHumanMode ? 'ACTIVAR IA' : 'MODO HUMANO'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {contact.messages?.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.type === 'USER' || msg.type === 'HUMAN' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
              msg.type === 'USER' || msg.type === 'HUMAN' 
                ? 'bg-black text-white' 
                : 'bg-white border border-gray-200 text-black'
            }`}>
              <div className="text-xs opacity-70 mb-1">
                {msg.type === 'USER' ? 'CLIENTE' : 
                 msg.type === 'HUMAN' ? 'HUMANO' : 'BOT'}
              </div>
              <div className="text-sm">{msg.message}</div>
              <div className="text-xs opacity-50 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 p-4 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder={contact.isHumanMode ? 'Escribe un mensaje...' : 'Activa MODO HUMANO para escribir'}
          disabled={!contact.isHumanMode || sending}
          className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button 
          onClick={handleSend}
          disabled={!contact.isHumanMode || sending || !message.trim()}
          className="px-6 py-2 rounded-md bg-black text-white hover:bg-gray-800 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'ENVIAR'}
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;