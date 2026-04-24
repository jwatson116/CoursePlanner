import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const AdminBootstrap: React.FC = () => {
  useEffect(() => {
    const enableAdminMode = () => {
      const calendarBadge = document.querySelector('header .bg-\\[\\#002147\\]') as HTMLElement | null;
      if (calendarBadge) {
        calendarBadge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        return;
      }
      requestAnimationFrame(enableAdminMode);
    };

    enableAdminMode();
  }, []);

  return <App />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AdminBootstrap />
  </React.StrictMode>
);
