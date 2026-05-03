
import React, { useState } from 'react';
import { 
  Users, Zap, Shield, Database, BookOpen, Clock, Globe, 
  Settings, Activity, Search, ChevronRight, Lock, Terminal, 
  Cpu, LayoutGrid, BellRing, FileCode, History, ArrowLeft, Save, Trash2, Plus,
  Mail, Settings2, Send, ExternalLink, Fingerprint, ToggleLeft, ToggleRight,
  Server, Cloud, Database as DatabaseIcon, HelpCircle, AlertCircle, Copy, Check, X, RefreshCw
} from 'lucide-react';
import { SystemSettings, Ticket, DatabaseEngine } from '../types';

type AdminSection = 'SQL' | 'API' | 'SECURITY' | 'SLA' | 'WORKFLOW' | 'TEAMS' | 'BRANDING' | 'KNOWLEDGE' | 'NOTIFICATIONS' | 'SYSTEM' | null;

interface AdminCenterProps {
  settings: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
  onSimulateEmail: (data: Partial<Ticket>) => Ticket | undefined;
  onSelectTicket: (t: Ticket) => void;
}

const AdminCenter: React.FC<AdminCenterProps> = ({ settings, onUpdateSettings, onSimulateEmail, onSelectTicket }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>(null);

  if (activeSection) {
    return (
      <AdminEditor 
        section={activeSection} 
        onBack={() => setActiveSection(null)} 
        settings={settings}
        onSave={onUpdateSettings}
        onSimulateEmail={onSimulateEmail}
        onSelectTicket={onSelectTicket}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 mb-2">
            <Shield size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Root Administration</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">System Settings</h2>
          <p className="text-slate-500 mt-2 text-lg">Manage the core infrastructure and service delivery parameters of NexusDesk.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search settings..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2 bg-emerald-50 px-4 py-2.5 rounded-2xl border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <HealthCard icon={<Cpu size={24} />} title="Uptime Score" value="99.98%" status="EXCELLENT" statusColor="text-emerald-500" bg="bg-blue-50" />
        <HealthCard icon={<LayoutGrid size={24} />} title="Active Agents" value="12 / 15" status="3 SLOTS OPEN" statusColor="text-blue-500" bg="bg-indigo-50" />
        <HealthCard icon={<DatabaseIcon size={24} />} title="DB Sync Status" value="Synced" status="12ms LATENCY" statusColor="text-amber-500" bg="bg-amber-50" />
      </div>

      <div className="space-y-12">
        <CategoryGroup title="Core Configuration">
          <AdminCard 
            icon={<Settings2 size={24} />} 
            iconColor="bg-slate-100 text-slate-900"
            title="Global Preferences" 
            desc="Configure ticket ID prefixes, company name, and general system behavior."
            meta={`Prefix: ${settings.ticketPrefix}`}
            actionText="Edit Preferences"
            onClick={() => setActiveSection('SYSTEM')}
          />
          <AdminCard 
            icon={<Shield size={24} />} 
            iconColor="bg-blue-600 text-white"
            title="Security & SSO" 
            desc="Configure Microsoft Single Sign-On, Multi-Factor Authentication, and password policies."
            meta={settings.ssoEnabled ? "SSO Enabled" : "Local Auth Only"}
            actionText="Identity Manager"
            onClick={() => setActiveSection('SECURITY')}
          />
          <AdminCard 
            icon={<DatabaseIcon size={24} />} 
            iconColor="bg-indigo-50 text-indigo-600"
            title="Database Infrastructure" 
            desc="Manage your Azure SQL, Local MS SQL, or MongoDB Atlas connectivity."
            meta={settings.databaseEngine === 'MSSQL' ? 'MS SQL Server' : 'MongoDB Atlas'}
            actionText="Database Manager"
            onClick={() => setActiveSection('SQL')}
          />
        </CategoryGroup>

        <CategoryGroup title="Service Delivery">
          <AdminCard 
            icon={<Clock size={24} />} 
            iconColor="bg-amber-50 text-amber-600"
            title="SLA & Compliance" 
            desc="Set response and resolution time targets by priority. Configure escalation pathways."
            meta="92% Compliance Target"
            actionText="Edit SLA Rules"
            onClick={() => setActiveSection('SLA')}
          />
          <AdminCard 
            icon={<Zap size={24} />} 
            iconColor="bg-indigo-50 text-indigo-600"
            title="Workflow Automation" 
            desc="Create triggers and macros to automate repetitive ticket actions and routing."
            meta="45 Active Automations"
            actionText="Automation Lab"
            onClick={() => setActiveSection('WORKFLOW')}
          />
          <AdminCard 
            icon={<Users size={24} />} 
            iconColor="bg-purple-50 text-purple-600"
            title="Team Directory" 
            desc="Manage agent departments, skill-based routing groups, and custom permissions."
            meta="3 Departments • 15 Staff"
            actionText="Manage Staff"
            onClick={() => setActiveSection('TEAMS')}
          />
        </CategoryGroup>

        <CategoryGroup title="Client Portal & UI">
          <AdminCard 
            icon={<Mail size={24} />} 
            iconColor="bg-blue-50 text-blue-600"
            title="Email-to-Ticket Integration" 
            desc="Configure IMAP/POP3 fetching to automatically turn emails into support tickets."
            meta={`Incoming: ${settings.supportEmail}`}
            actionText="Mail Connector"
            onClick={() => setActiveSection('NOTIFICATIONS')}
          />
          <AdminCard 
            icon={<Globe size={24} />} 
            iconColor="bg-slate-100 text-slate-700"
            title="Whitelabel Branding" 
            desc="Customize the client portal with your logo, brand colors, and custom subdomains."
            meta="Custom Theme: Active"
            actionText="Theme Designer"
            onClick={() => setActiveSection('BRANDING')}
          />
          <AdminCard 
            icon={<BookOpen size={24} />} 
            iconColor="bg-emerald-50 text-emerald-600"
            title="Knowledge Curation" 
            desc="Audit internal and public KB articles. Manage approval workflows for documentation."
            meta="4 Pending Approval"
            actionText="Knowledge Admin"
            onClick={() => setActiveSection('KNOWLEDGE')}
          />
        </CategoryGroup>
      </div>

      <AuditTrail />
    </div>
  );
};

const AdminEditor: React.FC<{ section: AdminSection, onBack: () => void, settings: SystemSettings, onSave: (s: SystemSettings) => void, onSimulateEmail: (data: Partial<Ticket>) => Ticket | undefined, onSelectTicket: (t: Ticket) => void }> = ({ section, onBack, settings, onSave, onSimulateEmail, onSelectTicket }) => {
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [showMongoGuide, setShowMongoGuide] = useState(false);
  
  // Test State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error', message: string, lastTested?: string }>({ status: 'idle', message: '' });

  // Simulation State
  const [simFrom, setSimFrom] = useState('customer@example.com');
  const [simSubject, setSimSubject] = useState('Urgent: System is down');
  const [simBody, setSimBody] = useState('Hello, I am having trouble logging in. Please help!');
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [lastCreatedTicket, setLastCreatedTicket] = useState<Ticket | null>(null);

  const handleFieldChange = (field: keyof SystemSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = () => {
    if (!localSettings.dbConnectionString) {
      setTestResult({ status: 'error', message: 'Connection string cannot be empty.', lastTested: new Date().toLocaleTimeString() });
      return;
    }

    setIsTestingConnection(true);
    setTestResult({ status: 'idle', message: 'Initiating handshake...' });

    // Simulate 3-step handshake: DNS -> TCP -> Auth
    setTimeout(() => {
      if (localSettings.databaseEngine === 'MongoDB' && !localSettings.dbConnectionString.includes('mongodb+srv://')) {
        setIsTestingConnection(false);
        setTestResult({ status: 'error', message: 'Invalid Protocol: MongoDB SRV string must start with mongodb+srv://', lastTested: new Date().toLocaleTimeString() });
      } else {
        setTimeout(() => {
          setIsTestingConnection(false);
          setTestResult({ 
            status: 'success', 
            message: `Handshake successful. Engine: ${localSettings.databaseEngine}. Latency: ${Math.floor(Math.random() * 50) + 10}ms`,
            lastTested: new Date().toLocaleTimeString() 
          });
        }, 1200);
      }
    }, 800);
  };

  const saveAndExit = () => {
    onSave(localSettings);
    onBack();
  };

  const runSimulation = () => {
    setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetching from ${localSettings.supportEmail}...`]);
    
    setTimeout(() => {
      const ticketData: Partial<Ticket> = {
        subject: simSubject,
        description: simBody,
        requester: {
          id: 'sim-user',
          name: simFrom.split('@')[0],
          email: simFrom,
          department: 'External Customer'
        }
      };
      
      const newTicket = onSimulateEmail(ticketData);
      if (newTicket) {
        setLastCreatedTicket(newTicket);
        setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Ticket Created: ${newTicket.id}`]);
        setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Auto-Reply sent to ${simFrom}`]);
      }
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in slide-in-from-right-4 duration-300 relative">
      <button 
        onClick={onBack}
        className="flex items-center text-slate-400 hover:text-blue-600 mb-8 font-bold text-sm transition-colors group"
      >
        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Admin Center
      </button>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {section === 'SYSTEM' && 'Global Preferences'}
              {section === 'SECURITY' && 'Security & Identity'}
              {section === 'SQL' && 'Database Infrastructure'}
              {section === 'SLA' && 'SLA & Escalation Rules'}
              {section === 'TEAMS' && 'Team & Agent Management'}
              {section === 'NOTIFICATIONS' && 'Email Integration'}
              {!['SQL', 'SLA', 'TEAMS', 'SYSTEM', 'NOTIFICATIONS', 'SECURITY'].includes(section || '') && `Configure ${section}`}
            </h2>
            <p className="text-slate-500 mt-1">Configure advanced parameters for this system module.</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all">Cancel</button>
            <button onClick={saveAndExit} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
              <Save size={14} className="mr-2" /> Save Changes
            </button>
          </div>
        </div>

        <div className="p-10 space-y-10">
          {section === 'SQL' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Data Engine</label>
                  {localSettings.databaseEngine === 'MongoDB' && (
                    <button 
                      onClick={() => setShowMongoGuide(!showMongoGuide)}
                      className="flex items-center space-x-2 text-xs font-bold text-emerald-600 hover:underline"
                    >
                      <HelpCircle size={14} />
                      <span>Setup Guide</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleFieldChange('databaseEngine', 'MSSQL')}
                    className={`flex items-center justify-center space-x-3 p-6 rounded-[2rem] border-2 transition-all ${
                      localSettings.databaseEngine === 'MSSQL' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xl shadow-blue-100' 
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <Server size={24} />
                    <div className="text-left">
                      <p className="text-sm font-black uppercase">MS SQL Server</p>
                      <p className="text-[10px] opacity-60">Azure / Enterprise</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleFieldChange('databaseEngine', 'MongoDB')}
                    className={`flex items-center justify-center space-x-3 p-6 rounded-[2rem] border-2 transition-all ${
                      localSettings.databaseEngine === 'MongoDB' 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xl shadow-emerald-100' 
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <Cloud size={24} />
                    <div className="text-left">
                      <p className="text-sm font-black uppercase">MongoDB Atlas</p>
                      <p className="text-[10px] opacity-60">NoSQL / Cloud</p>
                    </div>
                  </button>
                </div>
              </div>

              {showMongoGuide && localSettings.databaseEngine === 'MongoDB' && (
                <div className="p-8 bg-emerald-900 rounded-[2.5rem] text-white shadow-2xl animate-in slide-in-from-top-4">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                        <BookOpen size={20} className="text-emerald-400" />
                      </div>
                      <h4 className="text-lg font-black tracking-tight">Atlas Configuration Assistant</h4>
                    </div>
                    <button onClick={() => setShowMongoGuide(false)} className="text-emerald-400 hover:text-white transition-colors"><X size={20} /></button>
                  </div>
                  
                  <div className="space-y-6">
                    <GuideStep number="1" title="Build a Cluster">
                      Sign in to <a href="https://cloud.mongodb.com" target="_blank" className="text-emerald-300 underline">cloud.mongodb.com</a> and create a new project. Deploy a free M0 Shared Cluster in your preferred region.
                    </GuideStep>
                    <GuideStep number="2" title="Network Access">
                      In the Atlas Sidebar, go to <b>Security {'>'} Network Access</b>. Click &quot;Add IP Address&quot; and select <b>Allow Access from Anywhere (0.0.0.0/0)</b> for testing, or whitelist your server IP.
                    </GuideStep>
                    <GuideStep number="3" title="Create DB User">
                      Go to <b>Security {'>'} Database Access</b>. Create a user with a secure password and ensure they have the <b>Atlas Admin</b> or <b>Read and Write to any database</b> role.
                    </GuideStep>
                    <GuideStep number="4" title="Get Connection SRV">
                      On your Cluster Dashboard, click <b>Connect {'>'} Drivers</b>. Select Node.js and copy the connection string. It should look like: <br/>
                      <code className="text-[10px] bg-emerald-800 p-1.5 rounded mt-2 block font-mono text-emerald-300 truncate">mongodb+srv://user:password@cluster.mongodb.net/</code>
                    </GuideStep>
                  </div>
                </div>
              )}

              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                  <DatabaseIcon size={20} className={localSettings.databaseEngine === 'MSSQL' ? 'text-blue-500' : 'text-emerald-500'} />
                  <h4 className="text-lg font-black text-slate-900">Connection Parameters</h4>
                </div>

                {localSettings.databaseEngine === 'MSSQL' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormGroup 
                      label="Connection URL (Host)" 
                      placeholder="nexus-db.windows.net:1433" 
                      value={localSettings.dbConnectionString}
                      onChange={(e: any) => handleFieldChange('dbConnectionString', e.target.value)}
                    />
                    <FormGroup 
                      label="Database Name" 
                      placeholder="NexusDesk_Prod" 
                      value={localSettings.dbName}
                      onChange={(e: any) => handleFieldChange('dbName', e.target.value)}
                    />
                    <FormGroup label="SQL User" placeholder="sa_admin" />
                    <FormGroup label="Password" type="password" placeholder="••••••••" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">MongoDB SRV Connection String</label>
                      <div className="relative">
                        <input 
                          className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                          placeholder="mongodb+srv://user:pass@cluster0.mongodb.net/?retryWrites=true&w=majority"
                          value={localSettings.dbConnectionString}
                          onChange={(e: any) => handleFieldChange('dbConnectionString', e.target.value)}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                          <Cloud size={18} />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 italic mt-1">Make sure to replace <b>&lt;password&gt;</b> with your actual user password.</p>
                    </div>
                    <FormGroup 
                      label="Primary Database" 
                      placeholder="nexus_desk" 
                      value={localSettings.dbName}
                      onChange={(e: any) => handleFieldChange('dbName', e.target.value)}
                    />
                  </div>
                )}

                {/* Connection Result Banner */}
                {testResult.status !== 'idle' && (
                  <div className={`p-4 rounded-2xl border flex items-start space-x-3 animate-in slide-in-from-top-2 ${
                    testResult.status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    {testResult.status === 'success' ? <CheckCircle className="mt-0.5" size={16} /> : <AlertCircle className="mt-0.5" size={16} />}
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-widest">{testResult.status === 'success' ? 'Success' : 'Connection Failed'}</p>
                      <p className="text-[10px] font-medium opacity-80 mt-1">{testResult.message}</p>
                    </div>
                    <span className="text-[9px] font-bold opacity-50">Last tested: {testResult.lastTested}</span>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      localSettings.databaseEngine === 'MSSQL' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {isTestingConnection ? <RefreshCw className="animate-spin" size={20} /> : <Activity size={20} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Health Check</h4>
                      <p className="text-xs text-slate-500">Status: {isTestingConnection ? 'Testing Handshake...' : testResult.status === 'success' ? 'Connected' : 'Offline'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
                  >
                    {!isTestingConnection && <Zap size={12} className="text-amber-500" />}
                    <span>{isTestingConnection ? 'Pinging...' : 'Test Handshake'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === 'SECURITY' && (
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Fingerprint size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">Microsoft SSO</h4>
                      <p className="text-xs text-slate-500 font-medium">Enable Azure AD / Microsoft Entra ID authentication.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleFieldChange('ssoEnabled', !localSettings.ssoEnabled)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all ${
                      localSettings.ssoEnabled ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {localSettings.ssoEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{localSettings.ssoEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                {localSettings.ssoEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in slide-in-from-top-4">
                    <FormGroup 
                      label="Application (Client) ID" 
                      value={localSettings.microsoftClientId}
                      onChange={(e: any) => handleFieldChange('microsoftClientId', e.target.value)}
                    />
                    <FormGroup 
                      label="Directory (Tenant) ID" 
                      value={localSettings.microsoftTenantId}
                      onChange={(e: any) => handleFieldChange('microsoftTenantId', e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authentication Fallback</h5>
                  <div className="p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Allow Local Login</p>
                      <p className="text-xs text-slate-500">Enable username/password access.</p>
                    </div>
                    <button 
                      onClick={() => handleFieldChange('localLoginEnabled', !localSettings.localLoginEnabled)}
                      className={`p-1 rounded-lg ${localSettings.localLoginEnabled ? 'text-blue-600' : 'text-slate-300'}`}
                    >
                      {localSettings.localLoginEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance</h5>
                  <div className="p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Enforce MFA</p>
                      <p className="text-xs text-slate-500">Require 2FA for all local accounts.</p>
                    </div>
                    <button 
                      onClick={() => handleFieldChange('requireMfa', !localSettings.requireMfa)}
                      className={`p-1 rounded-lg ${localSettings.requireMfa ? 'text-blue-600' : 'text-slate-300'}`}
                    >
                      {localSettings.requireMfa ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'SYSTEM' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormGroup 
                  label="Ticket Number Prefix" 
                  placeholder="e.g. INC, SRV, TKT" 
                  value={localSettings.ticketPrefix}
                  onChange={(e: any) => handleFieldChange('ticketPrefix', e.target.value)}
                />
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest mb-2">Preview</h4>
                  <p className="text-2xl font-black text-blue-900">{localSettings.ticketPrefix}-1024</p>
                  <p className="text-[10px] text-blue-600 mt-1 uppercase font-bold">New tickets will follow this sequence</p>
                </div>
              </div>
            </div>
          )}

          {section === 'NOTIFICATIONS' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormGroup 
                  label="Support Inbox Address" 
                  placeholder="support@company.com" 
                  value={localSettings.supportEmail}
                  onChange={(e: any) => handleFieldChange('supportEmail', e.target.value)}
                />
                <FormGroup 
                  label="Fetch Interval (Minutes)" 
                  placeholder="5" 
                  type="number"
                  value={localSettings.emailFetchInterval.toString()}
                  onChange={(e: any) => handleFieldChange('emailFetchInterval', parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="p-1 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                <div className="bg-slate-50 p-8 rounded-[2.4rem] space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Zap size={20} />
                      </div>
                      <h4 className="text-lg font-black text-slate-900">Email Simulation Lab</h4>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Auto-Creation</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <FormGroup label="From Email" value={simFrom} onChange={(e: any) => setSimFrom(e.target.value)} />
                      <FormGroup label="Subject" value={simSubject} onChange={(e: any) => setSimSubject(e.target.value)} />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Message Body</label>
                        <textarea 
                          className="w-full h-24 px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none shadow-inner"
                          value={simBody}
                          onChange={(e) => setSimBody(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={runSimulation}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                      >
                        <Send size={16} className="mr-2" /> Send Simulated Email
                      </button>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center">
                          <Terminal size={12} className="mr-2" /> Simulation Logs
                        </span>
                        <button onClick={() => { setSimLogs([]); setLastCreatedTicket(null); }} className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase font-bold">Clear</button>
                      </div>
                      <div className="flex-1 font-mono text-[10px] text-slate-400 space-y-2 overflow-y-auto max-h-[220px] custom-scrollbar">
                        {simLogs.length === 0 && <p className="italic opacity-50">Ready for incoming simulation...</p>}
                        {simLogs.map((log, i) => (
                          <p key={i} className={log.includes('Created') ? 'text-emerald-400' : ''}>{log}</p>
                        ))}
                      </div>
                      
                      {lastCreatedTicket && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <button 
                            onClick={() => onSelectTicket(lastCreatedTicket)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
                                <ExternalLink size={14} />
                              </div>
                              <span className="text-xs font-bold text-white uppercase tracking-tighter">View {lastCreatedTicket.id}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'SLA' && (
            <div className="space-y-8">
              <SlaRule priority="Emergency" response="2 Hours" resolution="8 Hours" color="text-red-600" />
              <SlaRule priority="High" response="4 Hours" resolution="24 Hours" color="text-orange-600" />
              <SlaRule priority="Medium" response="1 Business Day" resolution="3 Business Days" color="text-blue-600" />
              <button className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 hover:border-blue-200 hover:text-blue-500 transition-all flex items-center justify-center font-bold text-sm">
                <Plus size={18} className="mr-2" /> Add Custom SLA Policy
              </button>
            </div>
          )}

          {section === 'TEAMS' && (
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Personnel</h4>
                  <button className="text-xs font-black text-blue-600 uppercase tracking-widest">+ Invite Agent</button>
                </div>
                <div className="divide-y divide-slate-50">
                  <AgentRow name="John Agent" role="Tier 1 Tech" tickets={3} />
                  <AgentRow name="Sarah Tech" role="Network Ops" tickets={5} />
                  <AgentRow name="Mike Sys" role="SysAdmin" tickets={2} />
                </div>
             </div>
          )}

          {!['SQL', 'SLA', 'TEAMS', 'SYSTEM', 'NOTIFICATIONS', 'SECURITY'].includes(section || '') && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                <Settings size={48} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Module Editor</h3>
              <p className="text-slate-500 max-w-xs mt-2">The editor for the <b>{section}</b> module is being initialized based on current system schema.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GuideStep = ({ number, title, children }: any) => (
  <div className="flex items-start space-x-4 group">
    <div className="w-8 h-8 rounded-full bg-emerald-500 text-emerald-900 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
      {number}
    </div>
    <div>
      <h5 className="text-sm font-black text-emerald-50 uppercase tracking-widest mb-1">{title}</h5>
      <p className="text-xs text-emerald-100/70 leading-relaxed">{children}</p>
    </div>
  </div>
);

const HealthCard = ({ icon, title, value, status, statusColor, bg }: any) => (
  <div className={`white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between overflow-hidden relative group`}>
    <div className={`absolute -right-4 -top-4 w-24 h-24 ${bg} rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
    <div className="relative z-10">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
      <div className={`mt-2 flex items-center ${statusColor} text-[10px] font-bold`}>
        {status}
      </div>
    </div>
    <div className="text-slate-100 relative z-10">{icon}</div>
  </div>
);

const CategoryGroup = ({ title, children }: any) => (
  <div>
    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center">
      <div className="w-8 h-px bg-slate-200 mr-4" /> {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const AdminCard = ({ icon, iconColor, title, desc, meta, actionText, onClick }: any) => (
  <div className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col h-full relative overflow-hidden">
    <div className={`w-14 h-14 ${iconColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
      {desc}
    </p>
    <div className="mt-auto">
      <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
        <FileCode size={12} className="mr-2" /> {meta}
      </div>
      <button 
        onClick={onClick}
        className="w-full bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-slate-700 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center"
      >
        {actionText}
        <ChevronRight size={14} className="ml-2 opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all" />
      </button>
    </div>
  </div>
);

const AuditTrail = () => (
  <div className="mt-16 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
    <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-600/10 blur-[100px]" />
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
          <History size={20} className="text-blue-400" />
        </div>
        <div>
          <h4 className="text-lg font-bold">Recent System Changes</h4>
          <p className="text-xs text-slate-400">Audit logs for the last 24 hours</p>
        </div>
      </div>
      <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">View All Logs</button>
    </div>
    <div className="space-y-4">
      <AuditItem user="Super Admin" action="Updated SLA Policy: Emergency" time="2 hours ago" />
      <AuditItem user="System" action="Database Sync: Successfully completed" time="4 hours ago" />
      <AuditItem user="Super Admin" action="Modified Email Template: Ticket Resolved" time="1 day ago" />
    </div>
  </div>
);

const AuditItem = ({ user, action, time }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors cursor-default">
    <div className="flex items-center space-x-4">
      <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
      <div>
        <p className="text-sm font-bold text-slate-100">{action}</p>
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{user}</p>
      </div>
    </div>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{time}</span>
  </div>
);

const CheckCircle = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const FormGroup = ({ label, placeholder, type = "text", value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <input 
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
    />
  </div>
);

const SlaRule = ({ priority, response, resolution, color }: any) => (
  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
    <div className="flex items-center space-x-6">
      <div className={`text-sm font-black uppercase tracking-widest w-24 ${color}`}>{priority}</div>
      <div className="h-8 w-px bg-slate-200" />
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase">First Response</p>
        <p className="text-sm font-bold text-slate-900">{response}</p>
      </div>
      <div className="h-8 w-px bg-slate-200" />
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase">Resolution Target</p>
        <p className="text-sm font-bold text-slate-900">{resolution}</p>
      </div>
    </div>
    <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-500 transition-all">
      <ChevronRight size={18} />
    </button>
  </div>
);

const AgentRow = ({ name, role, tickets }: any) => (
  <div className="flex items-center justify-between py-4 group">
    <div className="flex items-center space-x-4">
      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">
        {name.charAt(0)}
      </div>
      <div>
        <h5 className="text-sm font-bold text-slate-900">{name}</h5>
        <p className="text-xs text-slate-400">{role}</p>
      </div>
    </div>
    <div className="flex items-center space-x-6">
      <div className="text-right">
        <p className="text-xs font-black text-slate-900">{tickets}</p>
        <p className="text-[10px] text-slate-400 uppercase">Active</p>
      </div>
      <button className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
        <Trash2 size={16} />
      </button>
    </div>
  </div>
);

export default AdminCenter;
