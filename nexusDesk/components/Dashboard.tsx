
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { Ticket, Priority } from '../types';

interface DashboardProps {
  tickets: Ticket[];
}

const Dashboard: React.FC<DashboardProps> = ({ tickets }) => {
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    emergency: tickets.filter(t => t.priority === 'Emergency').length,
  };

  const priorityData = [
    { name: 'Low', value: tickets.filter(t => t.priority === 'Low').length, color: '#94a3b8' },
    { name: 'Medium', value: tickets.filter(t => t.priority === 'Medium').length, color: '#3b82f6' },
    { name: 'High', value: tickets.filter(t => t.priority === 'High').length, color: '#f97316' },
    { name: 'Emergency', value: tickets.filter(t => t.priority === 'Emergency').length, color: '#ef4444' },
  ];

  const categoryData = [
    { name: 'Hardware', count: tickets.filter(t => t.category === 'Hardware').length },
    { name: 'Software', count: tickets.filter(t => t.category === 'Software').length },
    { name: 'Network', count: tickets.filter(t => t.category === 'Network').length },
    { name: 'Access', count: tickets.filter(t => t.category === 'Account/Access').length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tickets', val: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Unassigned', val: stats.open, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Resolved Today', val: stats.resolved, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Critical Issues', val: stats.emergency, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((card, i) => (
          <div key={i} className={`${card.bg} p-6 rounded-2xl border border-white/50 shadow-sm transition-transform hover:scale-[1.02]`}>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} mt-2`}>{card.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Volume by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Priority Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
