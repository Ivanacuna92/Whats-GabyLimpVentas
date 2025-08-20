const API_BASE = '/api';

export async function fetchStats(date) {
  const url = date ? `${API_BASE}/stats/${date}` : `${API_BASE}/stats`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error fetching stats');
  return response.json();
}

export async function fetchDates() {
  const response = await fetch(`${API_BASE}/dates`);
  if (!response.ok) throw new Error('Error fetching dates');
  return response.json();
}

export async function fetchContacts() {
  try {
    const logsResponse = await fetch(`${API_BASE}/logs/`);
    const logs = await logsResponse.json();
    
    const humanStatesResponse = await fetch(`${API_BASE}/human-states`);
    const humanStates = humanStatesResponse.ok ? await humanStatesResponse.json() : {};
    
    return processContactsFromLogs(logs, humanStates);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
}

export async function toggleHumanMode(phone, isHumanMode) {
  const response = await fetch(`${API_BASE}/human-states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, isHumanMode })
  });
  
  if (!response.ok) {
    throw new Error('Error actualizando modo');
  }
  
  return response.json();
}

export async function sendMessage(phone, message) {
  const response = await fetch(`${API_BASE}/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Error enviando mensaje');
  }
  
  return response.json();
}

function processContactsFromLogs(logs, humanStates) {
  const contacts = {};
  
  const filteredLogs = logs.filter(log => 
    log.type === 'USER' || log.type === 'BOT' || log.type === 'HUMAN'
  );
  
  filteredLogs.forEach(log => {
    const phone = log.userId || 'Sin número';
    
    if (!contacts[phone]) {
      contacts[phone] = {
        phone: phone,
        messages: [],
        totalMessages: 0,
        userMessages: 0,
        botMessages: 0,
        firstContact: log.timestamp,
        lastActivity: log.timestamp,
        lastMessage: null,
        isHumanMode: humanStates[phone] || false
      };
    }
    
    contacts[phone].messages.push(log);
    contacts[phone].totalMessages++;
    contacts[phone].lastActivity = log.timestamp;
    
    if (log.type === 'USER') {
      contacts[phone].userMessages++;
      contacts[phone].lastMessage = {
        text: log.message,
        time: log.timestamp,
        type: 'user'
      };
    } else if (log.type === 'BOT' || log.type === 'HUMAN') {
      contacts[phone].botMessages++;
      contacts[phone].lastMessage = {
        text: log.message,
        time: log.timestamp,
        type: log.type.toLowerCase()
      };
    }
  });
  
  return Object.values(contacts)
    .filter(contact => contact.phone !== 'Sin número')
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}