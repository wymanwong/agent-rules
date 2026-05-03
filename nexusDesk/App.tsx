
import React, { useState, useMemo } from 'react';
import { Ticket, TicketStatus, Priority, RecordType, UserSession, UserRole, TicketChannel, SystemSettings } from './types';
import { MOCK_TICKETS, MOCK_USERS, DEFAULT_SETTINGS } from './constants';
import { 
  LayoutDashboard, 
  Inbox, 
  Users, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  HelpCircle,
  Menu,
  ChevronLeft,
  Activity,
  Zap,
  ShieldCheck,
  AlertOctagon,
  Network,
  LogOut,
  BookOpen,
  User as UserIcon,
  MessageSquare
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import DispatchView from './components/DispatchView';
import KnowledgeBase from './components/KnowledgeBase';
import Login from './components/Login';
import AdminCenter from './components/AdminCenter';

type ViewMode = 'Dashboard' | 'Incidents' | 'Dispatch' | 'Knowledge' | 'Settings' | 'MyTickets';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [view, setView] = useState<ViewMode>('Dashboard');
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // Auto-redirect based on role
  const handleLogin = (user: UserSession) => {
    setCurrentUser(user);
    if (user.role === 'Client') {
      setView('MyTickets'); // Landing page for customers
    } else {
      setView('Dashboard'); // Landing page for staff
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTicket(null);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (currentUser?.role === 'Client') {
        if (t.requester.id !== currentUser.id) return false;
      }

      if (view === 'Incidents') return t.type === 'Incident';
      if (view === 'MyTickets') return t.requester.id === currentUser?.id;
      
      return true;
    });
  }, [tickets, view, searchQuery, currentUser]);

  const handleUpdateTicket = (updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
  };

  const handleDispatch = (ticketId: string, agentId: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, assignedTo: agentId, status: 'Assigned', updatedAt: new Date().toISOString() } : t
    ));
  };

  const createNewRecord = (channel: TicketChannel = 'Web', customData?: Partial<Ticket>) => {
    if (!currentUser) return;
    const newIdNum = Math.floor(Math.random() * 9000) + 1000;
    const newId = `${systemSettings.ticketPrefix}-${newIdNum}`;
    
    const newRecord: Ticket = {
      id: newId,
      type: 'Incident',
      channel: channel,
      subject: customData?.subject || (channel === 'Email' ? 'Email-to-Ticket: [Auto Created]' : 'Reporting a new technical issue'),
      description: customData?.description || (channel === 'Email' ? `This ticket was automatically generated from an email sent to ${systemSettings.supportEmail}.` : 'Describe the details here...'),
      status: 'Open',
      priority: customData?.priority || 'Medium',
      category: 'Other',
      requester: customData?.requester || { 
        id: currentUser.id, 
        name: currentUser.name, 
        email: currentUser.email, 
        department: currentUser.role === 'Client' ? 'Consumer' : 'IT' 
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      attachments: []
    };
    
    setTickets([newRecord, ...tickets]);
    
    // If it's a simulated email, we don't necessarily want to jump view immediately 
    // unless the user is testing the dispatch queue
    if (channel !== 'Email') {
      setSelectedTicket(newRecord);
      if (currentUser.role === 'Client') {
        setView('MyTickets');
      } else {
        setView('Incidents');
      }
    }
    
    return newRecord;
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} settings={systemSettings} />;
  }

  const isClient = currentUser.role === 'Client';
  const isAdmin = currentUser.role === 'Admin';
  const isAgent = currentUser.role === 'Agent' || isAdmin;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col relative z-20`}>
        <div className="p-6 flex items-center justify-between">
          <div className={`flex items-center space-x-2 ${!isSidebarOpen && 'hidden'}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              NexusDesk
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
          <div className={`${!isSidebarOpen && 'hidden'} px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest`}>
            {isClient ? 'Customer Support' : 'Workspace'}
          </div>
          
          {isAgent && (
            <NavItem id="Dashboard" icon={LayoutDashboard} label="Analytics" active={view === 'Dashboard'} onClick={() => { setView('Dashboard'); setSelectedTicket(null); }} isOpen={isSidebarOpen} />
          )}
          
          {isClient && (
            <NavItem id="MyTickets" icon={MessageSquare} label="My Requests" active={view === 'MyTickets'} onClick={() => { setView('MyTickets'); setSelectedTicket(null); }} isOpen={isSidebarOpen} />
          )}
          
          <NavItem id="Knowledge" icon={BookOpen} label="Knowledge" active={view === 'Knowledge'} onClick={() => { setView('Knowledge'); setSelectedTicket(null); }} isOpen={isSidebarOpen} />
          
          {isAgent && (
             <NavItem id="Dispatch" icon={Zap} label="Job Dispatch" active={view === 'Dispatch'} onClick={() => { setView('Dispatch'); setSelectedTicket(null); }} isOpen={isSidebarOpen} />
          )}

          {isAgent && (
            <>
              <div className={`${!isSidebarOpen && 'hidden'} px-4 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest`}>Tickets</div>
              <NavItem id="Incidents" icon={AlertOctagon} label="All Incidents" active={view === 'Incidents'} onClick={() => { setView('Incidents'); setSelectedTicket(null); }} isOpen={isSidebarOpen} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          {isAdmin && (
            <button 
              onClick={() => { setView('Settings'); setSelectedTicket(null); }}
              className={`w-full flex items-center p-3 rounded-xl transition-all ${view === 'Settings' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ShieldCheck size={18} />
              <span className={`ml-3 font-semibold text-sm ${!isSidebarOpen && 'hidden'}`}>Admin Center</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center p-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={18} />
            <span className={`ml-3 font-semibold text-sm ${!isSidebarOpen && 'hidden'}`}>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={isClient ? "Search knowledge base or tickets..." : "Search across incidents..."}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative group">
              <button 
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">{isClient ? 'New Request' : 'New Incident'}</span>
              </button>
              
              {/* Channel Selector for creation (hidden from client) */}
              {!isClient && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
                  <button onClick={() => createNewRecord('Web')} className="w-full text-left p-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600">Via Web Portal</button>
                  <button onClick={() => createNewRecord('Email')} className="w-full text-left p-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600">Via Email Link</button>
                  <button onClick={() => createNewRecord('Phone')} className="w-full text-left p-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600">Via Phone Call</button>
                </div>
              )}
              {isClient && <button onClick={() => createNewRecord('Web')} className="absolute inset-0 z-10 opacity-0" />}
            </div>
            
            <button className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-100">
               <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{currentUser.role}</p>
               </div>
               <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md ${
                 isClient ? 'bg-blue-500' : isAgent ? 'bg-indigo-500' : 'bg-purple-500'
               }`}>
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          {selectedTicket ? (
            <div className="h-full flex flex-col">
              <button onClick={() => setSelectedTicket(null)} className="flex items-center text-slate-500 hover:text-blue-600 mb-4 font-semibold text-sm transition-colors group">
                <ChevronLeft size={18} className="mr-1 group-hover:-translate-x-1 transition-transform" /> 
                Back to {isClient ? 'My Requests' : 'Incidents'}
              </button>
              <div className="flex-1 overflow-hidden">
                <TicketDetail 
                  ticket={selectedTicket} 
                  onUpdate={handleUpdateTicket} 
                  onClose={() => setSelectedTicket(null)} 
                  currentUserRole={currentUser.role}
                />
              </div>
            </div>
          ) : (
            <>
              {view === 'Dashboard' && <Dashboard tickets={tickets} />}
              {view === 'Knowledge' && <KnowledgeBase />}
              {view === 'Dispatch' && (
                <div className="h-full flex flex-col space-y-6">
                   <h2 className="text-2xl font-bold text-slate-900">Job Dispatcher</h2>
                   <DispatchView 
                     unassignedTickets={tickets.filter(t => !t.assignedTo && t.status !== 'Closed' && t.status !== 'Resolved')} 
                     onDispatch={handleDispatch}
                     onSelectTicket={(t) => setSelectedTicket(t)}
                   />
                </div>
              )}
              {(view === 'Incidents' || view === 'MyTickets') && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        {view === 'MyTickets' ? 'My Support Requests' : 'Incident Queue'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {isClient ? 'Track and manage your technical requests' : 'Technical Incident Lifecycle'}
                      </p>
                    </div>
                  </div>
                  <TicketList tickets={filteredTickets} onSelect={(t) => setSelectedTicket(t)} />
                </div>
              )}
              {view === 'Settings' && isAdmin && (
                <AdminCenter 
                  settings={systemSettings} 
                  onUpdateSettings={(s) => setSystemSettings(s)} 
                  onSimulateEmail={(data) => createNewRecord('Email', data)}
                  onSelectTicket={(t) => { setSelectedTicket(t); setView('Incidents'); }}
                />
              )}
            </>
          )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick, isOpen }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center p-3 rounded-xl transition-all ${
      active ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    <Icon size={18} className={`${active ? 'text-blue-600' : 'text-slate-400'}`} />
    <span className={`ml-3 font-semibold text-sm ${!isOpen && 'hidden'}`}>{label}</span>
  </button>
);

export default App;
