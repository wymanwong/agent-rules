
import React, { useState, useMemo } from 'react';
import { Ticket, Priority, TicketStatus } from '../types';
import { PRIORITY_COLORS, STATUS_COLORS, MOCK_AGENTS, CHANNEL_ICONS } from '../constants';
import { Clock, User, Filter, X, ChevronDown, Calendar, UserCheck, Paperclip } from 'lucide-react';

interface TicketListProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
}

interface FilterState {
  status: TicketStatus[];
  priority: Priority[];
  assignee: string; // Agent ID
  dateStart: string;
  dateEnd: string;
}

const TicketList: React.FC<TicketListProps> = ({ tickets, onSelect }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: [],
    assignee: 'all',
    dateStart: '',
    dateEnd: '',
  });

  const toggleFilter = <K extends keyof FilterState>(key: K, value: any) => {
    setFilters(prev => {
      const current = prev[key] as any[];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter(v => v !== value) };
      }
      return { ...prev, [key]: [...current, value] };
    });
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      priority: [],
      assignee: 'all',
      dateStart: '',
      dateEnd: '',
    });
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesStatus = filters.status.length === 0 || filters.status.includes(ticket.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(ticket.priority);
      const matchesAssignee = filters.assignee === 'all' || ticket.assignedTo === filters.assignee;
      
      let matchesDate = true;
      if (filters.dateStart) {
        matchesDate = matchesDate && new Date(ticket.createdAt) >= new Date(filters.dateStart);
      }
      if (filters.dateEnd) {
        // Add one day to end date to include the whole day
        const end = new Date(filters.dateEnd);
        end.setDate(end.getDate() + 1);
        matchesDate = matchesDate && new Date(ticket.createdAt) <= end;
      }

      return matchesStatus && matchesPriority && matchesAssignee && matchesDate;
    });
  }, [tickets, filters]);

  const activeFilterCount = (
    filters.status.length + 
    filters.priority.length + 
    (filters.assignee !== 'all' ? 1 : 0) + 
    (filters.dateStart ? 1 : 0) + 
    (filters.dateEnd ? 1 : 0)
  );

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all text-sm font-semibold ${
              showFilters || activeFilterCount > 0 
                ? 'bg-blue-50 border-blue-200 text-blue-600' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          
          {activeFilterCount > 0 && (
            <button 
              onClick={clearFilters}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center"
            >
              <X size={14} className="mr-1" />
              Clear all
            </button>
          )}
        </div>
        
        <div className="text-xs font-medium text-slate-400">
          Showing {filteredTickets.length} of {tickets.length} records
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Status Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(STATUS_COLORS).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleFilter('status', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filters.status.includes(s as TicketStatus)
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRIORITY_COLORS).map((p) => (
                <button
                  key={p}
                  onClick={() => toggleFilter('priority', p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filters.priority.includes(p as Priority)
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <UserCheck size={12} className="mr-1" /> Assignee
            </label>
            <select
              value={filters.assignee}
              onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Technicians</option>
              {MOCK_AGENTS.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Calendar size={12} className="mr-1" /> Created Date Range
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters(prev => ({ ...prev, dateStart: e.target.value }))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-slate-300">-</span>
              <input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main List Table */}
      <div className="overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Source</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Requester</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => onSelect(ticket)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-slate-400">#{ticket.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                           <span className="text-sm font-semibold text-slate-800 line-clamp-1">{ticket.subject}</span>
                           {(ticket.attachments?.length || 0) > 0 && <Paperclip size={12} className="text-slate-300" />}
                        </div>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-slate-400">{ticket.category}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center p-1.5 bg-slate-100 text-slate-500 rounded-lg" title={ticket.channel}>
                        {CHANNEL_ICONS[ticket.channel || 'Web']}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${STATUS_COLORS[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 uppercase flex-shrink-0">
                          {ticket.requester.name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-slate-700 truncate">{ticket.requester.name}</span>
                          <span className="text-[10px] text-slate-400 truncate">{ticket.requester.department}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end text-slate-400 space-x-1">
                        <Clock size={12} />
                        <span className="text-xs">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <SearchX className="mb-2 opacity-20" size={40} />
                      <p className="text-sm font-medium">No records match your filters.</p>
                      <button onClick={clearFilters} className="mt-2 text-blue-600 text-xs font-bold hover:underline">Clear all filters</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SearchX = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m13.5 8.5-5 5" /><path d="m8.5 8.5 5 5" /><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

export default TicketList;
