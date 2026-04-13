import { useState, useEffect } from 'react';
import { Search, Sparkles, MapPin, Building2, Clock, UserCheck, Star, BookmarkPlus, ChevronDown, Mail } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../lib/api';
import { Candidate } from '../types';

const sourceBadgeColors: Record<string, string> = {
  linkedin: 'bg-blue-50 text-blue-700',
  indeed: 'bg-blue-50 text-blue-600',
  naukri: 'bg-orange-50 text-orange-700',
  vendor: 'bg-teal-50 text-teal-700',
  referral: 'bg-green-50 text-green-700',
  direct: 'bg-gray-100 text-gray-600',
  other: 'bg-gray-100 text-gray-600',
  monster: 'bg-purple-50 text-purple-700',
};

function ResultCard({ candidate, score }: { candidate: Candidate; score: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">
            {candidate.first_name.charAt(0)}{candidate.last_name.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{candidate.first_name} {candidate.last_name}</h3>
              <p className="text-sm text-gray-500">{candidate.current_title} at {candidate.current_company}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                score >= 85 ? 'bg-emerald-100 text-emerald-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
              }`}>
                <Star size={13} className="fill-current" />
                {score}% match
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><MapPin size={12} />{candidate.current_location}</span>
            <span className="flex items-center gap-1"><Clock size={12} />{candidate.experience_years} yrs</span>
            <span className="flex items-center gap-1"><UserCheck size={12} />{candidate.notice_period_days}d notice</span>
            {candidate.expected_ctc && (
              <span className="flex items-center gap-1"><Building2 size={12} />₹{(Number(candidate.expected_ctc) / 100000).toFixed(0)}L expected</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {candidate.skills.map(skill => (
              <span key={skill} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">{skill}</span>
            ))}
          </div>

          {candidate.summary && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{candidate.summary}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadgeColors[candidate.source] || 'bg-gray-100 text-gray-600'}`}>
          {candidate.source.charAt(0).toUpperCase() + candidate.source.slice(1)}
        </span>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              try {
                const body = `Hi ${candidate.first_name},\n\nI came across your profile and would love to connect regarding an exciting opportunity.\n\nBest regards,\nRecruiter`;
                await api.post('/email/send-single', {
                  to: candidate.email,
                  subject: "Quick catch-up - ZorHire",
                  body: body
                });
                alert('Email sent successfully!');
              } catch (error) {
                console.error('Email send error:', error);
                alert('Failed to send email.');
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all font-bold shadow-sm"
          >
            <Mail size={14} className="text-blue-600" />
            Email
          </button>
          <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <BookmarkPlus size={12} />Save
          </button>
          <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Add to Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResumeSearchPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ candidate: Candidate; score: number }>>([]);
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'boolean' | 'ai'>('boolean');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const data = await api.get('/candidates');
        setCandidates(data);
      } catch (error) {
        console.error('Fetch candidates error:', error);
      }
    };
    fetchCandidates();
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const queryLower = query.toLowerCase();
      const scored = candidates
        .map(candidate => {
          const skillMatch = candidate.skills.filter(s => s.toLowerCase().includes(queryLower) || queryLower.includes(s.toLowerCase())).length;
          const titleMatch = (candidate.current_title || '').toLowerCase().includes(queryLower) ? 20 : 0;
          const summaryMatch = (candidate.summary || '').toLowerCase().includes(queryLower) ? 10 : 0;
          const baseScore = Math.min(95, 50 + skillMatch * 10 + titleMatch + summaryMatch + Math.random() * 15);
          return { candidate, score: Math.round(baseScore) };
        })
        .filter(r => r.score > 55)
        .sort((a, b) => b.score - a.score);
      setResults(scored);
      setSearched(true);
      setLoading(false);
    }, 800);
  };

  const savedSearches = [
    { label: 'React + TypeScript, 4+ yrs, Bangalore', query: 'React TypeScript Node.js' },
    { label: 'Python ML Engineers, Remote OK', query: 'Python TensorFlow PyTorch' },
    { label: 'Senior Java Backend, Mumbai/Pune', query: 'Java Spring Boot Microservices' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Resume Search" subtitle="Search across your entire candidate database" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchMode('boolean')}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-all ${searchMode === 'boolean' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Boolean Search
            </button>
            <button
              onClick={() => setSearchMode('ai')}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all ${searchMode === 'ai' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Sparkles size={14} />AI Semantic Search
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={searchMode === 'ai'
                  ? 'e.g. "Experienced Java developer with fintech background and strong leadership..."'
                  : 'e.g. (React OR Vue) AND TypeScript AND NOT Angular'
                }
                className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                searchMode === 'ai' ? <><Sparkles size={16} />Search</> : <><Search size={16} />Search</>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { label: 'Location', options: ['All', 'Bangalore', 'Mumbai', 'Hyderabad', 'Delhi', 'Pune'] },
              { label: 'Experience', options: ['All', '0-3 yrs', '3-7 yrs', '7+ yrs'] },
              { label: 'Notice Period', options: ['Any', '< 30 days', '30-60 days', '60+ days'] },
            ].map(f => (
              <div key={f.label} className="relative">
                <select className="appearance-none pl-3 pr-7 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {f.options.map(o => <option key={o}>{f.label}: {o}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {!searched && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Saved Searches</h3>
            <div className="space-y-2">
              {savedSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s.query); }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{s.label}</span>
                  <span className="ml-auto text-xs text-blue-600">Run Search</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {searched && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {results.length} results for "{query}"
                </h3>
                <p className="text-xs text-gray-500">Ranked by {searchMode === 'ai' ? 'AI semantic relevance' : 'keyword match'}</p>
              </div>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Export</button>
                <button className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Add All to Pipeline</button>
              </div>
            </div>
            <div className="space-y-3">
              {results.map(({ candidate, score }) => (
                <ResultCard key={candidate.id} candidate={candidate} score={score} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
