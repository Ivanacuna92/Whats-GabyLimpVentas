import React, { useEffect, useState } from 'react';
import { fetchContacts, toggleHumanMode } from '../services/api';

function ContactsList({ contacts, setContacts, selectedContact, onSelectContact }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadContacts = async () => {
    try {
      const data = await fetchContacts();
      setContacts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando contactos:', error);
      setLoading(false);
    }
  };

  const handleToggleMode = async (phone, isHuman) => {
    try {
      await toggleHumanMode(phone, isHuman);
      setContacts(prev => prev.map(c => 
        c.phone === phone ? { ...c, isHumanMode: isHuman } : c
      ));
    } catch (error) {
      console.error('Error cambiando modo:', error);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="w-96 bg-white border-r border-gray-200 flex items-center justify-center">
      <span className="text-gray-500">Cargando contactos...</span>
    </div>;
  }

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-light text-black mb-4">CONTACTOS</h2>
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:border-black"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay contactos</div>
        ) : (
          filteredContacts.map(contact => (
            <div
              key={contact.phone}
              className={`flex items-center p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-gray-50 ${
                selectedContact?.phone === contact.phone ? 'bg-gray-100 border-l-4 border-black' : ''
              }`}
              onClick={() => onSelectContact(contact)}
            >
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-sm mr-4">
                {contact.phone.slice(-2)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-black">{contact.phone}</div>
                <div className="text-sm text-gray-500 truncate">
                  {contact.lastMessage?.text.substring(0, 30)}...
                </div>
              </div>
              <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  contact.isHumanMode 
                    ? 'bg-black text-white' 
                    : 'bg-white text-black border border-black'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleMode(contact.phone, !contact.isHumanMode);
                }}
              >
                {contact.isHumanMode ? 'HUMANO' : 'IA'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ContactsList;