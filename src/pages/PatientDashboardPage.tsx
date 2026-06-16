import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, Loader2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PatientDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('userProfile');
    if (data) {
      const parsed = JSON.parse(data);
      setUser(parsed);
      setEditForm(parsed);
    }
  }, []);

  const handleEditChange = (path: string[], value: string) => {
    setEditForm((prev: any) => {
      const next = { ...prev };
      let current = next;
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedForm = { ...editForm };
      if (updatedForm.phenotypic_analysis?.personal_profile) {
        updatedForm.email = updatedForm.phenotypic_analysis.personal_profile.email;
        updatedForm.phone = updatedForm.phenotypic_analysis.personal_profile.mobile;
        updatedForm.age = updatedForm.phenotypic_analysis.personal_profile.age;
      }
      
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedForm)
      });
      
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('userProfile', JSON.stringify(data.user));
        setIsEditing(false);
      } else {
        alert(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (label: string, path: string[], block = false) => {
    const getVal = (obj: any, p: string[]) => p.reduce((acc, k) => (acc ? acc[k] : ''), obj);
    const val = isEditing ? getVal(editForm, path) : getVal(user, path);
    
    if (block) {
      return (
        <div className="text-sm">
          <span className="text-[#8B8B86] block mb-0.5">{label}</span>
          {isEditing ? (
            <input 
              type="text" 
              value={val || ''} 
              onChange={(e) => handleEditChange(path, e.target.value)} 
              className="font-medium text-[#1A1A19] bg-[#F7F7F5] px-2 py-1.5 rounded border border-[#E8E8E5] focus:outline-none focus:border-[#6057D7] w-full" 
            />
          ) : (
            <span className="font-medium text-[#1A1A19]">{val || 'N/A'}</span>
          )}
        </div>
      );
    }

    return (
      <div className="text-sm flex flex-col sm:flex-row sm:items-center">
        <span className="text-[#8B8B86] sm:w-20 flex-shrink-0">{label}:</span>
        {isEditing ? (
          <input 
            type="text" 
            value={val || ''} 
            onChange={(e) => handleEditChange(path, e.target.value)} 
            className="font-medium text-[#1A1A19] bg-[#F7F7F5] px-2 py-1 rounded border border-[#E8E8E5] focus:outline-none focus:border-[#6057D7] w-full mt-1 sm:mt-0" 
          />
        ) : (
          <span className="font-medium text-[#1A1A19] mt-1 sm:mt-0">{val || 'N/A'}</span>
        )}
      </div>
    );
  };

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
      <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 sm:p-10 border border-white/60 shadow-[0_8px_32px_rgb(0,0,0,0.04)] mb-8 flex justify-between items-start">
        <div className="flex-1 mr-4">
          {isEditing ? (
            <input 
              type="text" 
              value={editForm?.full_name || ''} 
              onChange={(e) => handleEditChange(['full_name'], e.target.value)} 
              className="text-3xl font-bold text-[#1A1A19] tracking-tight mb-2 border-b border-[#E8E8E5] focus:outline-none focus:border-[#6057D7] bg-transparent w-full"
            />
          ) : (
            <h1 className="text-3xl font-bold text-[#1A1A19] tracking-tight mb-2">Hello, {user.full_name}</h1>
          )}
          <p className="text-[#8B8B86] text-sm">User ID: {user.id}</p>
        </div>
        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={() => { setIsEditing(false); setEditForm(user); }} className="p-2 text-[#8B8B86] hover:bg-white rounded-full transition-colors" title="Cancel">
                <X size={20} />
              </button>
              <button onClick={handleSave} disabled={isSaving} className="p-2 text-[#6057D7] hover:bg-[#6057D7]/10 rounded-full transition-colors flex items-center justify-center" title="Save">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/report" className="flex items-center gap-2 px-4 py-2 bg-[#6057D7] text-white rounded-full text-sm font-medium hover:bg-[#4B44B3] transition-colors shadow-sm">
                <FileText size={16} />
                View Report
              </Link>
              <button onClick={() => setIsEditing(true)} className="p-2 text-[#8B8B86] hover:text-[#1A1A19] hover:bg-white rounded-full transition-colors" title="Edit Profile">
                <Edit2 size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gene Profile (Existing - Read Only) */}
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
                {renderField('Age', ['phenotypic_analysis', 'personal_profile', 'age'])}
                {renderField('Mobile', ['phenotypic_analysis', 'personal_profile', 'mobile'])}
                {renderField('Email', ['phenotypic_analysis', 'personal_profile', 'email'])}
                {renderField('Activity', ['phenotypic_analysis', 'personal_profile', 'dailyActivity'])}
                {renderField('Sleep', ['phenotypic_analysis', 'personal_profile', 'sleepTiming'])}
              </div>
            </div>

            {/* Caffeine Response */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Caffeine & Stimulant Response</h3>
              <div className="space-y-3">
                {renderField('Sleep Impact', ['phenotypic_analysis', 'caffeine_response', 'sleepImpact'], true)}
                {renderField('Duration', ['phenotypic_analysis', 'caffeine_response', 'durationOfEffect'], true)}
                {renderField('Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity'], true)}
                {renderField('Tolerance', ['phenotypic_analysis', 'caffeine_response', 'tolerance'], true)}
              </div>
            </div>

            {/* Hair & Scalp */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Hair & Scalp Characteristics</h3>
              <div className="space-y-3">
                {renderField('Thickness', ['phenotypic_analysis', 'hair_scalp_characteristics', 'thickness'], true)}
                {renderField('Texture', ['phenotypic_analysis', 'hair_scalp_characteristics', 'texture'], true)}
                {renderField('Scalp Type', ['phenotypic_analysis', 'hair_scalp_characteristics', 'scalpType'], true)}
                {renderField('Sweating', ['phenotypic_analysis', 'hair_scalp_characteristics', 'sweating'], true)}
                {renderField('Stability', ['phenotypic_analysis', 'hair_scalp_characteristics', 'stability'], true)}
              </div>
            </div>

            {/* Physical Performance */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] md:col-span-2">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Physical Performance & Recovery</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Power', ['phenotypic_analysis', 'physical_performance', 'power'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Endurance', ['phenotypic_analysis', 'physical_performance', 'endurance'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Recovery', ['phenotypic_analysis', 'physical_performance', 'recovery'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5] sm:col-span-2 lg:col-span-1">
                  {renderField('Training Preference', ['phenotypic_analysis', 'physical_performance', 'trainingPreference'], true)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

