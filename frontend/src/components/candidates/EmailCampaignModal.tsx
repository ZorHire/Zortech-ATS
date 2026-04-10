import React from 'react';
import { X, Send, Mail, Search, Check, ChevronRight } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
}

interface EmailCampaignModalProps {
  candidates: string[]; // IDs
  onClose: () => void;
  onSend: (campaignId: string) => void;
}

const EmailCampaignModal: React.FC<EmailCampaignModalProps> = ({ candidates, onClose, onSend }) => {
  const [search, setSearch] = React.useState('');
  const [selectedCampaign, setSelectedCampaign] = React.useState<string | null>(null);

  // Mock campaigns - in real app fetch from /api/v1/email-campaigns
  const campaigns: Campaign[] = [
    { id: '1', name: 'Frontend Developer Outreach', subject: 'Opportunity at TechCorp', status: 'draft' },
    { id: '2', name: 'React Expert Search', subject: 'Exciting React Role', status: 'sent' },
    { id: '3', name: 'General Talent Pool', subject: 'Stay Connected with Us', status: 'draft' },
  ];

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Email Campaign</h2>
              <p className="text-xs text-gray-500 font-medium">Sending to <span className="text-blue-600">{candidates.length}</span> candidates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign.id)}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between group ${
                  selectedCampaign === campaign.id
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50'
                }`}
              >
                <div className="text-left">
                  <p className={`text-sm font-bold ${selectedCampaign === campaign.id ? 'text-blue-700' : 'text-gray-900'}`}>
                    {campaign.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">Sub: {campaign.subject}</p>
                </div>
                {selectedCampaign === campaign.id ? (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    <Check size={14} strokeWidth={3} />
                  </div>
                ) : (
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-white text-gray-700 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={!selectedCampaign}
            onClick={() => selectedCampaign && onSend(selectedCampaign)}
            className={`flex-1 py-3 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg ${
              selectedCampaign 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
            Send Emails
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailCampaignModal;