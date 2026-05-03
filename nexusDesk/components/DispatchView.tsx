
import React from 'react';
import { Ticket, Agent } from '../types';
import { MOCK_AGENTS, PRIORITY_COLORS, TYPE_ICONS, CHANNEL_ICONS } from '../constants';
import { User, Activity, Clock, ChevronRight, Zap, Target, MoreHorizontal, Paperclip } from 'lucide-react';

interface DispatchViewProps {
  unassignedTickets: Ticket[];
  onDispatch: (ticketId: string, agentId: string) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

const DispatchView: React.FC<DispatchViewProps> = ({ unassignedTickets, onDispatch, onSelectTicket }) => {
  const getLoadInfo = (count: number) => {
    if (count <= 2) return { label: 'Optimal', color: 'text-emerald-500', bg: 'bg-emerald-500', light: 'bg-emerald-50' };
    if (count <= 5) return { label: 'High Load', color: 'text-blue-500', bg: 'bg-blue-500', light: 'bg-blue-50' };
    return { label: 'Critical', color: 'text-rose-500', bg: 'bg-rose-500', light: 'bg-rose-50' };
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
      {/* Queue: Unassigned */}
      <div className="xl:col-span-2 flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Dispatch Queue</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unassignedTickets.length} ITEMS WAITING</p>
            </div>
          </div>
          <button className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
          {unassignedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Activity size={40} className="opacity-10" />
              </div>
              <p className="font-bold text-slate-400">Dispatch queue is empty.</p>
              <p className="text-xs mt-1">New incidents will appear here in real-time.</p>
            </div>
          ) : (
            unassignedTickets.map(ticket => (
              <div 
                key={ticket.id} 
                className="group p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer flex items-center space-x-6"
                onClick={() => onSelectTicket(ticket)}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm shadow-sm ${TYPE_ICONS[ticket.type]}`}>
                  {ticket.type.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-black font-mono text-slate-400 tracking-tighter">#{ticket.id}</span>
                    <div className="flex items-center px-1.5 py-0.5 rounded-lg bg-slate-50 text-slate-400" title={ticket.channel}>
                      {CHANNEL_ICONS[ticket.channel]}
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-current ${PRIORITY_COLORS[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                    {(ticket.attachments?.length || 0) > 0 && <Paperclip size={12} className="text-slate-300" />}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 truncate mt-1 group-hover:text-blue-600 transition-colors">{ticket.subject}</h4>
                  <div className="flex items-center mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <User size={12} className="mr-1.5 text-slate-300" /> {ticket.requester.name}
                    <span className="mx-2 text-slate-200">•</span>
                    <Clock size={12} className="mr-1.5 text-slate-300" /> {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                  <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Assign
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agents Capacity */}
      <div className="flex flex-col bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-2xl shadow-indigo-500/10 overflow-hidden text-white relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] pointer-events-none" />
        
        <div className="p-8 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-white/10">
              <Target size={20} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Personnel Load</h3>
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Live Technician Capacity</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {MOCK_AGENTS.map(agent => {
            const load = getLoadInfo(agent.activeTickets);
            return (
              <div key={agent.id} className="p-6 border border-white/5 rounded-[2rem] bg-white/5 hover:bg-white/10 transition-all group">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                        {agent.name.charAt(0)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-slate-900 ${
                        agent.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}>
                        {agent.status === 'Online' && <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500 opacity-40" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">{agent.name}</h4>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{agent.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-2xl font-black ${load.color}`}>{agent.activeTickets}</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none mt-1">INCIDENTS</span>
                    </div>
                  </div>
                </div>
                
                {/* Meter Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Workload Meter</span>
                    <span className={load.color}>{load.label}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(0,0,0,0.3)] ${load.bg}`} 
                      style={{ width: `${Math.min(agent.activeTickets * 16.6, 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {agent.specialties.map(s => (
                    <span key={s} className="text-[9px] font-black px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-slate-400 uppercase tracking-tighter">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DispatchView;
