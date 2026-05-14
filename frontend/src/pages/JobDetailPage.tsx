import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  Briefcase,
  ChevronRight,
  ChevronDown,
  Mail,
  Building2,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { jobStatusLabels } from '../lib/mockData';
import { Job } from '../types';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AddCandidateModal from '../components/candidates/AddCandidateModal';

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-slate-100 text-slate-600',
  closed_filled: 'bg-blue-100 text-blue-700',
  closed_cancelled: 'bg-red-100 text-red-600',
  expired: 'bg-red-100 text-red-600',
};

const workModeLabel: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed_filled', label: 'Closed - Filled' },
  { value: 'closed_cancelled', label: 'Closed - Cancelled' },
  { value: 'expired', label: 'Expired' },
];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const canEditStatus =
    profile?.role === 'super_admin' ||
    profile?.role === 'accounts_manager' ||
    profile?.role === 'recruiter';

  const handleStatusChange = async (newStatus: string) => {
    if (!job || !id) return;
    const prev = job.status;
    setJob({ ...job, status: newStatus as Job['status'] });
    setStatusChanging(true);
    try {
      await api.patch(`/jobs/${id}`, { status: newStatus });
    } catch {
      setJob({ ...job, status: prev });
      alert('Failed to update job status');
    } finally {
      setStatusChanging(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .get(`/jobs/${id}`)
      .then((data) => setJob(data))
      .catch((err: any) => setError(err.message || 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Job Details" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Job Details" subtitle="Error" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium mb-1">{error || 'Job not found'}</p>
            <Link to="/jobs" className="text-blue-600 text-sm hover:underline mt-2 block">
              Back to jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const salary =
    job.salary_min && job.salary_max
      ? `INR ${(Number(job.salary_min) / 100000).toFixed(0)}L – INR ${(Number(job.salary_max) / 100000).toFixed(0)}L`
      : 'Not specified';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={job.title}
        subtitle={`${job.client?.name ?? ''} · ${job.location ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/pipeline/${id}`}
              className="flex items-center gap-2 px-3 py-2 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 font-medium transition-colors"
            >
              <TrendingUp size={14} />
              View Pipeline
            </Link>
            <button
              onClick={() => setIsAddCandidateOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={14} />
              Add Candidate
            </button>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Mail size={14} />
              Send to Vendors
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/jobs" className="hover:text-blue-600 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} />
            Jobs
          </Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium truncate">{job.title}</span>
        </div>

        {/* Main info card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          {/* Title + badges */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500">{job.client?.name}</span>
                {job.client?.tier === 'priority' && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                    Priority
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditStatus ? (
                <div className="relative">
                  <select
                    value={job.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusChanging}
                    className={`text-xs pl-2.5 pr-7 py-1 rounded-full font-medium cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-0 transition-opacity ${statusColors[job.status]} ${statusChanging ? 'opacity-60' : ''}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                  />
                </div>
              ) : (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}
                >
                  {jobStatusLabels[job.status]}
                </span>
              )}
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[job.priority]}`}
              >
                {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" />
                {job.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Briefcase size={14} className="text-gray-400" />
              {workModeLabel[job.work_mode]}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-gray-400" />
              {job.experience_min}–{job.experience_max} yrs
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" />
              {job.headcount} headcount
            </span>
            <span className="text-gray-500">{salary}</span>
            {job.department && (
              <span className="text-gray-500">{job.department}</span>
            )}
          </div>

          {/* Skills */}
          {job.mandatory_skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Mandatory Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.mandatory_skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.preferred_skills && job.preferred_skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Preferred Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.preferred_skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg border border-gray-200 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Description
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
          )}
        </div>

        {/* Pipeline CTA */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Candidate Pipeline</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {job.application_count
                ? `${job.application_count} candidate${job.application_count !== 1 ? 's' : ''} in pipeline`
                : 'No candidates added yet'}
            </p>
          </div>
          <Link
            to={`/pipeline/${id}`}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex-shrink-0"
          >
            <TrendingUp size={15} />
            Open Pipeline
          </Link>
        </div>
      </div>
      {isAddCandidateOpen && id && (
        <AddCandidateModal
          jobId={id}
          onClose={() => setIsAddCandidateOpen(false)}
          onSuccess={() => {
            setJob((prev) => prev
              ? { ...prev, application_count: (prev.application_count ?? 0) + 1 }
              : prev
            );
          }}
        />
      )}
    </div>
  );
}
