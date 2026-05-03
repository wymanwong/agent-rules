
import React, { useState } from 'react';
import { KnowledgeArticle } from '../types';
import { MOCK_KNOWLEDGE } from '../constants';
import { Search, Book, Clock, ChevronRight, Eye, Tag } from 'lucide-react';

const KnowledgeBase: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  const filteredArticles = MOCK_KNOWLEDGE.filter(art => 
    art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    art.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    art.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Knowledge Base</h2>
        <p className="text-slate-500 mt-2 text-lg">Find answers to common questions and troubleshooting guides.</p>
        
        <div className="relative mt-6 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by topic, keyword, or tag..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden pb-8">
        {/* Article List */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          {filteredArticles.map(article => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className={`w-full text-left p-5 rounded-2xl border transition-all ${
                selectedArticle?.id === article.id 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 ring-2 ring-blue-100 ring-offset-2' 
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedArticle?.id === article.id ? 'text-blue-100' : 'text-blue-600'}`}>
                  {article.category}
                </span>
                <span className={`text-[10px] ${selectedArticle?.id === article.id ? 'text-blue-200' : 'text-slate-400'}`}>
                  {article.id}
                </span>
              </div>
              <h3 className="font-bold mb-3 leading-tight">{article.title}</h3>
              <div className="flex items-center space-x-4">
                <div className={`flex items-center text-[10px] ${selectedArticle?.id === article.id ? 'text-blue-200' : 'text-slate-400'}`}>
                  <Eye size={12} className="mr-1" /> {article.views}
                </div>
                <div className={`flex items-center text-[10px] ${selectedArticle?.id === article.id ? 'text-blue-200' : 'text-slate-400'}`}>
                  <Clock size={12} className="mr-1" /> {article.updatedAt}
                </div>
              </div>
            </button>
          ))}
          {filteredArticles.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Book size={48} className="mx-auto mb-4 opacity-10" />
              <p>No articles found.</p>
            </div>
          )}
        </div>

        {/* Article Reader */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {selectedArticle ? (
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
                  <Book size={16} />
                  <span>{selectedArticle.category}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Last Updated: {selectedArticle.updatedAt}
                </div>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-6">{selectedArticle.title}</h1>
              <div className="flex flex-wrap gap-2 mb-8">
                {selectedArticle.tags.map(tag => (
                  <span key={tag} className="flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    <Tag size={10} className="mr-1" /> {tag}
                  </span>
                ))}
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-lg">
                  {selectedArticle.content}
                </p>
              </div>
              <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    {selectedArticle.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedArticle.author}</p>
                    <p className="text-xs text-slate-500">Subject Matter Expert</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Was this helpful?</span>
                  <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Yes</button>
                  <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">No</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Book size={40} className="opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Select an Article</h3>
              <p className="max-w-xs">Pick a guide from the list on the left to view instructions and solutions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
