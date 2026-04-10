import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Clock, CheckCircle2, AlertTriangle, TrendingUp, Eye, MousePointer, Users, X } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../lib/api';
import { EmailCampaign } from '../types';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: Mail },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700', icon: Clock },
  sending: { label: 'Sending...', color: 'bg-blue-100 text-blue-700', icon: Send },
  sent: { label: 'Sent', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600', icon: AlertTriangle },
};

function MetricBadge({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className={color} />
      <div>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: EmailCampaign }) {
  const cfg = statusConfig[campaign.status];
  const CfgIcon = cfg.icon;

  const openRate = campaign.delivered_count > 0 ? Math.round((campaign.opened_count / campaign.delivered_count) * 100) : 0;
  const clickRate = campaign.opened_count > 0 ? Math.round((campaign.clicked_count / campaign.opened_count) * 100) : 0;
  const bounceRate = campaign.recipient_count > 0 ? Math.round((campaign.bounced_count / campaign.recipient_count) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Mail size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          </div>
          <p className="text-xs text-gray-500 truncate">{campaign.subject}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>
          <CfgIcon size={11} />
          {cfg.label}
        </span>
      </div>

      {campaign.status === 'sent' && (
        <div className="grid grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg mb-4">
          <MetricBadge icon={Users} label="Delivered" value={`${campaign.delivered_count}`} color="text-gray-700" />
          <MetricBadge icon={Eye} label="Open Rate" value={`${openRate}%`} color={openRate >= 20 ? 'text-emerald-600' : 'text-amber-600'} />
          <MetricBadge icon={MousePointer} label="CTR" value={`${clickRate}%`} color={clickRate >= 10 ? 'text-emerald-600' : 'text-amber-600'} />
          <MetricBadge icon={TrendingUp} label="Bounce" value={`${bounceRate}%`} color={bounceRate <= 5 ? 'text-emerald-600' : 'text-red-500'} />
        </div>
      )}

      {campaign.status === 'scheduled' && campaign.scheduled_at && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg mb-4 text-xs text-amber-700">
          <Clock size={13} />
          Scheduled for {new Date(campaign.scheduled_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} at{' '}
          {new Date(campaign.scheduled_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
          <span className="ml-auto font-medium">{campaign.recipient_count} recipients</span>
        </div>
      )}

      {campaign.status === 'draft' && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4 text-xs text-gray-500">
          <Mail size={13} />
          Draft — not yet sent
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {campaign.status === 'sent' && campaign.sent_at
            ? `Sent ${new Date(campaign.sent_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
            : `Created ${new Date(campaign.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
        </span>
        <div className="ml-auto flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <button className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Edit</button>
              <button className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1">
                <Send size={11} />Schedule
              </button>
            </>
          )}
          {campaign.status === 'scheduled' && (
            <button className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Cancel</button>
          )}
          {campaign.status === 'sent' && (
            <button className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">View Report</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campaignsData, candidatesData] = await Promise.all([
          api.get('/email-campaigns'),
          api.get('/candidates')
        ]);
        setCampaigns(campaignsData);
        setCandidates(candidatesData);
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalSent = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (Number(c.delivered_count) || 0), 0);
  const totalOpened = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (Number(c.opened_count) || 0), 0);
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Email Campaigns"
        subtitle="Mass outreach and candidate communication"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Campaign
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Campaigns', value: campaigns.length, icon: Mail, color: 'text-blue-500 bg-blue-50' },
            { label: 'Emails Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-emerald-500 bg-emerald-50' },
            { label: 'Avg Open Rate', value: `${avgOpenRate}%`, icon: Eye, color: 'text-violet-500 bg-violet-50' },
            { label: 'Scheduled', value: campaigns.filter(c => c.status === 'scheduled').length, icon: Clock, color: 'text-amber-500 bg-amber-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                <stat.icon size={17} />
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Mail size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No campaigns found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Campaign</h2>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`h-1 w-12 rounded-full ${s <= campaignStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => { setShowCreate(false); setCampaignStep(1); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {campaignStep === 1 && (
                <>
                  <h3 className="font-semibold text-gray-800 text-sm">Campaign Details</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                    <input type="text" placeholder="e.g. React Developers Outreach Q2" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                    <input type="text" placeholder="e.g. Exciting Senior React Developer Opportunity" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                    <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>All React/Frontend candidates</option>
                      <option>Shortlisted candidates - Job JD-001</option>
                      <option>Pipeline Stage: Screened (all jobs)</option>
                      <option>Custom Segment...</option>
                    </select>
                  </div>
                </>
              )}
              {campaignStep === 2 && (
                <>
                  <h3 className="font-semibold text-gray-800 text-sm">Email Content</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                    <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Job Outreach Template</option>
                      <option>Interview Invite Template</option>
                      <option>Offer Letter Template</option>
                      <option>Blank Template</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
                    <textarea
                      rows={8}
                      defaultValue={`Dear {{FirstName}},\n\nI hope this message finds you well. I came across your profile and wanted to reach out about an exciting opportunity at {{Company}}.\n\nWe are looking for a {{JobTitle}} to join our team...\n\nBest regards,\n{{RecruiterName}}`}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Available tokens: {`{{FirstName}}, {{JobTitle}}, {{Company}}, {{RecruiterName}}, {{ApplyLink}}`}</p>
                  </div>
                </>
              )}
              {campaignStep === 3 && (
                <>
                  <h3 className="font-semibold text-gray-800 text-sm">Schedule & Send</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Send Time</label>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 border-2 border-blue-600 rounded-lg text-sm font-medium text-blue-600 bg-blue-50">Send Now</button>
                      <button className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Schedule</button>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">Campaign Summary</p>
                    <p>Recipients: ~{candidates.length} candidates</p>
                    <p>Subject: "Exciting Senior React Developer Opportunity"</p>
                    <p>Template: Job Outreach Template</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {campaignStep > 1 && (
                <button onClick={() => setCampaignStep(s => s - 1)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Back</button>
              )}
              {campaignStep < 3 ? (
                <button onClick={() => setCampaignStep(s => s + 1)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next</button>
              ) : (
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                  <Send size={15} />Launch Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
