import React from 'react';
import { X, Mail, Phone, MapPin, Clock, Calendar, Download, Eye, FileText, Send, Trash2 } from 'lucide-react';
import { Candidate } from '../../types';
import api from '../../lib/api';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (candidate: Candidate) => void;
  onDelete: (id: string) => void;
}


const CandidateModal: React.FC<CandidateModalProps> = ({ candidate, onClose, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'resume' | 'activity'>('overview');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-white to-blue-50/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">
              {candidate.first_name.charAt(0)}{candidate.last_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{candidate.first_name} {candidate.last_name}</h2>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100 uppercase tracking-wider">
                  {candidate.source}
                </span>
              </div>
              <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                {candidate.current_title} at <span className="text-gray-900">{candidate.current_company}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onDelete(candidate.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Delete Candidate"
            >
              <Trash2 size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100 bg-white">
          <div className="flex gap-8">
            {(['overview', 'resume', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-semibold border-b-2 transition-all capitalize ${
                  activeTab === tab 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column - Contact & Info */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Mail size={18} className="text-blue-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                        <p className="text-sm text-gray-700 font-medium truncate">{candidate.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Phone size={18} className="text-emerald-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Phone</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <MapPin size={18} className="text-red-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Location</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.current_location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock size={18} className="text-amber-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Notice Period</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.notice_period_days} Days</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Professional Summary</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {candidate.summary || 'No summary provided.'}
                  </p>
                  <div className="pt-4">
                    <h4 className="text-[10px] text-gray-400 font-bold uppercase mb-3">Core Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map(skill => (
                        <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Status & Actions */}
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Application Status</h3>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 font-medium">Current Stage</span>
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">Screening</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full w-1/3 rounded-full"></div>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                    <Send size={16} />
                    Move to Next Stage
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const body = `Hi ${candidate.first_name},\n\nI hope you are doing well. I would like to connect with you regarding the ${candidate.current_title} position.\n\nBest regards,\nRecruiter`;
                        await api.post('/email/send-single', {
                          to: candidate.email,
                          subject: "Inquiry - ZorHire",
                          body: body
                        });
                        alert('Email sent successfully!');
                      } catch (error) {
                        console.error('Email send error:', error);
                        alert('Failed to send email.');
                      }
                    }}
                    className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Mail size={16} />
                    Send individual Email
                  </button>
                  <button className="w-full py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <Calendar size={16} />
                    Schedule Interview
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Financials</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Current CTC</span>
                      <span className="text-sm font-bold text-gray-900">₹{candidate.current_ctc ? (candidate.current_ctc / 100000).toFixed(1) + 'L' : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Expected CTC</span>
                      <span className="text-sm font-bold text-gray-900">₹{candidate.expected_ctc ? (candidate.expected_ctc / 100000).toFixed(1) + 'L' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Resume_{candidate.last_name}.pdf</p>
                    <p className="text-[10px] text-gray-400 font-medium">Uploaded on March 12, 2024</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (candidate.resume_url) {
                        window.open(candidate.resume_url, '_blank');
                      } else {
                        alert('No resume available for download');
                      }
                    }}
                    className="px-4 py-2 bg-gray-50 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all flex items-center gap-2"
                  >
                    <Download size={14} /> Download
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
                    <Eye size={14} /> Full Screen
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-200 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300">
                {candidate.resume_url ? (
                   <div className="text-center space-y-3">
                     <FileText size={48} className="mx-auto text-gray-400" />
                     <p className="text-gray-500 font-medium">Resume Preview would be embedded here</p>
                     <p className="text-xs text-gray-400">(Using PDF.js or Google Docs Viewer)</p>
                   </div>
                ) : (
                  <div className="text-center space-y-3">
                    <FileText size={48} className="mx-auto text-gray-400" />
                    <p className="text-gray-500 font-medium">No resume uploaded</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Timeline</h3>
                <button className="text-xs font-bold text-blue-600 hover:text-blue-700">Add Note</button>
              </div>
              <div className="p-5 space-y-6">
                {[
                  { date: 'Today, 2:30 PM', user: 'Sarah Miller', action: 'moved candidate to', target: 'Technical Interview', note: 'Strong portfolio in React and Tailwind.' },
                  { date: 'Yesterday', user: 'System', action: 'received application from', target: 'LinkedIn' },
                  { date: 'March 10, 2024', user: 'John Doe', action: 'added candidate to', target: 'Senior Frontend Developer Role' }
                ].map((item, idx) => (
                  <div key={idx} className="relative pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] before:w-[2px] before:bg-gray-100 last:before:hidden">
                    <div className="absolute left-0 top-1.5 w-[24px] h-[24px] bg-white border-4 border-gray-50 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500 font-medium">{item.date}</p>
                      </div>
                      <p className="text-sm text-gray-800">
                        <span className="font-bold text-gray-900">{item.user}</span> {item.action} <span className="font-bold text-blue-600">{item.target}</span>
                      </p>
                      {item.note && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100 italic">
                          "{item.note}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;