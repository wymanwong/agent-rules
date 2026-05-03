
import React, { useState, useRef } from 'react';
import { Ticket, Agent, TicketStatus, Priority, Attachment } from '../types';
import { MOCK_AGENTS, PRIORITY_COLORS, STATUS_COLORS, CHANNEL_ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { 
  Send, Shield, CheckCircle, Clock, 
  CornerUpRight, Lock, MessageCircle, MoreVertical,
  Zap, Sparkles, ClipboardList, Info, Paperclip, 
  Image as ImageIcon, X, FileText, Download, Edit2, Check
} from 'lucide-react';

interface TicketDetailProps {
  ticket: Ticket;
  onUpdate: (updated: Ticket) => void;
  onClose: () => void;
  currentUserRole: string;
}

const TicketDetail: React.FC<TicketDetailProps> = ({ ticket, onUpdate, onClose, currentUserRole }) => {
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [editSubject, setEditSubject] = useState(ticket.subject);
  const [editDesc, setEditDesc] = useState(ticket.description);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDispatch = (agentId: string) => {
    onUpdate({
      ...ticket,
      assignedTo: agentId,
      status: 'Assigned',
      updatedAt: new Date().toISOString()
    });
  };

  const handleStatusChange = (status: TicketStatus) => {
    onUpdate({ ...ticket, status, updatedAt: new Date().toISOString() });
  };

  const handlePriorityChange = (priority: Priority) => {
    onUpdate({ ...ticket, priority, updatedAt: new Date().toISOString() });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: e.target?.result as string,
          type: file.type,
          size: `${(file.size / 1024).toFixed(1)} KB`
        };
        setPendingAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const postComment = () => {
    if (!comment.trim() && pendingAttachments.length === 0) return;
    
    const newComment = {
      id: Math.random().toString(36),
      author: currentUserRole === 'Client' ? ticket.requester.name : 'System Agent',
      authorRole: currentUserRole === 'Client' ? 'User' as const : 'Agent' as const,
      text: comment,
      timestamp: new Date().toISOString(),
      isInternal,
      attachments: pendingAttachments
    };

    onUpdate({ 
      ...ticket, 
      history: [...ticket.history, newComment], 
      updatedAt: new Date().toISOString() 
    });
    
    setComment('');
    setPendingAttachments([]);
  };

  const handleSaveBaseInfo = () => {
    onUpdate({
      ...ticket,
      subject: editSubject,
      description: editDesc,
      updatedAt: new Date().toISOString()
    });
    setIsEditingBase(false);
  };

  const getAiSuggestion = async () => {
    setIsAiSuggesting(true);
    const suggestion = await geminiService.suggestResolution(ticket.description);
    setComment(suggestion || "AI failed to generate a response.");
    setIsAiSuggesting(false);
  };

  const assignedAgent = MOCK_AGENTS.find(a => a.id === ticket.assignedTo);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white relative z-10">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center bg-blue-100 text-blue-600">
                INCIDENT: #{ticket.id}
              </span>
              <div className="flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-tighter">
                {CHANNEL_ICONS[ticket.channel]}
                <span className="ml-1">{ticket.channel} Source</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_COLORS[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_COLORS[ticket.status]}`}>
                {ticket.status}
              </span>
            </div>
            
            {isEditingBase ? (
              <div className="space-y-2 mt-2">
                <input 
                  value={editSubject} 
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full text-xl font-bold text-slate-900 border-b border-blue-500 outline-none"
                />
              </div>
            ) : (
              <h1 className="text-xl font-bold text-slate-900 flex items-center group">
                {ticket.subject}
                {currentUserRole === 'Client' && (
                  <button onClick={() => setIsEditingBase(true)} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 size={14} className="text-slate-400 hover:text-blue-500" />
                  </button>
                )}
              </h1>
            )}
            
            <p className="text-sm text-slate-500 mt-1">Requested by <span className="font-semibold">{ticket.requester.name}</span> • {new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 ml-4">
            <MoreVertical size={20} />
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30 custom-scrollbar">
          {/* Initial Description */}
          <div className="flex space-x-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold">
              {ticket.requester.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                {isEditingBase ? (
                  <textarea 
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full h-32 text-slate-800 outline-none resize-none"
                  />
                ) : (
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                )}
                
                {isEditingBase && (
                  <div className="mt-4 flex space-x-2">
                    <button onClick={handleSaveBaseInfo} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center">
                      <Check size={12} className="mr-1" /> Save Update
                    </button>
                    <button onClick={() => setIsEditingBase(false)} className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">Cancel</button>
                  </div>
                )}

                {/* Initial Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ticket.attachments.map(att => <AttachmentView key={att.id} attachment={att} />)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* History / Comments */}
          {ticket.history.map((msg) => (
            <div key={msg.id} className={`flex space-x-4 ${msg.isInternal ? 'opacity-90' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${msg.authorRole === 'Agent' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-blue-600 shadow-blue-100'} shadow-lg`}>
                {msg.author.charAt(0)}
              </div>
              <div className="flex-1">
                <div className={`p-5 rounded-2xl rounded-tl-none border shadow-sm ${msg.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                  {msg.isInternal && (
                    <div className="flex items-center text-[10px] font-bold text-amber-600 uppercase mb-2">
                      <Lock size={10} className="mr-1" /> Internal Note
                    </div>
                  )}
                  {msg.text && <p className="text-slate-800 whitespace-pre-wrap">{msg.text}</p>}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                       {msg.attachments.map(att => <AttachmentView key={att.id} attachment={att} />)}
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-slate-400">
                    {msg.author} • {new Date(msg.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="flex items-center space-x-4 mb-4">
            {currentUserRole !== 'Client' ? (
              <>
                <button onClick={() => setIsInternal(false)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all ${!isInternal ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>Public Reply</button>
                <button onClick={() => setIsInternal(true)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all ${isInternal ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'text-slate-400 hover:bg-slate-50'}`}>Internal Note</button>
              </>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Communication Thread</span>
            )}
            
            <div className="flex-1" />
            
            {currentUserRole !== 'Client' && (
              <button 
                onClick={getAiSuggestion}
                disabled={isAiSuggesting}
                className="flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-all"
              >
                {isAiSuggesting ? <Zap size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>AI Suggestion</span>
              </button>
            )}
          </div>
          
          {/* File Previews */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
               {pendingAttachments.map(att => (
                 <div key={att.id} className="group relative flex items-center bg-white border border-slate-200 rounded-lg pl-2 pr-8 py-1.5 text-[10px] font-bold text-slate-600">
                    {att.type.startsWith('image/') ? <ImageIcon size={12} className="mr-2 text-blue-500" /> : <FileText size={12} className="mr-2 text-slate-400" />}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button 
                      onClick={() => removePendingAttachment(att.id)}
                      className="absolute right-1 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                 </div>
               ))}
            </div>
          )}

          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isInternal ? "Write internal notes..." : "Type your response to the technician..."}
              className="w-full h-24 p-5 pb-14 bg-slate-50 rounded-[1.5rem] border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none shadow-inner"
            />
            
            <div className="absolute bottom-4 left-4 flex items-center space-x-2">
              <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                title="Attach Files"
              >
                <Paperclip size={20} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                title="Attach Images"
              >
                <ImageIcon size={20} />
              </button>
            </div>

            <button 
              onClick={postComment}
              className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar - Properties */}
      <div className="w-full lg:w-80 space-y-6 flex flex-col">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center">
            <Info size={14} className="mr-2 text-blue-600" /> System Properties
          </h3>
          
          <div className="space-y-6">
            <PropertySelect label="Ticket Status" value={ticket.status} options={['Open', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed']} onChange={(val) => handleStatusChange(val as TicketStatus)} disabled={currentUserRole === 'Client'} />
            <PropertySelect label="Severity" value={ticket.priority} options={['Low', 'Medium', 'High', 'Emergency']} onChange={(val) => handlePriorityChange(val as Priority)} disabled={currentUserRole === 'Client'} />
            
            <div className="pt-6 border-t border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Owner & Assignment</label>
              {assignedAgent ? (
                <div className="group relative flex items-center p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 transition-all hover:bg-indigo-50">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs mr-4 shadow-lg shadow-indigo-100">
                    {assignedAgent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-indigo-900 truncate">{assignedAgent.name}</p>
                    <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter truncate">{assignedAgent.department}</p>
                  </div>
                  {currentUserRole !== 'Client' && (
                    <button 
                      onClick={() => handleDispatch('')} 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-tighter"
                    >
                      Swap
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic p-6 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center">
                  Awaiting Dispatch
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Technicians */}
        {currentUserRole !== 'Client' && (
          <div className="bg-white flex-1 rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center">
              <CornerUpRight size={16} className="mr-2 text-blue-600" /> Dispatch Center
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {MOCK_AGENTS.map(agent => (
                <button 
                  key={agent.id}
                  onClick={() => handleDispatch(agent.id)}
                  disabled={ticket.assignedTo === agent.id}
                  className={`w-full flex items-center p-4 rounded-2xl border transition-all text-left group ${
                    ticket.assignedTo === agent.id 
                      ? 'bg-indigo-50 border-indigo-200 opacity-50' 
                      : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div className="relative mr-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs transition-all group-hover:bg-white group-hover:shadow-md">
                      {agent.name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${agent.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{agent.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{agent.activeTickets} Load • {agent.specialties[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PropertySelect = ({ label, value, options, onChange, disabled }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
    >
      {options.map((o: string) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const AttachmentView = ({ attachment }: { attachment: Attachment }) => {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div className="group relative flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all">
      {isImage ? (
        <div className="aspect-video w-full overflow-hidden bg-slate-200">
           <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        </div>
      ) : (
        <div className="aspect-video w-full flex items-center justify-center bg-slate-100 text-slate-400">
           <FileText size={32} />
        </div>
      )}
      <div className="p-3">
        <p className="text-[10px] font-black text-slate-700 truncate">{attachment.name}</p>
        <p className="text-[9px] text-slate-400 font-bold uppercase">{attachment.size}</p>
      </div>
      <a 
        href={attachment.url} 
        download={attachment.name}
        className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-md text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Download size={14} />
      </a>
    </div>
  );
};

export default TicketDetail;
