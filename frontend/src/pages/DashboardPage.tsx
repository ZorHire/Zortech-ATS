import { Briefcase, Users, Calendar, TrendingUp, AlertTriangle, Plus, Clock, ArrowRight, CheckCircle2, ChevronUp, MoreHorizontal, LayoutGrid, Box, Search, Wallet, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { mockJobs, mockCandidates, mockApplications, pipelineStageLabels } from '../lib/mockData';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ icon: Icon, label, value, sub, color, trend, bgColor }: { icon: React.ElementType, label: string, value: string | number, sub: string, color: string, trend?: string, bgColor: string }) {
  return (
    <div className={`${bgColor} rounded-[32px] p-6 flex flex-col justify-between min-h-[160px] relative overflow-hidden group`}>
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-lg font-black text-[#111111] leading-none tracking-tight">{value}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        </div>
        <button className="text-gray-300 hover:text-gray-600 transition-colors">
          <MoreHorizontal size={18} />
        </button>
      </div>
      
      <div className="flex items-end justify-between relative z-10">
        <div className={`w-10 h-10 rounded-[14px] bg-white shadow-sm flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-0.5">
            <Plus size={10} strokeWidth={3} />{trend}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();

  const activeJobs = mockJobs.filter(j => j.status === 'active');

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Overview"
        subtitle="Recruitment Activity"
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-10">
        {/* Main Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Portfolio Style Large Card */}
          <div className="lg:col-span-6 bg-[#E3F2FF] rounded-[40px] p-8 flex flex-col justify-between relative overflow-hidden min-h-[240px]">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-[#111111] tracking-tight">Active Pipeline</h3>
                <button className="text-gray-400"><MoreHorizontal size={20} /></button>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-[#111111] tracking-tighter">1,247</span>
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Candidates</span>
              </div>
              <p className="text-xs font-bold text-gray-400 mt-1">Total active sourcing pool</p>
            </div>

            <div className="relative h-20 mt-4">
              {/* Simplified Sparkline UI */}
              <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                <path 
                  d="M0,80 Q50,70 100,85 T200,60 T300,75 T400,40" 
                  fill="none" 
                  stroke="#3B82F6" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                />
                <circle cx="350" cy="55" r="5" fill="#3B82F6" />
                <rect x="320" y="20" width="60" height="25" rx="12" fill="#111111" />
                <text x="350" y="37" textAnchor="middle" className="text-[10px] font-bold fill-white">87% Match</text>
              </svg>
            </div>
            
            <div className="flex gap-4 mt-4">
              {['1H', '24H', '1W', '1M', '1Y', 'ALL'].map((t) => (
                <button key={t} className={`text-[10px] font-black ${t === '1W' ? 'text-[#111111]' : 'text-gray-400'}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Your Assets Style Grid */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-full mb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-[#111111] tracking-tight">Quick Stats</h3>
                <button className="p-2 bg-gray-50 rounded-xl border border-gray-100"><MoreHorizontal size={16} className="text-gray-400" /></button>
              </div>
            </div>
            <StatCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} sub="open" color="text-[#6366F1]" trend="2" bgColor="bg-[#EBE9FE]" />
            <StatCard icon={Calendar} label="Interviews" value="14" sub="scheduled" color="text-[#10B981]" trend="0.31%" bgColor="bg-[#E1F7EF]" />
            <StatCard icon={AlertTriangle} label="SLA Alerts" value="02" sub="pending" color="text-[#F59E0B]" trend="0.27%" bgColor="bg-[#FEF3C7]" />
          </div>
        </div>

        {/* Lower Grid Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Market Style Table */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#111111] tracking-tight">
                Job Market <span className="text-gray-300 ml-2 text-base font-bold uppercase tracking-widest">is up 2.4%</span>
              </h3>
              <div className="flex gap-2">
                <select className="text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 uppercase tracking-widest outline-none">
                  <option>24h</option>
                </select>
                <select className="text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 uppercase tracking-widest outline-none">
                  <option>Top gainers</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-12 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="col-span-6">Position</div>
                <div className="col-span-2 text-right">Candidates</div>
                <div className="col-span-2 text-right">Match Rate</div>
                <div className="col-span-2 text-right px-2">Action</div>
              </div>
              
              <div className="space-y-2">
                {activeJobs.slice(0, 4).map((job, idx) => (
                  <div key={job.id} className="grid grid-cols-12 items-center p-4 hover:bg-gray-50 rounded-3xl transition-all group">
                    <div className="col-span-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[18px] bg-[#111111] flex items-center justify-center text-white font-black text-lg">
                        {job.title.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#111111] truncate">{job.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{job.department}</p>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-black text-[#111111]">{job.application_count}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-black text-emerald-500">+{80 + idx * 5}%</p>
                    </div>
                    <div className="col-span-2 flex justify-end px-2">
                      <button className="text-gray-300 hover:text-amber-400 transition-colors"><Star size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Banner Style Card */}
          <div className="lg:col-span-5">
            <div className="bg-[#111111] rounded-[40px] p-10 h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-64 h-64 border-[1px] border-white/10 rounded-full" />
              <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 border-[1px] border-white/5 rounded-full" />
              
              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl font-black text-white leading-tight">
                  Optimize <span className="inline-block px-3 py-1 bg-white/10 rounded-full italic font-serif">Sourcing</span> with ZorHire AI
                </h2>
                <p className="text-sm font-medium text-gray-500 leading-relaxed">
                  Automate your candidate outreach and matching with enterprise-grade intelligence.
                </p>
              </div>

              <div className="relative z-10 mt-10">
                <button className="bg-[#E3F2FF] text-[#111111] px-8 py-4 rounded-[20px] font-black text-sm hover:scale-105 transition-transform shadow-xl shadow-blue-500/10">
                  Upgrade Now
                </button>
              </div>
              
              {/* Graphic Element */}
              <div className="absolute bottom-6 right-10 opacity-20">
                 <LayoutGrid size={120} className="text-white" strokeWidth={0.5} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
