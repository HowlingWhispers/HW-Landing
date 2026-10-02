import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Coda } from './Coda';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {location.pathname === '/coda' || location.pathname.startsWith('/coda/') ? <Coda /> : <App />}
  </React.StrictMode>
);