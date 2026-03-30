import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Users, Mail, Calendar, Trash2, Send, Plus, Filter, X, Star, Building, MapPin, Briefcase, UserPlus, Tag } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const NAVY = '#0a1628';
const GOLD = '#d4a843';

const LOCATIONS = [
  { value: '', label: 'All Locations' },
  { value: 'Charlotte, NC', label: 'Charlotte, NC' },
  { value: 'Tampa, FL', label: 'Tampa, FL' },
  { value: 'New York, NY', label: 'New York, NY' },
  { value: 'San Francisco, CA', label: 'San Francisco, CA' },
  { value: 'Los Angeles, CA', label: 'Los Angeles, CA' },
  { value: 'Chicago, IL', label: 'Chicago, IL' },
  { value: 'Austin, TX', label: 'Austin, TX' },
  { value: 'Seattle, WA', label: 'Seattle, WA' },
  { value: 'Boston, MA', label: 'Boston, MA' },
  { value: 'Denver, CO', label: 'Denver, CO' },
  { value: 'Atlanta, GA', label: 'Atlanta, GA' },
  { value: 'Miami, FL', label: 'Miami, FL' },
  { value: 'Dallas, TX', label: 'Dallas, TX' },
  { value: 'Phoenix, AZ', label: 'Phoenix, AZ' },
  { value: 'Remote', label: 'Remote' }
];

const INDUSTRIES = [
  { value: '', label: 'All Industries' },
  { value: 'TECH', label: 'Technology' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'SALES', label: 'Sales' },
  { value: 'HR', label: 'Human Resources' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'LEGAL', label: 'Legal' }
];

export default function ClientRadar() {
  const [activeTab, setActiveTab] = useState('search');
  const [savedCandidates, setSavedCandidates] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [filters, setFilters] = useState({ location: '', industry: '', keyword: '', minMatchScore: 0 });
  const [emailDraft, setEmailDraft] = useState({ to: '', subject: '', body: '', candidateId: null });
  const [followUp, setFollowUp] = useState({ candidateId: '', date: '', notes: '' });

  useEffect(() => { loadSavedCandidates(); }, []);

  useEffect(() => {
    if (successMessage) { const t = setTimeout(() => setSuccessMessage(null), 3000); return () => clearTimeout(t); }
  }, [successMessage]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); }
  }, [error]);

  const loadSavedCandidates = async () => {
    try {
      const { data, error } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSavedCandidates(data || []);
    } catch (err) { setError('Failed to load saved clients'); }
  };

  const handleSearch = async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase.from('candidates').select('*');
      if (filters.location) query = query.ilike('location', `%${filters.location}%`);
      if (filters.industry) query = query.eq('industry', filters.industry);
      if (filters.keyword) query = query.or(`current_title.ilike.%${filters.keyword}%,previous_title.ilike.%${filters.keyword}%`);
      if (filters.minMatchScore > 0) query = query.gte('match_score', filters.minMatchScore);
      const { data, error } = await query.order('match_score', { ascending: false });
      if (error) throw error;
      setSearchResults(data || []);
      setActiveTab('results');
    } catch (err) { setError('Search failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const saveCandidate = async (candidate) => {
    try {
      const candidateData = { name: candidate.name, email: candidate.email, location: candidate.location, current_company: candidate.current_company, previous_company: candidate.previous_company, current_title: candidate.current_title, previous_title: candidate.previous_title, industry: candidate.industry, job_change_date: candidate.job_change_date, match_score: candidate.match_score };
      const { data, error } = await supabase.from('candidates').insert([candidateData]).select();
      if (error) throw error;
      setSavedCandidates(prev => [data[0], ...prev]);
      setSuccessMessage(`${candidate.name} saved to clients!`);
    } catch (err) { setError(`Failed to save client: ${err.message}`); }
  };

  const deleteCandidate = async (id) => {
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id);
      if (error) throw error;
      setSavedCandidates(prev => prev.filter(c => c.id !== id));
      setSuccessMessage('Client removed');
    } catch (err) { setError('Failed to delete client'); }
  };

  const sendEmail = async () => {
    if (!emailDraft.to || !emailDraft.subject || !emailDraft.body) { setError('Please fill in all email fields'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: emailDraft.to, subject: emailDraft.subject, html: emailDraft.body.replace(/\n/g, '<br>'), replyTo: 'erbyrd22@gmail.com' }) });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Email send failed'); }
      setSuccessMessage('Email sent successfully!');
      setEmailDraft({ to: '', subject: '', body: '', candidateId: null });
    } catch (err) { setError(`Failed to send email: ${err.message}`); }
    finally { setLoading(false); }
  };

  const scheduleFollowUp = async () => {
    if (!followUp.candidateId || !followUp.date) { setError('Please select a client and date'); return; }
    try {
      const { error } = await supabase.from('follow_ups').insert([{ candidate_id: followUp.candidateId, follow_up_date: followUp.date, notes: followUp.notes }]);
      if (error) throw error;
      setSuccessMessage('Follow-up scheduled!');
      setFollowUp({ candidateId: '', date: '', notes: '' });
    } catch (err) { setError('Failed to schedule follow-up'); }
  };

  const prepareEmail = (candidate) => {
    setEmailDraft({ to: candidate.email, subject: `Exciting Opportunity - ${candidate.current_title}`, body: `Hi ${candidate.name},\n\nI noticed you recently joined ${candidate.current_company} as ${candidate.current_title}. Congratulations on the new role!\n\nI wanted to reach out because...\n\nBest regards`, candidateId: candidate.id });
    setActiveTab('email');
  };

  const inp = "w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400";

  const CandidateCard = ({ candidate, isSearchResult = false }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow border border-neutral-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold" style={{ color: NAVY }}>{candidate.name}</h3>
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <Briefcase size={14} />{candidate.current_title} at {candidate.current_company}
          </p>
          {candidate.previous_company && (
            <p className="text-xs text-gray-500">Previously: {candidate.previous_title} at {candidate.previous_company}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1"><MapPin size={14} />{candidate.location}</span>
            <span className="flex items-center gap-1"><Building size={14} />{INDUSTRIES.find(i => i.value === candidate.industry)?.label || candidate.industry}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {candidate.match_score && (
            <span className="text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1" style={{ background: GOLD }}>
              <Star size={12} />{candidate.match_score}% Match
            </span>
          )}
          <div className="flex gap-2">
            {isSearchResult && (
              <button onClick={() => saveCandidate(candidate)} className="p-2 rounded-full hover:bg-amber-50 transition-colors" style={{ color: GOLD }} title="Save to Clients">
                <UserPlus size={18} />
              </button>
            )}
            <button onClick={() => prepareEmail(candidate)} className="p-2 rounded-full hover:bg-slate-100 transition-colors" style={{ color: NAVY }} title="Send Email">
              <Mail size={18} />
            </button>
            {!isSearchResult && (
              <button onClick={() => deleteCandidate(candidate.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Remove">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="text-white p-4 shadow-lg" style={{ background: `linear-gradient(to right, ${NAVY}, #1a2d4e)` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users size={28} />Client Radar</h1>
          <p style={{ color: GOLD }}>Leverage AI Strategies</p>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto mt-4 px-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex justify-between items-center">
            <span>{error}</span><button onClick={() => setError(null)}><X size={18} /></button>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="max-w-6xl mx-auto mt-4 px-4">
          <div className="bg-amber-50 border border-amber-400 text-amber-800 px-4 py-3 rounded">{successMessage}</div>
        </div>
      )}

      <nav className="max-w-6xl mx-auto mt-4 px-4">
        <div className="flex gap-2 bg-white rounded-lg p-1 shado
