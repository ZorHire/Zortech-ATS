import { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, Star, TrendingUp, Users, Award, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../lib/api';
import { Vendor } from '../types';

const tierConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  preferred: { label: 'Preferred', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Award },
  standard: { label: 'Standard', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-600 border-red-200', icon: XCircle },
};

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{value}%</span>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const tier = tierConfig[vendor.tier];
  const TierIcon = tier.icon;

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all ${!vendor.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{vendor.company_name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{vendor.company_name}</h3>
            <p className="text-xs text-gray-500 truncate">{vendor.primary_contact_name}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${tier.color}`}>
          <TierIcon size={11} />
          {tier.label}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Quality Score</span>
        </div>
        <ScoreBar value={vendor.quality_score} color={vendor.quality_score >= 80 ? 'bg-emerald-500' : vendor.quality_score >= 60 ? 'bg-amber-500' : 'bg-red-400'} />

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>SLA Adherence</span>
        </div>
        <ScoreBar value={vendor.sla_adherence} color={vendor.sla_adherence >= 85 ? 'bg-blue-500' : vendor.sla_adherence >= 65 ? 'bg-amber-500' : 'bg-red-400'} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-base font-bold text-gray-900">{vendor.submission_count}</p>
          <p className="text-xs text-gray-400">Submissions</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-base font-bold text-gray-900">{vendor.shortlist_rate}%</p>
          <p className="text-xs text-gray-400">Shortlist</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-base font-bold text-gray-900">{vendor.fill_rate}%</p>
          <p className="text-xs text-gray-400">Fill Rate</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {vendor.industry_specializations.map(spec => (
          <span key={spec} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{spec}</span>
        ))}
        {vendor.geographies.slice(0, 2).map(geo => (
          <span key={geo} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{geo}</span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
          <Mail size={13} />{vendor.primary_contact_email}
        </button>
        <div className="ml-auto flex gap-1">
          <button className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
            Send Job
          </button>
          <button className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            View
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddVendor, setShowAddVendor] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const data = await api.get('/vendors');
      setVendors(data);
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = vendors.filter(v => {
    const matchSearch = v.company_name.toLowerCase().includes(search.toLowerCase()) ||
      v.primary_contact_name.toLowerCase().includes(search.toLowerCase()) ||
      v.industry_specializations.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchTier = tierFilter === 'all' || v.tier === tierFilter;
    return matchSearch && matchTier;
  });

  const stats = {
    total: vendors.length,
    preferred: vendors.filter(v => v.tier === 'preferred').length,
    standard: vendors.filter(v => v.tier === 'standard').length,
    blocked: vendors.filter(v => v.tier === 'blocked').length,
    avgQuality: vendors.length > 0 
      ? Math.round(vendors.filter(v => v.is_active).reduce((sum, v) => sum + (Number(v.quality_score) || 0), 0) / Math.max(1, vendors.filter(v => v.is_active).length))
      : 0,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Vendor Management"
        subtitle="Manage staffing partners and track performance"
        actions={
          <button
            onClick={() => setShowAddVendor(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Vendor
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.total}</span>
            </div>
            <p className="text-xs text-gray-500">Total Vendors</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award size={16} className="text-emerald-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.preferred}</span>
            </div>
            <p className="text-xs text-gray-500">Preferred (PVL)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.avgQuality}%</span>
            </div>
            <p className="text-xs text-gray-500">Avg Quality Score</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm font-semibold text-gray-900">{stats.blocked}</span>
            </div>
            <p className="text-xs text-gray-500">Blocked</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'preferred', 'standard', 'blocked'].map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`text-xs px-3 py-2.5 rounded-lg border font-medium transition-all ${
                  tierFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No vendors found</p>
            </div>
          ) : (
            filtered.map(vendor => <VendorCard key={vendor.id} vendor={vendor} />)
          )}
        </div>
      </div>

      {showAddVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Vendor</h2>
            <div className="space-y-3">
              {[
                { label: 'Company Name', placeholder: 'Staffing Agency Ltd' },
                { label: 'Contact Name', placeholder: 'Primary Contact' },
                { label: 'Contact Email', placeholder: 'contact@agency.com' },
                { label: 'Contact Phone', placeholder: '+91-XXXXXXXXXX' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type="text" placeholder={f.placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddVendor(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => setShowAddVendor(false)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add Vendor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
