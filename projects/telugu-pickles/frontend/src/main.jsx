import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import './styles.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Login, Register } from './pages/Auth';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

function NotFound() {
  return (
    <div className="container section empty" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1>404 — Page Not Found</h1>
      <p className="muted" style={{ margin: '1rem 0 2rem' }}>The requested page or route does not exist.</p>
      <Link to="/" className="btn btn-red" style={{ textDecoration: 'none' }}>Return to Platform Overview</Link>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
