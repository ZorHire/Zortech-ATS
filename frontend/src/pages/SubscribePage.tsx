import { useNavigate } from "react-router-dom";
import { Briefcase, ArrowRight, Users, BarChart3, ShieldCheck, Zap } from "lucide-react";

export default function SubscribePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-16 py-12">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-[#b47b3b] rounded-xl flex items-center justify-center shadow-xl shadow-[#967043]/25">
              <Briefcase size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#f6e6d2]">ZorHire</h1>
              <p className="text-[#d8b286] text-sm">Enterprise ATS Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-[#fff3e4] leading-tight mb-5">
            Hire smarter,
            <br />
            <span className="text-[#f0c491]">grow faster.</span>
          </h2>
          <p className="text-[#c8b29d] text-lg leading-relaxed mb-10">
            ZorHire gives staffing agencies and HR teams a unified platform to
            source, screen, and place candidates — with AI-powered pipelines
            and real-time analytics built in.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: "Team Collaboration", sub: "role-based access" },
              { icon: BarChart3, label: "Real-time Analytics", sub: "live dashboards" },
              { icon: ShieldCheck, label: "Enterprise Security", sub: "invite-only access" },
              { icon: Zap, label: "AI Screening", sub: "92% match accuracy" },
            ].map((item) => (
              <div key={item.label} className="bg-[#1b120b]/80 border border-[#f2dbc0]/15 rounded-xl p-4 flex items-start gap-3">
                <item.icon size={18} className="text-[#d4924a] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#f9e8d1]">{item.label}</p>
                  <p className="text-xs text-[#c2a687] mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center px-6 py-12 bg-[#f7efe4]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center shadow-sm shadow-[#9b713e]/25">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-[#3a230f]">ZorHire</span>
          </div>

          {/* Icon */}
          <div className="w-14 h-14 bg-[#b47b3b]/10 rounded-2xl flex items-center justify-center mb-6">
            <Zap size={26} className="text-[#b67031]" />
          </div>

          <h2 className="text-2xl font-bold text-[#3a230f] mb-2">
            Start your journey
          </h2>
          <p className="text-sm text-[#7d6651] mb-8 leading-relaxed">
            Choose a plan that fits your team and unlock the full ZorHire
            platform. No trial — subscribe and get immediate access.
          </p>

          {/* Primary CTA */}
          <button
            onClick={() => navigate("/pricing")}
            className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#b67031]/20 hover:bg-[#9b5c27] transition-all flex items-center justify-center gap-2 group mb-4"
          >
            View Plans &amp; Subscribe
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary — login */}
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3.5 rounded-xl font-bold text-sm border border-[#e5d1bb] text-[#7d6651] hover:border-[#c88a3f] hover:text-[#3a230f] transition-all"
          >
            Already subscribed? Log In
          </button>

          <div className="mt-8 pt-8 border-t border-[#e6d7c0] text-center">
            <p className="text-xs text-[#7d6651] leading-relaxed">
              ZorHire is invite-only. Your organization credentials
              <br />
              are provided by your ZorTech account manager.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
