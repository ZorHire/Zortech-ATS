import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MapPin, Users, Clock, ChevronDown, Briefcase, Building2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { jobStatusLabels } from '../lib/mockData';
import { Job } from '../types';
import api from '../lib/api';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_hold: 'bg-slate-100 text-slate-600 border-slate-200',
  closed_filled: 'bg-blue-50 text-blue-700 border-blue-200',
  closed_cancelled: 'bg-red-50 text-red-600 border-red-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
};

const priorityDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-green-500',
};

const workModeLabel: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
};

function JobCard({ job }: { job: Job }) {
  const salary = job.salary_min && job.salary_max
    ? `₹${(Number(job.salary_min) / 100000).toFixed(0)}L – ₹${(Number(job.salary_max) / 100000).toFixed(0)}L`
    : 'Not specified';

  return (
    <Link to={`/jobs/${job.id}`} className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${priorityDot[job.priority]}`} title={`Priority: ${job.priority}`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{job.title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 size={12} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">{job.client?.name || 'Loading...'}</span>
              {job.client?.tier === 'priority' && (
                <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">Priority</span>
              )}
            </div>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${statusColors[job.status]}`}>
          {jobStatusLabels[job.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>
        <span className="flex items-center gap-1"><Briefcase size={12} />{workModeLabel[job.work_mode]}</span>
        <span className="flex items-center gap-1"><Clock size={12} />{job.experience_min}–{job.experience_max} yrs</span>
        <span className="flex items-center gap-1"><Users size={12} />{job.headcount} position{job.headcount > 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.mandatory_skills.slice(0, 3).map(skill => (
          <span key={skill} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">{skill}</span>
        ))}
        {job.mandatory_skills.length > 3 && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">+{job.mandatory_skills.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">{salary} · {job.department}</span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Users size={12} className="text-blue-400" />
          <span className="font-medium text-blue-600">{job.application_count || 0}</span> candidates
        </span>
      </div>
    </Link>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    department: '',
    location: '',
    work_mode: 'onsite' as const,
    employment_type: 'full_time',
    experience_min: 0,
    experience_max: 5,
    salary_min: 0,
    salary_max: 0,
    headcount: 1,
    priority: 'medium' as const,
    description: '',
    mandatory_skills: ''
  });
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    fetchJobs();
    fetchClients();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await api.get('/jobs');
      setJobs(data);
    } catch (error) {
      console.error('Fetch jobs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await api.get('/clients');
      setClients(data);
    } catch (error) {
      console.error('Fetch clients error:', error);
    }
  };

  const handleAddJD = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        mandatory_skills: formData.mandatory_skills.split(',').map(s => s.trim()).filter(s => s !== '')
      };
      const newJob = await api.post('/jobs', payload);
      setJobs([newJob, ...jobs]);
      setIsAddModalOpen(false);
      setFormData({
        title: '',
        client_id: '',
        department: '',
        location: '',
        work_mode: 'onsite',
        employment_type: 'full_time',
        experience_min: 0,
        experience_max: 5,
        salary_min: 0,
        salary_max: 0,
        headcount: 1,
        priority: 'medium',
        description: '',
        mandatory_skills: ''
      });
    } catch (error) {
      alert('Failed to add job description');
    }
  };

  const filtered = jobs.filter(job => {
    const matchSearch = job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.mandatory_skills.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
      (job.client?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    all: jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    pending_review: jobs.filter(j => j.status === 'pending_review').length,
    on_hold: jobs.filter(j => j.status === 'on_hold').length,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Job Descriptions"
        subtitle={`${counts.active} active jobs across all clients`}
        actions={
          <Link to="/jobs/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} />
            New JD
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs by title or skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Status ({counts.all})</option>
                <option value="active">Active ({counts.active})</option>
                <option value="pending_review">Pending Review ({counts.pending_review})</option>
                <option value="on_hold">On Hold ({counts.on_hold})</option>
                <option value="draft">Draft</option>
                <option value="closed_filled">Closed - Filled</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white"
            >
              <Plus size={14} />
              Add JD
            </button>
            <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white">
              <Filter size={14} />
              More filters
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'pending_review', 'on_hold', 'closed_filled'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                statusFilter === status
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {status === 'all' ? `All (${counts.all})` : `${jobStatusLabels[status]} (${jobs.filter(j => j.status === status).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No jobs found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-black text-[#111111] tracking-tight">Create New Job Description</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[#111111]">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddJD} className="p-8 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Job Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Client</label>
                  <select
                    required
                    value={formData.client_id}
                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Bangalore, India"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Work Mode</label>
                  <select
                    value={formData.work_mode}
                    onChange={e => setFormData({ ...formData, work_mode: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                  >
                    <option value="onsite">Onsite</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Experience (Min - Max Yrs)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.experience_min}
                      onChange={e => setFormData({ ...formData, experience_min: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      value={formData.experience_max}
                      onChange={e => setFormData({ ...formData, experience_max: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mandatory Skills (Comma separated)</label>
                  <input
                    type="text"
                    value={formData.mandatory_skills}
                    onChange={e => setFormData({ ...formData, mandatory_skills: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="React, TypeScript, Tailwind CSS"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Job Description</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="Briefly describe the role and requirements..."
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:scale-[1.02] transition-all shadow-xl shadow-gray-200"
                >
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
