import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aahaasLogo from '../images/aahaas_monoMain.png';

// Backend API URLs
// Use 'process-direct' for local OpenAI processing with multi-step workflow
// Use 'proxy-n8n' for n8n workflow (returns all files at once, no sessionId)
const API_URL = 'http://localhost:3001/api/process-direct';
const DB_UPLOAD_SINGLE_URL = 'http://localhost:3001/api/upload-single-table';
const GENERATE_STEP2_URL = 'http://localhost:3001/api/generate-step2-sheets';
const GENERATE_STEP3_URL = 'http://localhost:3001/api/generate-step3-sheets';
const GENERATE_STEP4_URL = 'http://localhost:3001/api/generate-step4-sheets';
const GET_LAST_HOTEL_ID_URL = 'http://localhost:3001/api/get-last-hotel-id';

// Steps configuration
const STEPS = {
  1: {
    title: 'Step 1: Upload Hotels',
    description: 'Extract hotel basic info and upload to database',
    tables: ['hotels']
  },
  2: {
    title: 'Step 2: Upload Hotel Details & Rates',
    description: 'Upload hotel details, room categories, room types, rates, and terms',
    tables: ['hotel_details', 'hotel_room_categories', 'hotel_room_types', 'hotel_room_rates', 'hotel_terms_conditions']
  },
  3: {
    title: 'Step 3: Upload Room Inventories',
    description: 'Upload room inventories with rate IDs from database',
    tables: ['hotel_room_inventories']
  },
  4: {
    title: 'Step 4: Upload Daily Inventories',
    description: 'Upload daily inventory records',
    tables: ['hotel_room_daily_inventories']
  }
};

function HotelsUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const editedFileInputRefs = useRef({});
  
  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [hotelId, setHotelId] = useState(null);
  
  // Files for current step
  const [excelFiles, setExcelFiles] = useState({});
  const [editedFiles, setEditedFiles] = useState({});
  const [tableUploadStatus, setTableUploadStatus] = useState({});
  const [uploadingTable, setUploadingTable] = useState(null);
  
  // Completion tracking
  const [completedSteps, setCompletedSteps] = useState([]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.type) || file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
      setError(null);
      setSuccessMessage(null);
    } else {
      setError('Please upload a valid document (PDF, Word, Excel, or Image)');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setSuccessMessage(null);
    setCurrentStep(0);
    setSessionId(null);
    setHotelId(null);
    setExcelFiles({});
    setEditedFiles({});
    setTableUploadStatus({});
    setCompletedSteps([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });

      if (response.data.success && response.data.files) {
        setSessionId(response.data.sessionId);
        setExcelFiles(response.data.files);
        setCurrentStep(1);
        setSuccessMessage('Contract processed! Review and upload the Hotels sheet to continue.');
      } else {
        throw new Error(response.data.message || 'Failed to process document');
      }
    } catch (err) {
      console.error('Error processing document:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadSingleTable = async (tableName) => {
    if (!excelFiles[tableName]) {
      setError(`File ${tableName} not found`);
      return;
    }

    setUploadingTable(tableName);
    setError(null);

    try {
      const response = await axios.post(DB_UPLOAD_SINGLE_URL, {
        tableName: tableName,
        fileData: excelFiles[tableName]
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 600000, // 10 minutes for large uploads like hotel_room_daily_inventories
      });

      setTableUploadStatus(prev => ({
        ...prev,
        [tableName]: {
          success: response.data.success,
          message: response.data.success 
            ? `Uploaded ${response.data.inserted}/${response.data.total} rows`
            : response.data.error
        }
      }));

      if (!response.data.success) {
        setError(response.data.error || `Failed to upload ${tableName}`);
      }

    } catch (err) {
      console.error(`Error uploading ${tableName}:`, err);
      setTableUploadStatus(prev => ({
        ...prev,
        [tableName]: {
          success: false,
          message: err.response?.data?.message || err.message
        }
      }));
      setError(err.response?.data?.message || err.message);
    } finally {
      setUploadingTable(null);
    }
  };

  const handleUploadAllCurrentStep = async () => {
    const currentStepTables = STEPS[currentStep]?.tables || [];
    
    for (const tableName of currentStepTables) {
      if (!tableUploadStatus[tableName]?.success && excelFiles[tableName]) {
        await handleUploadSingleTable(tableName);
      }
    }
  };

  const proceedToNextStep = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsProcessing(true);
    
    try {
      if (currentStep === 1) {
        const hotelIdResponse = await axios.get(GET_LAST_HOTEL_ID_URL);
        if (!hotelIdResponse.data.success) {
          throw new Error('Could not retrieve hotel ID from database');
        }
        
        const newHotelId = hotelIdResponse.data.hotelId;
        setHotelId(newHotelId);

        const step2Response = await axios.post(GENERATE_STEP2_URL, {
          sessionId: sessionId,
          hotelId: newHotelId
        });

        if (step2Response.data.success) {
          setCompletedSteps(prev => [...prev, 1]);
          setExcelFiles(step2Response.data.files);
          setTableUploadStatus({});
          setEditedFiles({});
          setCurrentStep(2);
          setSuccessMessage(`Step 1 complete! Hotel ID: ${newHotelId}. Now upload the remaining sheets.`);
        } else {
          throw new Error(step2Response.data.message);
        }
      } 
      else if (currentStep === 2) {
        const step3Response = await axios.post(GENERATE_STEP3_URL, {
          sessionId: sessionId,
          hotelId: hotelId
        });

        if (step3Response.data.success) {
          setCompletedSteps(prev => [...prev, 2]);
          setExcelFiles(step3Response.data.files);
          setTableUploadStatus({});
          setEditedFiles({});
          setCurrentStep(3);
          setSuccessMessage(`Step 2 complete! Found ${step3Response.data.ratesCount} rate records. Now upload room inventories.`);
        } else {
          throw new Error(step3Response.data.message);
        }
      }
      else if (currentStep === 3) {
        const step4Response = await axios.post(GENERATE_STEP4_URL, {
          sessionId: sessionId,
          hotelId: hotelId
        });

        if (step4Response.data.success) {
          setCompletedSteps(prev => [...prev, 3]);
          setExcelFiles(step4Response.data.files);
          setTableUploadStatus({});
          setEditedFiles({});
          setCurrentStep(4);
          setSuccessMessage(`Step 3 complete! Found ${step4Response.data.inventoriesCount} inventory records. Now upload daily inventories.`);
        } else {
          throw new Error(step4Response.data.message);
        }
      }
      else if (currentStep === 4) {
        setCompletedSteps(prev => [...prev, 4]);
        setCurrentStep(5);
        setSuccessMessage('🎉 All steps completed! Hotel data has been successfully uploaded to the database.');
      }
    } catch (err) {
      console.error('Error proceeding to next step:', err);
      setError(err.message || 'Failed to proceed to next step');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadFile = (tableName) => {
    try {
      const fileEntry = excelFiles[tableName];
      if (!fileEntry) {
        setError(`File ${tableName} not found`);
        return;
      }

      const base64Data = typeof fileEntry === 'string' ? fileEntry : fileEntry.data;
      if (!base64Data) {
        setError(`File data for ${tableName} not found`);
        return;
      }

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tableName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleEditedFileUpload = async (tableName, event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError(`Please upload an Excel file (.xlsx or .xls) for ${tableName}`);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        
        setExcelFiles(prev => ({
          ...prev,
          [tableName]: { ...prev[tableName], data: base64 }
        }));
        
        setEditedFiles(prev => ({
          ...prev,
          [tableName]: file.name
        }));
        
        setTableUploadStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[tableName];
          return newStatus;
        });
        
        setError(null);
        setSuccessMessage(`${tableName} file replaced with: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading edited file:', err);
      setError(`Failed to process edited file: ${err.message}`);
    }
  };

  const isCurrentStepComplete = () => {
    const currentStepTables = STEPS[currentStep]?.tables || [];
    return currentStepTables.every(t => tableUploadStatus[t]?.success);
  };

  const renderFileCard = (tableName) => {
    const fileEntry = excelFiles[tableName];
    const status = tableUploadStatus[tableName];
    const isEdited = editedFiles[tableName];
    const isUploading = uploadingTable === tableName;

    return (
      <div key={tableName} className={`file-card ${status?.success ? 'uploaded' : ''} ${status?.success === false ? 'error' : ''}`}>
        <div className="file-card-header">
          <span className="file-icon">📊</span>
          <div className="file-info">
            <span className="file-name">{tableName}.xlsx</span>
            {isEdited && <span className="edited-badge">✏️ Edited</span>}
            {fileEntry?.rows && <span className="row-count">{fileEntry.rows} row(s)</span>}
          </div>
        </div>
        
        <div className="file-card-actions">
          <button 
            className="btn-download"
            onClick={() => handleDownloadFile(tableName)}
            title="Download to edit"
          >
            ⬇️ Download
          </button>
          
          <label className="btn-replace">
            📝 Replace
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleEditedFileUpload(tableName, e)}
              style={{ display: 'none' }}
              ref={el => editedFileInputRefs.current[tableName] = el}
            />
          </label>
          
          <button 
            className={`btn-upload ${status?.success ? 'success' : ''}`}
            onClick={() => handleUploadSingleTable(tableName)}
            disabled={isUploading || status?.success}
          >
            {isUploading ? '⏳ Uploading...' : status?.success ? '✅ Uploaded' : '📤 Upload to DB'}
          </button>
        </div>
        
        {status && (
          <div className={`status-message ${status.success ? 'success' : 'error'}`}>
            {status.message}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="hotels-upload-container">
      <style>{`
        .hotels-upload-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
          font-family: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
        }

        .upload-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #2a2a2a;
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

        .header-logo {
          height: 40px;
          opacity: 0.7;
          transition: opacity 0.25s ease;
        }

        .header-logo:hover {
          opacity: 1;
        }

        .progress-indicator {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          max-width: 120px;
          position: relative;
        }

        .progress-step:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 20px;
          right: -50%;
          width: 100%;
          height: 2px;
          background: #2a2a2a;
        }

        .progress-step.completed:not(:last-child)::after {
          background: linear-gradient(90deg, #22c55e, #2a2a2a);
        }

        .progress-step.active:not(:last-child)::after {
          background: linear-gradient(90deg, #ff6b2c, #2a2a2a);
        }

        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #1a1a1a;
          border: 2px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: #666;
          transition: all 0.3s ease;
          z-index: 1;
        }

        .progress-step.active .step-number {
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          border-color: #ff6b2c;
          color: #0a0a0a;
          box-shadow: 0 0 20px rgba(255, 107, 44, 0.4);
        }

        .progress-step.completed .step-number {
          background: linear-gradient(135deg, #22c55e, #4ade80);
          border-color: #22c55e;
          color: #0a0a0a;
        }

        .step-label {
          font-size: 0.75rem;
          color: #666;
          text-align: center;
        }

        .progress-step.active .step-label,
        .progress-step.completed .step-label {
          color: #a0a0a0;
        }

        .error-message, .success-message {
          padding: 1rem 1.25rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
          animation: fadeInUp 0.4s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .success-message {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .upload-section, .step-section {
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 2rem;
          animation: fadeInUp 0.5s ease-out;
        }

        .drop-zone {
          border: 2px dashed #333;
          border-radius: 16px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #111;
          position: relative;
          overflow: hidden;
        }

        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 44, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .drop-zone:hover, .drop-zone.drag-over {
          border-color: #ff6b2c;
          background: #1a1a1a;
        }

        .drop-zone:hover::before, .drop-zone.drag-over::before {
          opacity: 1;
        }

        .drop-zone.has-file {
          border-style: solid;
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.05);
        }

        .upload-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: 1rem;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .drop-zone p {
          color: #a0a0a0;
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }

        .drop-zone p:last-child {
          font-size: 0.9rem;
          color: #666;
        }

        .file-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .btn-remove {
          padding: 1rem 1.5rem;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          color: #a0a0a0;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .btn-remove:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
          color: #ef4444;
        }

        .process-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .process-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s ease;
        }

        .process-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 0 30px rgba(255, 107, 44, 0.4);
        }

        .process-button:hover::before {
          left: 100%;
        }

        .process-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(10, 10, 10, 0.3);
          border-top-color: #0a0a0a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .step-header {
          margin-bottom: 1.5rem;
        }

        .step-header h2 {
          font-size: 1.5rem;
          color: #fff;
          margin-bottom: 0.5rem;
        }

        .step-header p {
          color: #666;
          margin: 0;
        }

        .hotel-id-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 107, 44, 0.1);
          border: 1px solid rgba(255, 107, 44, 0.3);
          color: #ff8c5a;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          margin-top: 0.75rem;
        }

        .files-grid {
          display: grid;
          gap: 1rem;
        }

        .file-card {
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 1.25rem;
          transition: all 0.25s ease;
        }

        .file-card:hover {
          border-color: #333;
          background: #1a1a1a;
        }

        .file-card.uploaded {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.05);
        }

        .file-card.error {
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(239, 68, 68, 0.05);
        }

        .file-card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .file-card-header .file-icon {
          font-size: 1.75rem;
        }

        .file-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .file-info .file-name {
          font-weight: 600;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.95rem;
        }

        .edited-badge {
          font-size: 0.8rem;
          color: #f59e0b;
        }

        .row-count {
          font-size: 0.8rem;
          color: #666;
        }

        .file-card-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .file-card-actions button,
        .file-card-actions label {
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .btn-download {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #a0a0a0;
        }

        .btn-download:hover {
          background: #2a2a2a;
          border-color: #444;
          color: #fff;
        }

        .btn-replace {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn-replace:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: #f59e0b;
        }

        .btn-upload {
          background: linear-gradient(135deg, #3b82f6, #60a5fa);
          border: none;
          color: #fff;
        }

        .btn-upload:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
        }

        .btn-upload.success {
          background: linear-gradient(135deg, #22c55e, #4ade80);
        }

        .btn-upload:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .status-message {
          margin-top: 0.75rem;
          padding: 0.6rem 0.9rem;
          border-radius: 8px;
          font-size: 0.85rem;
        }

        .status-message.success {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }

        .status-message.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .step-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          justify-content: flex-end;
        }

        .btn-upload-all {
          padding: 0.9rem 1.5rem;
          background: linear-gradient(135deg, #f59e0b, #fbbf24);
          color: #0a0a0a;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .btn-upload-all:hover:not(:disabled) {
          box-shadow: 0 0 25px rgba(245, 158, 11, 0.4);
          transform: translateY(-2px);
        }

        .btn-upload-all:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-next-step {
          padding: 0.9rem 1.5rem;
          background: linear-gradient(135deg, #22c55e, #4ade80);
          color: #0a0a0a;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-next-step:hover:not(:disabled) {
          box-shadow: 0 0 25px rgba(34, 197, 94, 0.4);
          transform: translateY(-2px);
        }

        .btn-next-step:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .completion-section {
          text-align: center;
          padding: 3rem;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 20px;
          animation: fadeInUp 0.5s ease-out;
        }

        .completion-icon {
          font-size: 5rem;
          margin-bottom: 1rem;
          animation: bounce 1s ease infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .completion-section h2 {
          font-size: 2rem;
          color: #22c55e;
          margin-bottom: 0.5rem;
        }

        .completion-section > p {
          color: #a0a0a0;
        }

        .hotel-id-final {
          font-size: 1.25rem;
          margin: 1rem 0;
          color: #fff;
        }

        .completion-summary {
          background: #141414;
          border: 1px solid #2a2a2a;
          padding: 1.5rem;
          border-radius: 12px;
          margin: 1.5rem auto;
          max-width: 320px;
          text-align: left;
        }

        .completion-summary h3 {
          margin-bottom: 1rem;
          color: #fff;
          font-size: 1rem;
        }

        .completion-summary ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .completion-summary li {
          padding: 0.4rem 0;
          color: #22c55e;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
        }

        .btn-new-upload {
          margin-top: 1.5rem;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .btn-new-upload:hover {
          box-shadow: 0 0 30px rgba(255, 107, 44, 0.4);
          transform: translateY(-3px);
        }

        @media (max-width: 768px) {
          .hotels-upload-container {
            padding: 1rem;
          }

          .upload-header {
            flex-wrap: wrap;
          }

          .header-logo {
            display: none;
          }

          .progress-indicator {
            padding: 1rem;
            gap: 0.5rem;
          }

          .step-number {
            width: 32px;
            height: 32px;
            font-size: 0.85rem;
          }

          .file-card-actions {
            flex-direction: column;
          }

          .step-actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="upload-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ←
        </button>
        <div className="header-content">
          <h1>Hotel Contract Upload</h1>
          <p className="subtitle">AI-powered contract processing & database sync</p>
        </div>
        <img src={aahaasLogo} alt="Aahaas" className="header-logo" />
      </div>

      {/* Progress Indicator */}
      {currentStep > 0 && currentStep < 5 && (
        <div className="progress-indicator">
          {[1, 2, 3, 4].map(step => (
            <div 
              key={step} 
              className={`progress-step ${currentStep === step ? 'active' : ''} ${completedSteps.includes(step) ? 'completed' : ''}`}
            >
              <div className="step-number">
                {completedSteps.includes(step) ? '✓' : step}
              </div>
              <div className="step-label">
                {step === 1 && 'Hotels'}
                {step === 2 && 'Details & Rates'}
                {step === 3 && 'Inventories'}
                {step === 4 && 'Daily Inv.'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="success-message">
          <span>✅</span>
          {successMessage}
        </div>
      )}

      {/* Step 0: File Upload */}
      {currentStep === 0 && (
        <div className="upload-section">
          <div
            className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div>
                <span style={{ fontSize: '4rem' }}>📄</span>
                <p style={{ fontWeight: 600, marginTop: '0.75rem', color: '#fff' }}>{selectedFile.name}</p>
                <p style={{ color: '#666' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <span className="upload-icon">📁</span>
                <p>Drag & drop your hotel contract here</p>
                <p>or click to browse (PDF, Word, Excel)</p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {selectedFile && (
            <div className="file-actions">
              <button className="btn-remove" onClick={handleRemoveFile}>
                ✕ Remove
              </button>
              <button 
                className="process-button"
                onClick={handleProcessDocument}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner"></span>
                    Processing with AI...
                  </>
                ) : (
                  <>🚀 Process Contract</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Steps 1-4: Show current step files */}
      {currentStep >= 1 && currentStep <= 4 && (
        <div className="step-section">
          <div className="step-header">
            <h2>{STEPS[currentStep].title}</h2>
            <p>{STEPS[currentStep].description}</p>
            {hotelId && <div className="hotel-id-badge">🏨 Hotel ID: {hotelId}</div>}
          </div>
          
          <div className="files-grid">
            {STEPS[currentStep].tables.map(tableName => 
              excelFiles[tableName] && renderFileCard(tableName)
            )}
          </div>

          <div className="step-actions">
            {STEPS[currentStep].tables.length > 1 && !isCurrentStepComplete() && (
              <button 
                className="btn-upload-all"
                onClick={handleUploadAllCurrentStep}
                disabled={uploadingTable || isProcessing}
              >
                📤 Upload All Tables
              </button>
            )}
            
            {isCurrentStepComplete() && (
              <button 
                className="btn-next-step"
                onClick={proceedToNextStep}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner" style={{ borderTopColor: '#0a0a0a' }}></span>
                    Generating...
                  </>
                ) : currentStep === 4 ? (
                  <>🎉 Complete</>
                ) : (
                  <>➡️ Proceed to Next Step</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Completed */}
      {currentStep === 5 && (
        <div className="completion-section">
          <div className="completion-icon">🎉</div>
          <h2>Upload Complete!</h2>
          <p>All hotel data has been successfully uploaded to the database.</p>
          {hotelId && <p className="hotel-id-final">Hotel ID: <strong>{hotelId}</strong></p>}
          
          <div className="completion-summary">
            <h3>Uploaded Tables:</h3>
            <ul>
              <li>✅ hotels</li>
              <li>✅ hotel_details</li>
              <li>✅ hotel_room_categories</li>
              <li>✅ hotel_room_types</li>
              <li>✅ hotel_room_rates</li>
              <li>✅ hotel_terms_conditions</li>
              <li>✅ hotel_room_inventories</li>
              <li>✅ hotel_room_daily_inventories</li>
            </ul>
          </div>
          
          <button 
            className="btn-new-upload"
            onClick={handleRemoveFile}
          >
            📄 Upload Another Contract
          </button>
        </div>
      )}
    </div>
  );
}

export default HotelsUpload;
