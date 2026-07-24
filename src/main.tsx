import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './landing.css';
import './login.css';
import './dashboard.css';
import './app-shell.css';
import './social.css';
import './salas.css';
import './tienda.css';
import './inventario.css';
import './matchmaking.css';
import './game.css';
import './tutorial.css';
import './footer.css';
import './legal.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
