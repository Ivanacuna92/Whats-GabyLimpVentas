import React, { useState } from 'react';
import ContactsList from './components/ContactsList';
import ChatPanel from './components/ChatPanel';
import Dashboard from './components/Dashboard';
import Header from './components/Header';

function App() {
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      {currentView === 'dashboard' ? (
        <Dashboard />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ContactsList 
            contacts={contacts}
            setContacts={setContacts}
            selectedContact={selectedContact}
            onSelectContact={setSelectedContact}
          />
          <ChatPanel 
            contact={selectedContact}
            onUpdateContact={(updatedContact) => {
              setSelectedContact(updatedContact);
              setContacts(prev => prev.map(c => 
                c.phone === updatedContact.phone ? updatedContact : c
              ));
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;