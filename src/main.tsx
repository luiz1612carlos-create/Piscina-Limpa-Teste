import React from 'react';
import ReactDOM from 'react-dom/client';
import AIBotManagerView from './views/admin/AIBotManagerView';
import './styles.css';

// MOCK do AppContextType
const appContextMock: any = {
  settings: {
    aiBot: {
      enabled: true,
      name: 'SOS Bot',
      systemInstructions: 'Sempre cordial. Use a tabela de preços.',
      humanHandoffMessage: 'Um atendente humano vai te atender em breve.',
      autoSchedulingEnabled: true
    },
    pricing: {
      volumeTiers: [
        { min: 0, max: 50, price: 100 },
        { min: 51, max: 100, price: 180 }
      ]
    }
  },
  updateSettings: async (newSettings: any) => {
    console.log('Atualizando settings:', newSettings);
    return Promise.resolve();
  },
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => {
    console.log(`[${type.toUpperCase()}] ${msg}`);
  },
  clients: [
    { id: '1', name: 'Cliente 1', clientStatus: 'Ativo', payment: { dueDate: new Date().toISOString() } },
    { id: '2', name: 'Cliente 2', clientStatus: 'Ativo', payment: { dueDate: new Date().toISOString() } }
  ]
};

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <AIBotManagerView appContext={appContextMock} />
    </React.StrictMode>
  );
}