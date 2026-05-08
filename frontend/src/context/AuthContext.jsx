import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });

  const login = useCallback(async (email, senha) => {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }, []);

  const temPermissao = useCallback((perfis) => {
    if (!usuario) return false;
    if (Array.isArray(perfis)) return perfis.includes(usuario.perfil);
    return usuario.perfil === perfis;
  }, [usuario]);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, temPermissao }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
