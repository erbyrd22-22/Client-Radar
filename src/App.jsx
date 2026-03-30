import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Users, Mail, Calendar, Trash2, Send, Plus, Filter, X, Star, Building, MapPin, Briefcase, UserPlus, Tag, Upload } from 'lucide-react';

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

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','have','has','had','do','does',
  'did','will','would','could','should','may','might','i','my','me','we','our',
  'you','your','they','their','it','its','this','that','these','those','who',
  'what','which','how','when','where','am','please','send','list','focus',
  'first','also','can','us','based','start','going','targeting','addressing',
  'ideal','client','business','like','want','need','looking','small','large',
  'size','mid','managing','running','feeling','preparing','operating','growing',
  'if','possible','companies','company','practice','team','teams','firm','firms',
  'under','between','service','back','office','load','primary','target','multi',
  'independent','certified','registered','planning','financial','wealth','advisor'
]);

function extractKeywords(text) {
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const scores = {};
  words.forEach(w => { scores[w] = (scores[w] || 0) + w.length; });
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
    });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

function mapRowToCandidate(row) {
  return {
    name: row.name || row.full_name || row.client_name || '',
    email: row.email || row.email_address || '',
    location: row.location || row.city || row.city_state || '',
    current_company: row.current_company || row.company || row.organization || '',
    previous_company: row.previous_company || row.former_company || '',
    current_title: row.current_title || row.title || row.job_title || row.position || '',
    previous_title: row.previous_title || row.former_title || '',
    industry: row.industry || '',
    match_score: row.match_score ? parseInt(row.match_score) : null,
    job_change_date: row.job_change_date || row.start_date || null
  };
}

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
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadSavedCandidates(); }, []);

  useEffect(() => {
    if (successMessage) { const t = setTimeout(() => setSuccessMessage(null), 4000); return () => clearTimeout(t); }
  }, [successMessage]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 6000); return () => clearTimeout(t); }
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
      let searchTerms = [];
      if (filters.keyword) {
        searchTerms = extractKeywords(filters.keyword);
      }
      let query = supabase.from('candidates').select('*');
      if (filters.location) query = query.ilike('location', `%${filters.location}%`);
      if (filters.industry) query = query.eq('industry', filters.industry);
      if (searchTerms.length > 0) {
        const orConditions = searchTerms.flatMap(kw => [
          `current_title.ilike.%${kw}%`,
          `previous_title.ilike.%${kw}%`,
          `current_company.ilike.%${kw}%`
        ]).join(',');
        query = query.or(orConditions);
      }
      if (filters.minMatchScore > 0) query = query.gte('match_score', filters.minMatchScore);
      const { data, error } = await query.order('match_score', { ascending: false });
      if (error) throw error;
      setSearchResults(data || []);
      setActiveTab('results');
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally { setLoading(false); }
  };

  const saveCandidate = async (candidate) => {
    try {
      const candidateData = {
        name: candidate.name, email: candidate.email, location: candidate.location,
        current_company: candidate.current_company, previous_company: candidate.previous_company,
        current_title: candidate.current_title, previous_title: candidate.previous_title,
        industry: candidate.industry, job_change_date: candidate.job_change_date,
        match_score: candidate.match_score
      };
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
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailDraft.to, subject: emailDraft.subject, html: emailDraft.body.replace(/\n/g, '<br>'), replyTo: 'erbyrd22@gmail.com' })
      });
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
    setEmailDraft({
      to: candidate.email,
      subject: `Exciting Opportunity - ${candidate.current_title}`,
      body: `Hi ${candidate.name},\n\nI noticed you recently joined ${candidate.current_company} as ${candidate.current_title}. Congratulations on the new role!\n\nI wanted to reach out because...\n\nBest regards`,
      candidateId: candidate.id
    });
    setActiveTab('email');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv') {
      setError('Please upload a CSV file. For Excel files, save as CSV first (File > Save As > CSV).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rows = parseCSV(evt.target.result);
        const mapped = rows.map(mapRowToCandidate).filter(r => r.name || r.email);
        setUploadPreview(mapped);
        setUploadStatus(null);
      } catch (err) {
        setError('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const confirmUpload = async () => {
    if (uploadPreview.length === 0) return;
    setLoading(true);
    setUploadStatus(null);
    let successCount = 0;
    let failCount = 0;
    for (const candidate of uploadPreview) {
      try {
        const { error } = await supabase.from('candidates').insert([candidate]);
        if (error) throw error;
        successCount++;
      } catch (err) { failCount++; }
    }
    await loadSavedCandidates();
    setUploadPreview([]);
    setUploadStatus(`Imported ${successCount} clients successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow">
          {[
            { id: 'search', label: 'Search', icon: Search },
            { id: 'results', label: 'Results', icon: Filter },
            { id: 'candidates', label: 'Clients', icon: Users },
            { id: 'upload', label: 'Import', icon: Upload },
            { id: 'email', label: 'Email', icon: Mail },
            { id: 'calendar', label: 'Follow-ups', icon: Calendar }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg transition-colors flex-1 justify-center text-sm"
              style={activeTab === tab.id ? { background: NAVY, color: 'white' } : { color: '#4b5563' }}
            >
              <tab.icon size={16} />{tab.label}
              {tab.id === 'candidates' && savedCandidates.length > 0 && (
                <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: GOLD }}>{savedCandidates.length}</span>
              )}
              {tab.id === 'results' && searchResults.length > 0 && (
                <span className="text-white text-xs px-1.5 py-0.5 rounded-full" style={{ background: GOLD }}>{searchResults.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4">

        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}>
              <Search size={24} />Search Clients
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><MapPin size={14} className="inline mr-1" />Location</label>
                <select value={filters.location} onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))} className={inp}>
                  {LOCATIONS.map(loc => <option key={loc.value} value={loc.value}>{loc.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Building size={14} className="inline mr-1" />Industry</label>
                <select value={filters.industry} onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value, keyword: '' }))} className={inp}>
                  {INDUSTRIES.map(ind => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Tag size={14} className="inline mr-1" />Search Criteria</label>
                <textarea
                  value={filters.keyword}
                  onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                  placeholder="Describe what you're looking for, e.g. 'RIA wealth manager CFP' or 'AI strategy consulting'..."
                  className={inp + " resize-none"}
                  rows={3}
                />
                {filters.keyword && (
                  <p className="text-xs text-gray-400 mt-1">
                    Searching for: <span className="font-medium" style={{ color: GOLD }}>{extractKeywords(filters.keyword).join(', ') || 'type more...'}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Star size={14} className="inline mr-1" />Min Match Score: {filters.minMatchScore}%</label>
                <input type="range" min="0" max="100" value={filters.minMatchScore} onChange={(e) => setFilters(prev => ({ ...prev, minMatchScore: parseInt(e.target.value) }))} className="w-full accent-amber-500" />
              </div>
            </div>

            {(filters.location || filters.industry || filters.keyword) && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {filters.location && (
                  <span className="text-white text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: NAVY }}>
                    <MapPin size={12} />{filters.location}<button onClick={() => setFilters(prev => ({ ...prev, location: '' }))}><X size={12} /></button>
                  </span>
                )}
                {filters.industry && (
                  <span className="text-white text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: NAVY }}>
                    <Building size={12} />{INDUSTRIES.find(i => i.value === filters.industry)?.label}
                    <button onClick={() => setFilters(prev => ({ ...prev, industry: '', keyword: '' }))}><X size={12} /></button>
                  </span>
                )}
                {filters.keyword && (
                  <span className="text-white text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: GOLD }}>
                    <Tag size={12} />{filters.keyword.length > 20 ? filters.keyword.slice(0, 20) + '...' : filters.keyword}
                    <button onClick={() => setFilters(prev => ({ ...prev, keyword: '' }))}><X size={12} /></button>
                  </span>
                )}
                <button onClick={() => setFilters({ location: '', industry: '', keyword: '', minMatchScore: 0 })} className="text-xs text-red-600 hover:text-red-800 underline">Clear all</button>
              </div>
            )}

            <button onClick={handleSearch} disabled={loading} className="w-full text-white py-3 rounded-lg transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 font-semibold" style={{ background: GOLD }}>
              {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Searching...</> : <><Search size={20} />Search Clients</>}
            </button>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><Filter size={24} />Search Results ({searchResults.length})</h2>
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><Search size={48} className="mx-auto mb-4 opacity-50" /><p>No results yet. Use the Search tab to find clients.</p></div>
            ) : (
              <div>{searchResults.map(c => <CandidateCard key={c.id} candidate={c} isSearchResult={true} />)}</div>
            )}
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><Users size={24} />Saved Clients ({savedCandidates.length})</h2>
            {savedCandidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><Users size={48} className="mx-auto mb-4 opacity-50" /><p>No saved clients yet. Search and save clients or use Import to upload a file.</p></div>
            ) : (
              <div>{savedCandidates.map(c => <CandidateCard key={c.id} candidate={c} />)}</div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2" style={{ color: NAVY }}><Upload size={24} />Import Clients</h2>
            <p className="text-sm text-gray-500 mb-6">Upload a CSV file with your client list. Columns can include: name, email, location, current_company, current_title, previous_company, previous_title, industry.</p>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6 hover:border-amber-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={40} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 font-medium">Click to upload a CSV file</p>
              <p className="text-sm text-gray-400 mt-1">For Excel files, save as CSV first (File &rarr; Save As &rarr; CSV)</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </div>

            {uploadStatus && (
              <div className="bg-amber-50 border border-amber-400 text-amber-800 px-4 py-3 rounded mb-4">{uploadStatus}</div>
            )}

            {uploadPreview.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3" style={{ color: NAVY }}>Preview — {uploadPreview.length} clients found</h3>
                <div className="overflow-x-auto mb-4 rounded-lg border border-gray-200">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: NAVY, color: 'white' }}>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.slice(0, 10).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-3 py-2">{row.name || '—'}</td>
                          <td className="px-3 py-2">{row.email || '—'}</td>
                          <td className="px-3 py-2">{row.current_title || '—'}</td>
                          <td className="px-3 py-2">{row.current_company || '—'}</td>
                          <td className="px-3 py-2">{row.location || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadPreview.length > 10 && <p className="text-xs text-gray-400 p-2">Showing first 10 of {uploadPreview.length} rows</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={confirmUpload} disabled={loading} className="flex-1 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: GOLD }}>
                    {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Importing...</> : <><Plus size={20} />Import {uploadPreview.length} Clients</>}
                  </button>
                  <button onClick={() => { setUploadPreview([]); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="px-6 py-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'email' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><Mail size={24} />Compose Email</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">To</label><input type="email" value={emailDraft.to} onChange={(e) => setEmailDraft(prev => ({ ...prev, to: e.target.value }))} className={inp} placeholder="client@email.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input type="text" value={emailDraft.subject} onChange={(e) => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))} className={inp} placeholder="Email subject" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Message</label><textarea value={emailDraft.body} onChange={(e) => setEmailDraft(prev => ({ ...prev, body: e.target.value }))} className={inp + " h-48"} placeholder="Write your message..." /></div>
              <button onClick={sendEmail} disabled={loading} className="w-full text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 font-semibold" style={{ background: NAVY }}>
                {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Sending...</> : <><Send size={20} />Send Email</>}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><Calendar size={24} />Schedule Follow-up</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
                <select value={followUp.candidateId} onChange={(e) => setFollowUp(prev => ({ ...prev, candidateId: e.target.value }))} className={inp}>
                  <option value="">Choose a client...</option>
                  {savedCandidates.map(c => <option key={c.id} value={c.id}>{c.name} - {c.current_title} at {c.current_company}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label><input type="datetime-local" value={followUp.date} onChange={(e) => setFollowUp(prev => ({ ...prev, date: e.target.value }))} className={inp} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={followUp.notes} onChange={(e) => setFollowUp(prev => ({ ...prev, notes: e.target.value }))} className={inp + " h-24"} placeholder="Add notes for this follow-up..." /></div>
              <button onClick={scheduleFollowUp} className="w-full text-white py-3 rounded-lg flex items-center justify-center gap-2 font-semibold" style={{ background: GOLD }}>
                <Plus size={20} />Schedule Follow-up
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
