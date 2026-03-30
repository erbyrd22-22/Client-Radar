import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Users, Mail, Calendar, Save, Trash2, Send, Plus, Filter, X, Star, Building, MapPin, Briefcase, Clock, ChevronDown, UserPlus, Tag } from 'lucide-react';

// Initialize Supabase client - replace with your credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Industry categories with associated keywords for search
const INDUSTRY_KEYWORDS = {
  TECH: ['Data', 'AI', 'Machine Learning', 'Software', 'Cloud', 'DevOps', 'Cybersecurity', 'Analytics', 'Engineering', 'Product'],
  FINANCE: ['Banking', 'Investment', 'Accounting', 'Risk', 'Trading', 'Wealth Management', 'Insurance', 'Compliance', 'Audit'],
  HEALTHCARE: ['Medical', 'Nursing', 'Pharma', 'Biotech', 'Clinical', 'Research', 'Health IT', 'Patient Care', 'Diagnostics'],
  MARKETING: ['Digital', 'Brand', 'Content', 'SEO', 'Social Media', 'Advertising', 'PR', 'Communications', 'Growth'],
  SALES: ['Business Development', 'Account Management', 'Enterprise', 'Inside Sales', 'Channel', 'Partnerships', 'Revenue'],
  HR: ['Recruiting', 'Talent Acquisition', 'People Ops', 'L&D', 'Compensation', 'HRIS', 'Employee Relations'],
  OPERATIONS: ['Supply Chain', 'Logistics', 'Project Management', 'Process Improvement', 'Quality', 'Procurement'],
  LEGAL: ['Corporate', 'Litigation', 'Contract', 'IP', 'Compliance', 'Regulatory', 'Privacy']
};

// Location options including new cities
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

// Industry options
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

export default function TalentRadar() {
  const [activeTab, setActiveTab] = useState('search');
  const [candidates, setCandidates] = useState([]);
  const [savedCandidates, setSavedCandidates] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Search filters
  const [filters, setFilters] = useState({
    location: '',
    industry: '',
    keyword: '',
    dateFrom: '',
    dateTo: '',
    minMatchScore: 0
  });
  
  // Email composition
  const [emailDraft, setEmailDraft] = useState({
    to: '',
    subject: '',
    body: '',
    candidateId: null
  });
  
  // Calendar/Follow-up
  const [followUp, setFollowUp] = useState({
    candidateId: '',
    date: '',
    notes: ''
  });
  
  // Get keywords for selected industry
  const availableKeywords = filters.industry ? INDUSTRY_KEYWORDS[filters.industry] || [] : [];

  // Load saved candidates on mount
  useEffect(() => {
    loadSavedCandidates();
  }, []);

  // Clear messages after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadSavedCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSavedCandidates(data || []);
    } catch (err) {
      console.error('Error loading candidates:', err);
      setError('Failed to load saved candidates');
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query based on filters
      let query = supabase.from('candidates').select('*');
      
      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
      }
      
      if (filters.industry) {
        query = query.eq('industry', filters.industry);
      }
      
      if (filters.keyword) {
        // Search in job title and skills
        query = query.or(`current_title.ilike.%${filters.keyword}%,previous_title.ilike.%${filters.keyword}%`);
      }
      
      if (filters.dateFrom) {
        query = query.gte('job_change_date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('job_change_date', filters.dateTo);
      }
      
      if (filters.minMatchScore > 0) {
        query = query.gte('match_score', filters.minMatchScore);
      }
      
      const { data, error } = await query.order('match_score', { ascending: false });
      
      if (error) throw error;
      setSearchResults(data || []);
      setActiveTab('results');
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveCandidate = async (candidate) => {
    try {
      // Map only required database columns
      const candidateData = {
        name: candidate.name,
        email: candidate.email,
        location: candidate.location,
        current_company: candidate.current_company,
        previous_company: candidate.previous_company,
        current_title: candidate.current_title,
        previous_title: candidate.previous_title,
        industry: candidate.industry,
        job_change_date: candidate.job_change_date,
        match_score: candidate.match_score
      };
      
      const { data, error } = await supabase
        .from('candidates')
        .insert([candidateData])
        .select();
      
      if (error) throw error;
      
      setSavedCandidates(prev => [data[0], ...prev]);
      setSuccessMessage(`${candidate.name} saved to candidates!`);
    } catch (err) {
      console.error('Save error:', err);
      setError(`Failed to save candidate: ${err.message}`);
    }
  };

  const deleteCandidate = async (id) => {
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setSavedCandidates(prev => prev.filter(c => c.id !== id));
      setSuccessMessage('Candidate removed');
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete candidate');
    }
  };

  const sendEmail = async () => {
    if (!emailDraft.to || !emailDraft.subject || !emailDraft.body) {
      setError('Please fill in all email fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDraft.to,
          subject: emailDraft.subject,
          html: emailDraft.body.replace(/\n/g, '<br>'),
          replyTo: 'your-email@gmail.com' // Replace with your email
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Email send failed');
      }
      
      setSuccessMessage('Email sent successfully!');
      setEmailDraft({ to: '', subject: '', body: '', candidateId: null });
    } catch (err) {
      console.error('Email error:', err);
      setError(`Failed to send email: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const scheduleFollowUp = async () => {
    if (!followUp.candidateId || !followUp.date) {
      setError('Please select a candidate and date');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('follow_ups')
        .insert([{
          candidate_id: followUp.candidateId,
          follow_up_date: followUp.date,
          notes: followUp.notes
        }]);
      
      if (error) throw error;
      
      setSuccessMessage('Follow-up scheduled!');
      setFollowUp({ candidateId: '', date: '', notes: '' });
    } catch (err) {
      console.error('Follow-up error:', err);
      setError('Failed to schedule follow-up');
    }
  };

  const prepareEmail = (candidate) => {
    setEmailDraft({
      to: candidate.email,
      subject: `Exciting Opportunity - ${candidate.current_title}`,
      body: `Hi ${candidate.name},\n\nI noticed you recently joined ${candidate.current_company} as ${candidate.current_title}. Congratulations on the new role!\n\nI wanted to reach out because...\n\nBest regards`,
      candidateId: candidate.id
    });
    setActiveTab('email');
  };

  const CandidateCard = ({ candidate, isSearchResult = false }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800">{candidate.name}</h3>
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <Briefcase size={14} />
            {candidate.current_title} at {candidate.current_company}
          </p>
          {candidate.previous_company && (
            <p className="text-xs text-gray-500">
              Previously: {candidate.previous_title} at {candidate.previous_company}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {candidate.location}
            </span>
            <span className="flex items-center gap-1">
              <Building size={14} />
              {INDUSTRIES.find(i => i.value === candidate.industry)?.label || candidate.industry}
            </span>
            {candidate.job_change_date && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                Changed: {new Date(candidate.job_change_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {candidate.match_score && (
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
              <Star size={12} />
              {candidate.match_score}% Match
            </span>
          )}
          <div className="flex gap-2">
            {isSearchResult && (
              <button
                onClick={() => saveCandidate(candidate)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Save to Candidates"
              >
                <UserPlus size={18} />
              </button>
            )}
            <button
              onClick={() => prepareEmail(candidate)}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
              title="Send Email"
            >
              <Mail size={18} />
            </button>
            {!isSearchResult && (
              <button
                onClick={() => deleteCandidate(candidate.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Remove"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={28} />
            TalentRadar
          </h1>
          <p className="text-blue-100">Recruitment Pipeline Manager</p>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="max-w-6xl mx-auto mt-4 px-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={18} /></button>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="max-w-6xl mx-auto mt-4 px-4">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="max-w-6xl mx-auto mt-4 px-4">
        <div className="flex gap-2 bg-white rounded-lg p-1 shadow">
          {[
            { id: 'search', label: 'Search', icon: Search },
            { id: 'results', label: 'Search Results', icon: Filter },
            { id: 'candidates', label: 'Candidates', icon: Users },
            { id: 'email', label: 'Email', icon: Mail },
            { id: 'calendar', label: 'Follow-ups', icon: Calendar }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.id === 'candidates' && savedCandidates.length > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {savedCandidates.length}
                </span>
              )}
              {tab.id === 'results' && searchResults.length > 0 && (
                <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {searchResults.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Search size={24} />
              Find Candidates
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin size={14} className="inline mr-1" />
                  Location
                </label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              </div>

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building size={14} className="inline mr-1" />
                  Industry
                </label>
                <select
                  value={filters.industry}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    industry: e.target.value,
                    keyword: '' // Reset keyword when industry changes
                  }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {INDUSTRIES.map(ind => (
                    <option key={ind.value} value={ind.value}>{ind.label}</option>
                  ))}
                </select>
              </div>

              {/* Keyword Search - Only shown when industry is selected */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Tag size={14} className="inline mr-1" />
                  Keyword Search
                </label>
                {filters.industry ? (
                  <select
                    value={filters.keyword}
                    onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Keywords</option>
                    {availableKeywords.map(kw => (
                      <option key={kw} value={kw}>{kw}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                    placeholder="Select industry for keywords or type here..."
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
                {filters.industry && (
                  <p className="text-xs text-gray-500 mt-1">
                    Keywords for {INDUSTRIES.find(i => i.value === filters.industry)?.label}
                  </p>
                )}
              </div>

              {/* Date Range - From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Job Change From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Date Range - To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Job Change To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Match Score Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Star size={14} className="inline mr-1" />
                  Min Match Score: {filters.minMatchScore}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.minMatchScore}
                  onChange={(e) => setFilters(prev => ({ ...prev, minMatchScore: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Active Filters Display */}
            {(filters.location || filters.industry || filters.keyword || filters.dateFrom || filters.dateTo) && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {filters.location && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <MapPin size={12} /> {filters.location}
                    <button onClick={() => setFilters(prev => ({ ...prev, location: '' }))} className="hover:text-blue-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.industry && (
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Building size={12} /> {INDUSTRIES.find(i => i.value === filters.industry)?.label}
                    <button onClick={() => setFilters(prev => ({ ...prev, industry: '', keyword: '' }))} className="hover:text-purple-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.keyword && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Tag size={12} /> {filters.keyword}
                    <button onClick={() => setFilters(prev => ({ ...prev, keyword: '' }))} className="hover:text-green-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.dateFrom && (
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Clock size={12} /> From: {filters.dateFrom}
                    <button onClick={() => setFilters(prev => ({ ...prev, dateFrom: '' }))} className="hover:text-orange-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.dateTo && (
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Clock size={12} /> To: {filters.dateTo}
                    <button onClick={() => setFilters(prev => ({ ...prev, dateTo: '' }))} className="hover:text-orange-900">
                      <X size={12} />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => setFilters({ location: '', industry: '', keyword: '', dateFrom: '', dateTo: '', minMatchScore: 0 })}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Clear all
                </button>
              </div>
            )}

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Search Candidates
                </>
              )}
            </button>
          </div>
        )}

        {/* Search Results Tab */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Filter size={24} />
              Search Results ({searchResults.length})
            </h2>
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search size={48} className="mx-auto mb-4 opacity-50" />
                <p>No search results yet. Use the Search tab to find candidates.</p>
              </div>
            ) : (
              <div>
                {searchResults.map(candidate => (
                  <CandidateCard key={candidate.id} candidate={candidate} isSearchResult={true} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Candidates Tab */}
        {activeTab === 'candidates' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users size={24} />
              Saved Candidates ({savedCandidates.length})
            </h2>
            {savedCandidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>No saved candidates yet. Search and save candidates to build your pipeline.</p>
              </div>
            ) : (
              <div>
                {savedCandidates.map(candidate => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail size={24} />
              Compose Email
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailDraft.to}
                  onChange={(e) => setEmailDraft(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="candidate@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-48"
                  placeholder="Write your message..."
                />
              </div>
              
              <button
                onClick={sendEmail}
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar size={24} />
              Schedule Follow-up
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Candidate</label>
                <select
                  value={followUp.candidateId}
                  onChange={(e) => setFollowUp(prev => ({ ...prev, candidateId: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a candidate...</option>
                  {savedCandidates.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {candidate.current_title} at {candidate.current_company}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                <input
                  type="datetime-local"
                  value={followUp.date}
                  onChange={(e) => setFollowUp(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={followUp.notes}
                  onChange={(e) => setFollowUp(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="Add notes for this follow-up..."
                />
              </div>
              
              <button
                onClick={scheduleFollowUp}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Schedule Follow-up
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
