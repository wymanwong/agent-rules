
import React, { useState } from 'react';
import { UserSession, SystemSettings } from '../types';
import { MOCK_USERS } from '../constants';
import { User, Shield, Briefcase, ChevronRight, Activity, PlusCircle, BookOpen, Lock, Terminal, Search, Mail, Key, UserCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserSession) => void;
  settings: SystemSettings;
}

const Login: React.FC<LoginProps> = ({ onLogin, settings }) => {
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const clientUser = MOCK_USERS.find(u => u.role === 'Client');
  const staffUsers = MOCK_USERS.filter(u => u.role !== 'Client');

  const handleMicrosoftSso = () => {
    // Simulated SSO for staff
    if (staffUsers.length > 0) {
      onLogin(staffUsers[0]);
    }
  };

  const handleClientAction = () => {
    if (clientUser) onLogin(clientUser);
  };

  return (
    <div className="min-h-screen bg-[#F9FBFF] flex flex-col font-sans overflow-hidden">
      {/* Brand Header */}
      <header className="px-12 py-8 flex items-center justify-between bg-transparent z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-200">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">NexusDesk</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Enterprise Service Management</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-[120px] -z-10" />

        <div className="w-full max-w-[500px] bg-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 p-10 lg:p-14 animate-in fade-in zoom-in duration-500">
          {!showStaffLogin ? (
            /* Main Entry: Client vs Staff Selection */
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Support Portal</h1>
                <p className="text-slate-500 font-medium">How would you like to access the platform?</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleClientAction}
                  className="w-full group p-6 bg-blue-600 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-[0.98]"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <UserCircle size={28} />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black leading-tight">Client Portal</p>
                      <p className="text-xs text-blue-100 font-medium">Check ticket status & requests</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => setShowStaffLogin(true)}
                  className="w-full group p-6 bg-white border border-slate-100 rounded-[2rem] text-slate-900 flex items-center justify-between transition-all hover:bg-slate-50 hover:border-slate-200"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center">
                      <Briefcase size={24} />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black leading-tight">Staff / IT Login</p>
                      <p className="text-xs text-slate-400 font-medium">Technician & Admin access</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            /* Detailed Staff Login */
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              <button 
                onClick={() => setShowStaffLogin(false)}
                className="flex items-center text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest mb-4"
              >
                <ChevronRight size={14} className="rotate-180 mr-1" /> Back to portal selection
              </button>

              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Technician Sign In</h2>
                <p className="text-sm text-slate-500">Access your workspace and incident queue</p>
              </div>

              <div className="space-y-6">
                {settings.ssoEnabled && (
                  <button 
                    onClick={handleMicrosoftSso}
                    className="w-full flex items-center justify-center space-x-3 py-4 px-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                      <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                      <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                      <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                    </svg>
                    <span className="text-sm font-bold text-slate-700">Sign in with Microsoft</span>
                  </button>
                )}

                {settings.localLoginEnabled && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Local Credentials</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input type="email" placeholder="Email" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input type="password" placeholder="Password" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {staffUsers.map(u => (
                        <button key={u.id} onClick={() => onLogin(u)} className="py-2.5 px-3 bg-white border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 hover:border-blue-200 transition-all">
                          Login as {u.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="p-12 text-center opacity-50">
        <div className="flex items-center justify-center space-x-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          <span>© 2024 NexusDesk Inc</span>
          <div className="w-1 h-1 bg-slate-200 rounded-full" />
          <button className="hover:text-blue-600 transition-colors">Privacy</button>
          <button className="hover:text-blue-600 transition-colors">Security</button>
        </div>
      </footer>
    </div>
  );
};

export default Login;
