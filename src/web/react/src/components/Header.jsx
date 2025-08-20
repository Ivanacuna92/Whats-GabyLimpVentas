import React from 'react';
import logo from '../assets/logo.svg';

function Header({ currentView, onViewChange }) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex justify-between items-center">
        <img src={logo} alt="Navetec" className="h-10" />
        <nav className="flex gap-1">
          <button 
            className={`px-8 py-2 rounded-md font-medium transition-all ${
              currentView === 'dashboard' 
                ? 'bg-black text-white' 
                : 'text-gray-600 hover:text-black'
            }`}
            onClick={() => onViewChange('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`px-8 py-2 rounded-md font-medium transition-all ${
              currentView === 'contacts' 
                ? 'bg-black text-white' 
                : 'text-gray-600 hover:text-black'
            }`}
            onClick={() => onViewChange('contacts')}
          >
            Contactos
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;