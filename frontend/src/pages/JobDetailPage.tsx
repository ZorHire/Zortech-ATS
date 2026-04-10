import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Clock, Briefcase, ChevronRight, Star, Mail, Phone, Plus, Building2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { mockJobs, mockApplications, mockCandidates, mockClients, pipelineStageLabels, jobStatusLabels } from '../lib/mockData';
import { PipelineStage } from '../types';

const kanbanStages: PipelineStage[] = [
  'new', 'sourced', 'screened', 'shortlisted', 'submitted_to_client',
  'client_interview_scheduled', 'interview_completed', 'selected', 'offer_extended'
];

const stageColors: Record<string, string> = {
  new: 'border-gray-300 bg-gray-50',
  sourced: 'border-blue-300 bg-blue-50',
  screened: 'border-cyan-300 bg-cyan-50',
  shortlisted: 'border-violet-300 bg-violet-50',
  submitted_to_client: 'border-amber-300 bg-amber-50',
  client_interview_scheduled: 'border-orange-300 bg-orange-50',
  interview_completed: 'border-purple-300 bg-purple-50',
  selected: 'border-green-300 bg-green-50',
  offer_extended: 'border-emerald-300 bg-emerald-50',
};

const stageHeaderColors: Record<string, string> = {
  new: 'text-gray-600 bg-gray-100',
  sourced: 'text-blue-700 bg-blue-100',
  screened: 'text-cyan-700 bg-cyan-100',
  shortlisted: 'text-violet-700 bg-violet-100',
  submitted_to_client: 'text-amber-700 bg-amber-100',
  client_interview_scheduled: 'text-orange-700 bg-orange-100',
  interview_completed: 'text-purple-700 bg-purple-100',
  selected: 'text-green-700 bg-green-100',
  offer_extended: 'text-emerald-700 bg-emerald-100',
};

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

function ScoreRing({ score }: { score?: number }) {
  if (!score) return null;
  const color = score >= 85 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-red-500';
  return (
    <div className={`text-xs font-bold ${color} flex items-center gap-0.5`}>
      <Star size={11} className="fill-current" />
      {score}
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = mockJobs.find(j => j.id === id);
  const client = mockClients.find(c => c.id === job?.client_id);

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Job not found</p>
          <Link to="/jobs" className="text-blue-600 text-sm hover:underline mt-2 block">Back to jobs</Link>
        </div>
      </div>
    );
  }

  const applications = mockApplications.filter(a => a.job_id === job.id);

  const appsByStage = kanbanStages.reduce((acc, stage) => {
    acc[stage] = applications.filter(a => a.stage === stage);
    return acc;
  }, {} as Record<string, typeof applications>);

  const salary = job.salary_min && job.salary_max
    ? `₹${(job.salary_min / 100000).toFixed(0)}L – ₹${(job.salary_max / 100000).toFixed(0)}L`
    : 'Not specified';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={job.title}
        subtitle={`${client?.name} · ${job.location}`}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Plus size={14} />
              Add Candidate
            </button>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              <Mail size={14} />
              Send to Vendors
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link to="/jobs" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft size={14} />Jobs</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">{job.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
              {jobStatusLabels[job.status]}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[job.priority]}`}>
              {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
            </span>
            <span className="flex items-center gap-1 text-gray-500"><MapPin size={14} />{job.location}</span>
            <span className="flex items-center gap-1 text-gray-500"><Briefcase size={14} />{job.work_mode}</span>
            <span className="flex items-center gap-1 text-gray-500"><Clock size={14} />{job.experience_min}–{job.experience_max} yrs</span>
            <span className="flex items-center gap-1 text-gray-500"><Users size={14} />{job.headcount} headcount</span>
            <span className="text-gray-500">{salary}</span>
            <div className="flex gap-1.5 ml-auto">
              {job.mandatory_skills.map(s => (
                <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">{s}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4" style={{ minWidth: `${kanbanStages.length * 240}px` }}>
            {kanbanStages.map(stage => {
              const cards = appsByStage[stage] || [];
              return (
                <div key={stage} className={`flex-shrink-0 w-56 rounded-xl border-2 ${stageColors[stage]}`}>
                  <div className={`px-3 py-2.5 flex items-center justify-between rounded-t-lg ${stageHeaderColors[stage]}`}>
                    <span className="text-xs font-semibold">{pipelineStageLabels[stage]}</span>
                    <span className="text-xs font-bold w-5 h-5 rounded-full bg-white/70 flex items-center justify-center">
                      {cards.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-24">
                    {cards.map(app => {
                      const candidate = mockCandidates.find(c => c.id === app.candidate_id);
                      if (!candidate) return null;
                      return (
                        <div key={app.id} className="bg-white rounded-lg p-3 shadow-sm border border-white hover:shadow-md transition-shadow cursor-pointer">
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <div>
                              <p className="text-xs font-semibold text-gray-900 leading-tight">{candidate.first_name} {candidate.last_name}</p>
                              <p className="text-xs text-gray-400 truncate leading-tight">{candidate.current_title}</p>
                            </div>
                            <ScoreRing score={app.ai_score} />
                          </div>
                          <p className="text-xs text-gray-500 mb-2 truncate">{candidate.current_company}</p>
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                            <button className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600">
                              <Mail size={12} />
                            </button>
                            <button className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-green-600">
                              <Phone size={12} />
                            </button>
                            <span className="ml-auto text-xs text-gray-400">
                              {candidate.notice_period_days}d notice
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                        No candidates
                      </div>
                    )}
                  </div>
                  <div className="px-2 pb-2">
                    <button className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 rounded-lg hover:bg-white/60 transition-colors flex items-center justify-center gap-1">
                      <Plus size={12} />Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
