import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useWalletStore } from './store/walletStore';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import FarmerDashboard from './pages/FarmerDashboard';
import ListProduct from './pages/ListProduct';
import BuyerDashboard from './pages/BuyerDashboard';
import OrderPage from './pages/OrderPage';
import FarmerProfile from './pages/FarmerProfile';
import AdminDashboard from './pages/AdminDashboard';
import CartPage from './pages/CartPage';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactElement; requiredRole?: string }) {
  const { connected, role } = useWalletStore();
  if (!connected) return <Navigate to="/auth" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:id" element={<ProductDetail />} />

            <Route path="/farmer/dashboard" element={
              <ProtectedRoute requiredRole="Farmer"><FarmerDashboard /></ProtectedRoute>
            } />
            <Route path="/farmer/list-product" element={
              <ProtectedRoute requiredRole="Farmer"><ListProduct /></ProtectedRoute>
            } />

            <Route path="/buyer/dashboard" element={
              <ProtectedRoute requiredRole="Buyer"><BuyerDashboard /></ProtectedRoute>
            } />

            <Route path="/orders/:id" element={
              <ProtectedRoute><OrderPage /></ProtectedRoute>
            } />

            <Route path="/cart" element={<CartPage />} />

            <Route path="/farmers/:publicKey" element={<FarmerProfile />} />

            <Route path="/admin" element={
              <ProtectedRoute requiredRole="Admin"><AdminDashboard /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
