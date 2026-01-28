import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import aahaasLogo from '../images/aahaas_monoMain.png';

// Minimal SVG Icon Components
const Icons = {
  upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  database: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  file: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  fileText: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  chat: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  grid: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  loader: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  ),
  send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  user: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  bot: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  folder: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
};

function LifestylePage() {
  const navigate = useNavigate();

  // AI Generator state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState(null);
  const [uploadedPdf, setUploadedPdf] = useState(null);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Step-by-step upload state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [lifestyleId, setLifestyleId] = useState(null);
  const [rateId, setRateId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [stepResult, setStepResult] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const fileInputRef = useRef(null);

  // Step definitions
  const steps = [
    { 
      step: 1, 
      name: 'tbl_lifestyle', 
      title: 'Lifestyle (Main)', 
      description: 'Upload the main lifestyle table. This generates the lifestyle_id needed for all other tables.',
      endpoint: '/api/lifestyle-step/upload-lifestyle',
      requiresId: null,
      generatesId: 'lifestyle_id'
    },
    { 
      step: 2, 
      name: 'tbl_lifestyle_detail', 
      title: 'Lifestyle Detail', 
      description: 'Upload lifestyle details. The lifestyle_id from Step 1 will be assigned to this table.',
      endpoint: '/api/lifestyle-step/upload-lifestyle-detail',
      requiresId: 'lifestyle_id',
      generatesId: null
    },
    { 
      step: 3, 
      name: 'tbl_lifestyle_rates', 
      title: 'Lifestyle Rates', 
      description: 'Upload lifestyle rates. This uses lifestyle_id from Step 1 and generates lifestyle_rate_id for packages.',
      endpoint: '/api/lifestyle-step/upload-lifestyle-rates',
      requiresId: 'lifestyle_id',
      generatesId: 'rate_id'
    },
    { 
      step: 4, 
      name: 'life_style_rates_packages', 
      title: 'Rates Packages', 
      description: 'Upload rate packages. The rate_id (lifestyle_rate_id from Step 3) will be assigned to this table.',
      endpoint: '/api/lifestyle-step/upload-rates-packages',
      requiresId: 'rate_id',
      generatesId: null
    },
    { 
      step: 5, 
      name: 'tbl_lifestyle_inventory', 
      title: 'Inventory', 
      description: 'Upload inventory. This uses both lifestyle_id from Step 1 and rate_id from Step 3.',
      endpoint: '/api/lifestyle-step/upload-inventory',
      requiresId: 'both',
      generatesId: null
    },
    { 
      step: 6, 
      name: 'tbl_lifestyle_terms_and_conditions', 
      title: 'Terms & Conditions', 
      description: 'Upload terms and conditions. The lifestyle_id from Step 1 will be assigned to this table.',
      endpoint: '/api/lifestyle-step/upload-terms',
      requiresId: 'lifestyle_id',
      generatesId: null
    }
  ];

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.style.overflow = 'auto';
  }, []);

  // Scroll chat to bottom (only within chat container)
  useEffect(() => {
    if (chatMessages.length > 0 && chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [chatMessages]);

  // AI Generator functions
  const N8N_WEBHOOK = 'https://aahaas-ai.app.n8n.cloud/webhook/6c340ec7-abba-4644-bbf6-9f7e080c0386';

  const addChatMessage = (type, content) => {
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      type,
      content,
      timestamp: new Date()
    }]);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    addChatMessage('user', userMessage);
    setIsProcessing(true);

    try {
      const response = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: userMessage })
      });

      const result = await response.json();
      
      if (result.files) {
        setGeneratedFiles(result.files);
        addChatMessage('assistant', `Successfully generated ${result.product_count || 'multiple'} product(s)! Your Excel files are ready for download.`);
      } else {
        addChatMessage('assistant', result.message || 'Files generated successfully!');
      }
    } catch (error) {
      addChatMessage('system', 'Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePdfUpload = async (file) => {
    if (!file || isProcessing) return;
    
    setUploadedPdf(file);
    addChatMessage('user', `Uploading: ${file.name}`);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.files) {
        setGeneratedFiles(result.files);
        addChatMessage('assistant', `Processed "${file.name}" - Extracted ${result.product_count || 'multiple'} product(s)!`);
      } else {
        addChatMessage('assistant', 'Document processed successfully!');
      }
    } catch (error) {
      addChatMessage('system', 'Upload failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadExcelFile = (fileKey, fileName) => {
    if (!generatedFiles || !generatedFiles[fileKey]) return;

    try {
      const base64Data = generatedFiles[fileKey];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      addChatMessage('assistant', `Downloaded: ${fileName}`);
    } catch (error) {
      addChatMessage('system', `Download failed: ${error.message}`);
    }
  };

  const excelTables = [
    { key: 'tbl_lifestyle', name: 'Lifestyle (Main)', file: 'tbl_lifestyle.xlsx', icon: 'grid', gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
    { key: 'tbl_lifestyle_detail', name: 'Lifestyle Details', file: 'tbl_lifestyle_detail.xlsx', icon: 'fileText', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
    { key: 'tbl_lifestyle_rates', name: 'Lifestyle Rates', file: 'tbl_lifestyle_rates.xlsx', icon: 'file', gradient: 'linear-gradient(135deg, #22c55e, #10b981)' },
    { key: 'life_style_rates_packages', name: 'Rate Packages', file: 'life_style_rates_packages.xlsx', icon: 'folder', gradient: 'linear-gradient(135deg, #eab308, #f97316)' },
    { key: 'tbl_lifestyle_inventory', name: 'Inventory', file: 'tbl_lifestyle_inventory.xlsx', icon: 'database', gradient: 'linear-gradient(135deg, #ef4444, #f43f5e)' },
    { key: 'tbl_lifestyle_terms_and_conditions', name: 'Terms & Conditions', file: 'tbl_lifestyle_terms_and_conditions.xlsx', icon: 'check', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
  ];

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStepResult(null);
    }
  };

  // Handle step upload
  const handleStepUpload = async () => {
    if (!selectedFile) {
      setStepResult({ success: false, message: 'Please select a file first' });
      return;
    }

    const step = steps.find(s => s.step === currentStep);
    if (!step) return;

    setUploading(true);
    setStepResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      if (step.requiresId === 'lifestyle_id' && lifestyleId) {
        formData.append('lifestyle_id', lifestyleId);
      } else if (step.requiresId === 'rate_id' && rateId) {
        formData.append('rate_id', rateId);
      } else if (step.requiresId === 'both') {
        if (lifestyleId) formData.append('lifestyle_id', lifestyleId);
        if (rateId) formData.append('rate_id', rateId);
      }

      const response = await fetch(`http://localhost:3003${step.endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        if (step.generatesId === 'lifestyle_id' && result.lifestyle_id) {
          setLifestyleId(result.lifestyle_id);
        }
        if (step.generatesId === 'rate_id' && (result.rate_id || result.lifestyle_rate_id)) {
          setRateId(result.rate_id || result.lifestyle_rate_id);
        }

        setStepResult({
          success: true,
          message: result.message,
          newId: step.generatesId ? result[step.generatesId] || result.lifestyle_id || result.rate_id : null
        });

        setCompletedSteps(prev => [...prev, currentStep]);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setStepResult({ success: false, message: result.message });
      }
    } catch (error) {
      setStepResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  const goToNextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
      setSelectedFile(null);
      setStepResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setLifestyleId(null);
    setRateId(null);
    setSelectedFile(null);
    setStepResult(null);
    setCompletedSteps([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentStepInfo = steps.find(s => s.step === currentStep);

  return (
    <div className="lifestyle-page">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }

        .lifestyle-page {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 1.5rem 2rem;
          font-family: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          color: #fff;
          overflow-y: auto;
          box-sizing: border-box;
        }
        
        .lifestyle-page svg {
          flex-shrink: 0;
        }

        .page-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #2a2a2a;
          flex-wrap: wrap;
        }

        @media (max-width: 768px) {
          .lifestyle-page {
            padding: 1rem;
          }
          
          .page-header {
            gap: 1rem;
            margin-bottom: 1rem;
          }
        }

        @media (max-width: 480px) {
          .lifestyle-page {
            padding: 0.75rem;
          }
        }

        .back-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          transition: all 0.25s ease;
          font-size: 1.25rem;
        }

        .back-button:hover {
          background: #1f1f1f;
          border-color: #ff6b2c;
          color: #ff6b2c;
          transform: translateX(-4px);
        }

        .header-content {
          flex: 1;
        }

        .header-content h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 0.25rem;
        }

        .subtitle {
          color: #666;
          font-size: 0.95rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-logo {
          height: 40px;
          opacity: 0.7;
          transition: opacity 0.25s ease;
        }

        .header-logo:hover {
          opacity: 1;
        }

        .upload-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .upload-toggle-btn:hover {
          border-color: #3b82f6;
          background: #1f1f1f;
        }

        .upload-toggle-btn.active {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #10b981;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1200px) {
          .main-grid {
            gap: 1rem;
          }
        }

        @media (max-width: 900px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .header-actions {
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          
          .upload-toggle-btn {
            padding: 0.6rem 1rem;
            font-size: 0.85rem;
          }
          
          .header-content h1 {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .back-button {
            width: 40px;
            height: 40px;
          }
          
          .header-content h1 {
            font-size: 1.25rem;
          }
          
          .subtitle {
            font-size: 0.85rem;
          }
        }

        .section-card {
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.25s ease;
        }

        .section-card:hover {
          border-color: #3a3a3a;
        }

        .section-card.accent {
          border-color: rgba(255, 107, 44, 0.3);
        }

        .section-card.accent:hover {
          border-color: rgba(255, 107, 44, 0.5);
        }

        .section-card.success {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .card-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .card-title-icon {
          font-size: 1.25rem;
        }

        .card-subtitle {
          color: #666;
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .status-badge {
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-badge.waiting {
          background: rgba(100, 116, 139, 0.2);
          color: #94a3b8;
        }

        .status-badge.ready {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .chat-container {
          flex: 1;
          min-height: 300px;
          max-height: 400px;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #666;
        }

        .chat-empty-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, rgba(255, 107, 44, 0.15), rgba(139, 92, 246, 0.15));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .chat-empty h3 {
          color: #fff;
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .chat-empty p {
          max-width: 280px;
          line-height: 1.5;
        }

        .chat-message {
          display: flex;
          gap: 0.75rem;
        }

        .chat-message.user {
          justify-content: flex-end;
        }

        .chat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .chat-avatar.ai {
          background: linear-gradient(135deg, #ff6b2c, #ec4899);
        }

        .chat-avatar.user {
          background: #2a2a2a;
        }

        .chat-bubble {
          max-width: 75%;
          padding: 0.75rem 1rem;
          border-radius: 16px;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .chat-bubble.ai {
          background: #1f1f1f;
          color: #e2e8f0;
          border-bottom-left-radius: 4px;
        }

        .chat-bubble.user {
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          color: #fff;
          border-bottom-right-radius: 4px;
        }

        .chat-bubble.system {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .chat-time {
          font-size: 0.7rem;
          opacity: 0.6;
          margin-top: 0.25rem;
        }

        .chat-input-form {
          padding: 1rem 1.5rem;
          border-top: 1px solid #2a2a2a;
          display: flex;
          gap: 0.75rem;
        }

        .chat-input {
          flex: 1;
          background: #1f1f1f;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 0.875rem 1rem;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.25s ease;
        }

        .chat-input:focus {
          border-color: #ff6b2c;
        }

        .chat-input::placeholder {
          color: #666;
        }

        .send-button {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 1.25rem;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .send-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 20px rgba(255, 107, 44, 0.3);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-area {
          padding: 1.5rem;
        }

        .upload-dropzone {
          border: 2px dashed #2a2a2a;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .upload-dropzone:hover {
          border-color: #ff6b2c;
          background: rgba(255, 107, 44, 0.05);
        }

        .upload-icon {
          width: 60px;
          height: 60px;
          background: #1f1f1f;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          margin: 0 auto 1rem;
        }

        .upload-text {
          color: #a0a0a0;
          margin-bottom: 0.25rem;
        }

        .upload-hint {
          color: #666;
          font-size: 0.85rem;
        }

        .files-list {
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 320px;
          overflow-y: auto;
        }

        .file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1rem;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .file-item:hover:not(:disabled) {
          border-color: #3a3a3a;
          background: #1f1f1f;
        }

        .file-item.ready {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .file-item.ready:hover {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.05);
        }

        .file-item:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .file-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          background: transparent;
          color: #ff6b2c;
        }

        .file-icon svg {
          stroke: #ff6b2c;
        }

        .file-name {
          font-weight: 500;
          font-size: 0.9rem;
          color: #fff;
        }

        .file-path {
          font-size: 0.8rem;
          color: #666;
        }

        .file-status {
          font-size: 1.25rem;
          color: #666;
        }

        .file-status.ready {
          color: #22c55e;
        }

        .download-all-btn {
          margin: 0 1.5rem 1.5rem;
          padding: 1rem;
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .download-all-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(255, 107, 44, 0.25);
        }

        .wizard-panel {
          background: #141414;
          border: 1px solid rgba(255, 107, 44, 0.4);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }

        .wizard-title {
          font-size: 1.15rem;
          font-weight: 600;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .wizard-reset-btn {
          padding: 0.5rem 1rem;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          color: #fff;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .wizard-reset-btn:hover {
          background: #3a3a3a;
        }

        .wizard-ids {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .wizard-id {
          padding: 0.5rem 1rem;
          background: #1f1f1f;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 0.85rem;
          color: #a0a0a0;
        }

        .wizard-id.active {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .wizard-steps {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .wizard-step {
          padding: 0.5rem 1rem;
          background: #1f1f1f;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #a0a0a0;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .wizard-step:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .wizard-step.active {
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          border-color: #ff6b2c;
          color: #fff;
        }

        .wizard-step.completed {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #10b981;
          color: #fff;
        }

        .wizard-current {
          background: #1a1a1a;
          border: 1px solid rgba(255, 107, 44, 0.3);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .wizard-current h4 {
          color: #fff;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .wizard-current p {
          color: #ffb899;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .wizard-file-select {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.25s ease;
          margin-bottom: 1rem;
        }

        .wizard-file-select:hover {
          background: #3a3a3a;
        }

        .wizard-file-selected {
          color: #22c55e;
          margin-left: 1rem;
          font-size: 0.9rem;
        }

        .wizard-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .wizard-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .wizard-btn.primary {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
        }

        .wizard-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .wizard-btn.secondary {
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          color: #fff;
        }

        .wizard-result {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .wizard-result.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .wizard-result.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .page-footer {
          margin-top: 3rem;
          text-align: center;
          color: #666;
          font-size: 0.85rem;
          padding-bottom: 2rem;
        }

        /* Additional responsive styles */
        @media (max-width: 768px) {
          .card-header {
            padding: 1rem;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          
          .card-title {
            font-size: 1rem;
          }
          
          .chat-container {
            min-height: 250px;
            max-height: 350px;
            padding: 1rem;
          }
          
          .chat-input-form {
            padding: 1rem;
          }
          
          .chat-bubble {
            max-width: 85%;
          }
          
          .upload-area {
            padding: 1rem;
          }
          
          .upload-dropzone {
            padding: 1.5rem 1rem;
          }
          
          .files-list {
            padding: 1rem;
          }
          
          .file-item {
            padding: 0.75rem;
          }
          
          .file-icon {
            width: 36px;
            height: 36px;
          }
          
          .download-all-btn {
            margin: 0 1rem 1rem;
          }
          
          .wizard-panel {
            padding: 1rem;
          }
          
          .wizard-header {
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          
          .wizard-steps {
            gap: 0.35rem;
          }
          
          .wizard-step {
            padding: 0.4rem 0.75rem;
            font-size: 0.75rem;
          }
          
          .wizard-current {
            padding: 1rem;
          }
          
          .wizard-actions {
            flex-direction: column;
          }
          
          .wizard-btn {
            width: 100%;
            text-align: center;
          }
          
          .page-footer {
            margin-top: 2rem;
          }
        }

        @media (max-width: 480px) {
          .chat-avatar {
            width: 30px;
            height: 30px;
          }
          
          .chat-bubble {
            max-width: 90%;
            padding: 0.6rem 0.85rem;
            font-size: 0.85rem;
          }
          
          .send-button {
            width: 42px;
            height: 42px;
          }
          
          .upload-icon {
            width: 48px;
            height: 48px;
          }
          
          .wizard-ids {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .wizard-id {
            width: 100%;
            text-align: center;
          }
          
          .wizard-file-select {
            width: 100%;
            justify-content: center;
          }
          
          .wizard-file-selected {
            display: block;
            margin: 0.5rem 0 0 0;
          }
        }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>←</button>
        <div className="header-content">
          <h1>Lifestyle</h1>
          <p className="subtitle">AI-powered product generation & database upload</p>
        </div>
        <div className="header-actions">
          <button 
            className={`upload-toggle-btn ${showUploadPanel ? 'active' : ''}`}
            onClick={() => setShowUploadPanel(!showUploadPanel)}
          >
            <Icons.upload /> Step-by-Step Upload
          </button>
          <img src={aahaasLogo} alt="Aahaas" className="header-logo" />
        </div>
      </div>

      {/* Step-by-Step Upload Panel */}
      {showUploadPanel && (
        <div className="wizard-panel">
          <div className="wizard-header">
            <h3 className="wizard-title"><Icons.database /> Database Upload Wizard</h3>
            <button className="wizard-reset-btn" onClick={resetWizard}><Icons.refresh /> Reset</button>
          </div>

          <div className="wizard-ids">
            <div className={`wizard-id ${lifestyleId ? 'active' : ''}`}>
              <strong>lifestyle_id:</strong> {lifestyleId || 'Pending...'}
            </div>
            <div className={`wizard-id ${rateId ? 'active' : ''}`}>
              <strong>rate_id:</strong> {rateId || 'Pending...'}
            </div>
          </div>

          <div className="wizard-steps">
            {steps.map((step) => (
              <button
                key={step.step}
                className={`wizard-step ${completedSteps.includes(step.step) ? 'completed' : step.step === currentStep ? 'active' : ''}`}
                onClick={() => {
                  if (completedSteps.includes(step.step) || step.step === currentStep || step.step === Math.max(...completedSteps, 0) + 1) {
                    setCurrentStep(step.step);
                    setSelectedFile(null);
                    setStepResult(null);
                  }
                }}
                disabled={step.step > Math.max(...completedSteps, 0) + 1}
              >
                {completedSteps.includes(step.step) ? <Icons.check /> : step.step} {step.title}
              </button>
            ))}
          </div>

          {currentStepInfo && (
            <div className="wizard-current">
              <h4>Step {currentStep}: {currentStepInfo.title}</h4>
              <p>{currentStepInfo.description}</p>

              <div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} id="step-file-input" />
                <label htmlFor="step-file-input" className="wizard-file-select">
                  <Icons.folder /> Select {currentStepInfo.name}.xlsx
                </label>
                {selectedFile && <span className="wizard-file-selected">✓ {selectedFile.name}</span>}
              </div>

              <div className="wizard-actions">
                <button
                  className="wizard-btn primary"
                  onClick={handleStepUpload}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? <><Icons.loader /> Uploading...</> : <><Icons.upload /> Upload to Database</>}
                </button>
                {completedSteps.includes(currentStep) && currentStep < 6 && (
                  <button className="wizard-btn secondary" onClick={goToNextStep}>
                    Next Step →
                  </button>
                )}
              </div>

              {stepResult && (
                <div className={`wizard-result ${stepResult.success ? 'success' : 'error'}`}>
                  <strong>{stepResult.success ? <><Icons.check /> Success!</> : <><Icons.x /> Error</>}</strong>
                  <p style={{ margin: '0.25rem 0 0 0' }}>{stepResult.message}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Grid - Only show when wizard panel is not active */}
      {!showUploadPanel && (
      <div className="main-grid">
        {/* Chat Card */}
        <div className="section-card accent" style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <span className="card-title-icon"><Icons.chat /></span>
                AI Product Generator
              </h2>
              <p className="card-subtitle">Describe your product or upload a PDF</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div ref={chatContainerRef} className="chat-container">
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon"><Icons.chat /></div>
                <h3>Welcome!</h3>
                <p>Describe your lifestyle product or upload a PDF to generate structured Excel files</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-message ${msg.type}`}>
                  {msg.type !== 'user' && (
                    <div className="chat-avatar ai"><Icons.bot /></div>
                  )}
                  <div className={`chat-bubble ${msg.type}`}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    <span className="chat-time">{msg.timestamp.toLocaleTimeString()}</span>
                  </div>
                  {msg.type === 'user' && (
                    <div className="chat-avatar user"><Icons.user /></div>
                  )}
                </div>
              ))
            )}
            {isProcessing && (
              <div className="chat-message">
                <div className="chat-avatar ai"><Icons.bot /></div>
                <div className="chat-bubble ai">Processing...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="chat-input-form">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Describe your product..."
              disabled={isProcessing}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isProcessing}
              className="send-button"
            >
              <Icons.send />
            </button>
          </form>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* PDF Upload */}
          <div className="section-card accent">
            <div className="card-header">
              <h3 className="card-title">
                <span className="card-title-icon"><Icons.upload /></span>
                Upload PDF Document
              </h3>
            </div>
            <div className="upload-area">
              <div className="upload-dropzone">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files[0] && handlePdfUpload(e.target.files[0])}
                  disabled={isProcessing}
                  style={{ display: 'none' }}
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" style={{ cursor: 'pointer', display: 'block' }}>
                  <div className="upload-icon"><Icons.file /></div>
                  <p className="upload-text">Click to upload or drag & drop</p>
                  <p className="upload-hint">PDF files only</p>
                </label>
              </div>
            </div>
          </div>

          {/* Generated Files */}
          <div className={`section-card ${generatedFiles ? 'success' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3 className="card-title">
                <span className="card-title-icon"><Icons.grid /></span>
                Generated Excel Files
              </h3>
              <span className={`status-badge ${generatedFiles ? 'ready' : 'waiting'}`}>
                {generatedFiles ? '● Ready' : '○ Waiting'}
              </span>
            </div>

            <div className="files-list">
              {excelTables.map((table) => (
                <button
                  key={table.key}
                  onClick={() => generatedFiles && generatedFiles[table.key] && downloadExcelFile(table.key, table.file)}
                  disabled={!generatedFiles || !generatedFiles[table.key]}
                  className={`file-item ${generatedFiles && generatedFiles[table.key] ? 'ready' : ''}`}
                >
                  <div className="file-info">
                    <div className="file-icon">
                      {Icons[table.icon] ? Icons[table.icon]() : <Icons.file />}
                    </div>
                    <div>
                      <p className="file-name">{table.name}</p>
                      <p className="file-path">{table.file}</p>
                    </div>
                  </div>
                  <span className={`file-status ${generatedFiles && generatedFiles[table.key] ? 'ready' : ''}`}>
                    {generatedFiles && generatedFiles[table.key] ? <Icons.download /> : '○'}
                  </span>
                </button>
              ))}
            </div>

            {generatedFiles && (
              <button
                onClick={() => excelTables.forEach(t => generatedFiles[t.key] && downloadExcelFile(t.key, t.file))}
                className="download-all-btn"
              >
                <Icons.download /> Download All Files
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Footer */}
      <div className="page-footer">
        AI Product Generator • Powered by n8n & OpenAI
      </div>
    </div>
  );
}

export default LifestylePage;
