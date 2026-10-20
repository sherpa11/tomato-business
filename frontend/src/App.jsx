import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DateProvider } from './context/DateContext';
import { SettingsProvider } from './context/SettingsContext';

import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import Dashboard from './pages/Dashboard';
import Buyers from './pages/Buyers';
import BuyerLedger from './pages/BuyerLedger';
import Suppliers from './pages/Suppliers';
import History from './pages/History';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full border border-red-200 shadow-xl text-center space-y-4">
            <span className="text-4xl">⚠️</span>
            <h2 className="text-xl font-black text-slate-900">Something went wrong</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Reload Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <img src="/tomato.png" alt="Loading" className="w-12 h-12 object-contain animate-bounce" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Mandi System...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-16">{children}</main>
      <MobileBottomNav />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DateProvider>
          <SettingsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyers"
                  element={
                    <ProtectedRoute>
                      <Buyers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyers/:id"
                  element={
                    <ProtectedRoute>
                      <BuyerLedger />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers"
                  element={
                    <ProtectedRoute>
                      <Suppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <History />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </SettingsProvider>
        </DateProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
