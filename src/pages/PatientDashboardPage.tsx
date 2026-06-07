import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function PatientDashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const data = localStorage.getItem('userProfile');
    if (data) {
      setUser(JSON.parse(data));
    }
  }, []);

  if (!user) {
    return (
      <div className="w-full flex justify-center mt-20">
        <p className="text-[#8B8B86]">Please log in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto mt-8 sm:mt-12 px-4 pb-12"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 sm:p-10 border border-white/60 shadow-[0_8px_32px_rgb(0,0,0,0.04)] mb-8">
        <h1 className="text-3xl font-bold text-[#1A1A19] tracking-tight mb-2">Hello, {user.full_name}</h1>
        <p className="text-[#8B8B86] text-sm">Patient ID: {user.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gene Profile (Existing) */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Genomic Profile</h3>
          <div className="bg-[#F7F7F5] rounded-xl p-4 border border-[#E8E8E5]">
            <p className="text-[#5A5A55] text-sm mb-1">Tested Gene</p>
            <p className="text-lg font-bold text-[#1A1A19]">{user.gene_type}</p>
          </div>
        </div>

        {/* Dynamic AI Profile Sections */}
        {user.phenotypic_analysis && (
          <>
            {/* Personal Profile */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Personal Profile</h3>
              <div className="space-y-3">
                <p className="text-sm"><span className="text-[#8B8B86]">Age:</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.personal_profile.age}</span></p>
                <p className="text-sm"><span className="text-[#8B8B86]">Mobile:</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.personal_profile.mobile}</span></p>
                <p className="text-sm"><span className="text-[#8B8B86]">Email:</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.personal_profile.email || 'N/A'}</span></p>
                <p className="text-sm"><span className="text-[#8B8B86]">Activity:</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.personal_profile.dailyActivity}</span></p>
                <p className="text-sm"><span className="text-[#8B8B86]">Sleep:</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.personal_profile.sleepTiming}</span></p>
              </div>
            </div>

            {/* Caffeine Response */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Caffeine & Stimulant Response</h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-[#8B8B86] block mb-0.5">Sleep Impact</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.caffeine_response.sleepImpact}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Duration</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.caffeine_response.durationOfEffect}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Sensitivity</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.caffeine_response.sensitivity}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Tolerance</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.caffeine_response.tolerance}</span></p>
              </div>
            </div>

            {/* Hair & Scalp */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Hair & Scalp Characteristics</h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-[#8B8B86] block mb-0.5">Thickness & Texture</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.hair_scalp_characteristics.thickness}, {user.phenotypic_analysis.hair_scalp_characteristics.texture}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Scalp Type</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.hair_scalp_characteristics.scalpType}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Sweating</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.hair_scalp_characteristics.sweating}</span></p>
                <p><span className="text-[#8B8B86] block mb-0.5">Stability</span> <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.hair_scalp_characteristics.stability}</span></p>
              </div>
            </div>

            {/* Physical Performance */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] md:col-span-2">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Physical Performance & Recovery</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  <span className="text-[#8B8B86] block mb-1">Power</span>
                  <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.physical_performance.power}</span>
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  <span className="text-[#8B8B86] block mb-1">Endurance</span>
                  <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.physical_performance.endurance}</span>
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  <span className="text-[#8B8B86] block mb-1">Recovery</span>
                  <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.physical_performance.recovery}</span>
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5] sm:col-span-2 lg:col-span-1">
                  <span className="text-[#8B8B86] block mb-1">Training Preference</span>
                  <span className="font-medium text-[#1A1A19]">{user.phenotypic_analysis.physical_performance.trainingPreference}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
