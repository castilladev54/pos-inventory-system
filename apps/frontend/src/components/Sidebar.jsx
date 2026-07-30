import { useState } from 'react';
import {
  Menu, Moon, Sun, ChevronLeft, Search, Home,
  TrendingUp, Store, ChevronDown, ClipboardCheck, Archive,
  Bell, Settings, LogOut, Image as ImageIcon, Mic, UserPlus, ShoppingBag
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import PermissionGuard from './PermissionGuard';

const Sidebar = ({ isOpen, setIsOpen, activeTab, setActiveTab }) => {
  const { user, logout } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = (menu) => {
    setOpenDropdowns((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating hamburger button for mobile when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg transition-colors
            ${isDarkMode ? 'bg-[#0f0f13]/90 text-white shadow-lg border border-white/10 hover:bg-white/10' : 'bg-white/90 text-black shadow-lg border border-gray-200 hover:bg-gray-100'}
          `}
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>
      )}

      <nav
        className={`fixed top-0 left-0 h-screen transition-all duration-300 ease-in-out z-50 flex flex-col justify-between 
          ${isDarkMode ? 'bg-[#0f0f13]/90 backdrop-blur-xl text-gray-300 border-r border-white/10' : 'bg-white/90 backdrop-blur-xl text-gray-800 border-r border-gray-200'}
          ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'}
        `}
        aria-label="Main Navigation"
      >
      {/* Container to scroll the menu content */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 h-20 border-b border-transparent">
          {isOpen && (
            <div className="flex items-center gap-3 overflow-hidden text-orange-500">
              <div className="font-bold text-2xl tracking-wide whitespace-nowrap overflow-hidden">
                CastillaWeb
              </div>
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-black'}`}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isOpen ? <ChevronLeft size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Menu Container */}
        <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden remove-scrollbar">

          {/* Search */}
          <div className={`flex items-center gap-3 rounded-xl p-2.5 mb-6 transition-all ${isDarkMode ? 'bg-black/50 border border-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            <Search size={20} className="shrink-0 opacity-70" />
            {isOpen && (
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-transparent border-none outline-none w-full text-sm text-current placeholder:text-current placeholder:opacity-50"
              />
            )}
          </div>

          <ul className="space-y-2 select-none">
            {/* Inicio */}
            <li>
              <a href="#" className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}>
                <Home size={22} className="shrink-0" />
                {isOpen && <span className="font-medium whitespace-nowrap">Inicio</span>}
              </a>
            </li>

            {/* Ganancia */}
            <PermissionGuard requiredPermission="finances_access">
              <li>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'analytics' ? 'bg-white/10 text-orange-400 font-medium' : isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                >
                  <TrendingUp size={22} className="shrink-0" />
                  {isOpen && <span className="font-medium whitespace-nowrap">Ganancia</span>}
                </button>
              </li>
            </PermissionGuard>

            {/* Tienda */}
            <li>
              <button
                onClick={() => {
                  if (!isOpen) setIsOpen(true);
                  toggleDropdown('tienda');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <Store size={22} className="shrink-0" />
                  {isOpen && <span className="font-medium whitespace-nowrap">Tienda</span>}
                </div>
                {isOpen && (
                  <ChevronDown size={16} className={`transition-transform duration-300 ${openDropdowns['tienda'] ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isOpen && openDropdowns['tienda'] && (
                <ul className="mt-2 ml-4 pl-4 border-l border-white/10 space-y-2">
                  <PermissionGuard requiredPermission="inventory_access">
                    <li>
                      <button
                        onClick={() => setActiveTab("products")}
                        className={`w-full text-left block py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors ${activeTab === 'products' ? 'bg-white/10 text-orange-400 font-medium' : ''}`}
                      >
                        Productos
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab("categories")}
                        className={`w-full text-left block py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors ${activeTab === 'categories' ? 'bg-white/10 text-orange-400 font-medium' : ''}`}
                      >
                        Categorías
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab("transfers")}
                        className={`w-full text-left block py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors ${activeTab === 'transfers' ? 'bg-white/10 text-orange-400 font-medium' : ''}`}
                      >
                        Transferencias
                      </button>
                    </li>
                  </PermissionGuard>
                  <PermissionGuard requiredPermission="pos_access">
                    <li>
                      <button
                        onClick={() => setActiveTab("sales")}
                        className={`w-full text-left block py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors ${activeTab === 'sales' ? 'bg-white/10 text-orange-400 font-medium' : ''}`}
                      >
                        Punto de Venta
                      </button>
                    </li>
                  </PermissionGuard>
                </ul>
              )}
            </li>

            {/* Compras (Entradas) - Módulo Destacado */}
            <PermissionGuard requiredPermission="purchases_access">
              <li>
                <button
                  onClick={() => setActiveTab("purchases")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'purchases' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold' : isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                >
                  <ShoppingBag size={22} className="shrink-0" />
                  {isOpen && <span className="whitespace-nowrap">Registro de Compras</span>}
                </button>
              </li>
            </PermissionGuard>

            {/* Personal (RBAC) */}
            <PermissionGuard requiredPermission="staff_management">
              <li>
                <button
                  onClick={() => setActiveTab("staff")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'staff' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold' : isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                >
                  <UserPlus size={22} className="shrink-0" />
                  {isOpen && <span className="whitespace-nowrap">Personal</span>}
                </button>
              </li>
            </PermissionGuard>

            {/* Admin (Solo si el rol es admin) */}
            {user?.role === "admin" && (
              <>
                <li>
                  <button
                    onClick={() => setActiveTab("adminCreateUser")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === 'adminCreateUser' ? 'bg-orange-500/10 text-orange-400 font-medium' : isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                  >
                    <UserPlus size={22} className="shrink-0 text-orange-400" />
                    {isOpen && <span className="font-medium whitespace-nowrap">Crear Cliente</span>}
                  </button>
                </li>
              </>
            )}

            {/* Carpetas */}
            <li>
              <button
                onClick={() => {
                  if (!isOpen) setIsOpen(true);
                  toggleDropdown('carpetas');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <Archive size={22} className="shrink-0" />
                  {isOpen && <span className="font-medium whitespace-nowrap">Carpetas</span>}
                </div>
                {isOpen && (
                  <ChevronDown size={16} className={`transition-transform duration-300 ${openDropdowns['carpetas'] ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isOpen && openDropdowns['carpetas'] && (
                <ul className="mt-2 ml-4 pl-4 border-l border-white/10 space-y-2">
                  <li><a href="#" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors"><ImageIcon size={16} /> Imagenes</a></li>
                  <li><a href="#" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white/10 text-sm transition-colors"><Mic size={16} /> Audio</a></li>
                </ul>
              )}
            </li>
          </ul>
        </div>

        {/* Footer */}
        <footer className={`p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          <ul className="space-y-2 mb-4">
            <li>
              <a href="#" className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}>
                <Bell size={22} className="shrink-0" />
                {isOpen && <span className="font-medium whitespace-nowrap">Notificaciones</span>}
              </a>
            </li>
            <li>
              <a href="#" className={`flex items-center justify-between p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <Settings size={22} className="shrink-0" />
                  {isOpen && <span className="font-medium whitespace-nowrap">Configuraciones</span>}
                </div>
              </a>
            </li>
            {/* Dark mode toggle */}
            <li>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Sun size={22} className="shrink-0" /> : <Moon size={22} className="shrink-0" />}
                  {isOpen && <span className="font-medium whitespace-nowrap">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                </div>
              </button>
            </li>
          </ul>

          {/* User Profile */}
          <div className={`flex items-center justify-between p-3 mt-2 rounded-xl transition-all ${isDarkMode ? 'bg-black/50 border border-white/5' : 'bg-gray-100'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white shrink-0 font-bold uppercase shadow-lg shadow-orange-500/20">
                {user?.name?.charAt(0) || 'U'}
              </div>
              {isOpen && (
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-sm truncate">{user?.name || 'User'}</span>
                  <span className="text-xs opacity-70 truncate">{user?.email || 'user@gmail.com'}</span>
                </div>
              )}
            </div>
            {isOpen && (
              <button onClick={logout} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0" aria-label="Cerrar sesión">
                <LogOut size={20} />
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Required css for hiding scrollbar visually but keeping scrollability */}
      <style>{`
        .remove-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .remove-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
    </nav>
    </>
  );
};

export default Sidebar;
