import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aahaasLogo from '../images/aahaas_monoMain.png';

// Backend API URLs
const API_BASE = 'http://localhost:3003/api';

function HotelsPage() {
  const navigate = useNavigate();
  
  // View state - 'main', 'existing', 'new'
  const [currentView, setCurrentView] = useState('main');
  
  // State for Existing Contract Update
  const [hotelId, setHotelId] = useState('');
  const [ratesData, setRatesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [generatedFiles, setGeneratedFiles] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // State for Add New Room Category
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryHotelId, setNewCategoryHotelId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const fileInputRef = useRef(null);

  // Fetch rates for a hotel
  const handleFetchRates = async () => {
    if (!hotelId) {
      setError('Please enter a Hotel ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setCurrentPage(1);  // Reset pagination when fetching new data

    try {
      const response = await axios.get(`${API_BASE}/get-hotel-rates/${hotelId}`);
      
      if (response.data.success) {
        setRatesData(response.data.rates);
        setSuccessMessage(`Found ${response.data.rates.length} rate records for Hotel ID: ${hotelId}`);
      } else {
        setError(response.data.message || 'Failed to fetch rates');
      }
    } catch (err) {
      console.error('Error fetching rates:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch rates');
    } finally {
      setIsLoading(false);
    }
  };

  // Download rates as Excel
  const handleDownloadRates = async () => {
    if (!hotelId) {
      setError('Hotel ID is required to download rates');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use GET request - data is fetched from DB on server side
      const response = await axios.get(`${API_BASE}/download-rates-excel/${hotelId}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hotel_room_rates_${hotelId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Rates downloaded successfully. Edit and re-upload when ready.');
    } catch (err) {
      console.error('Error downloading rates:', err);
      setError(err.response?.data?.message || err.message || 'Failed to download rates');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      setUploadedFile(file);
      setError(null);
      setSuccessMessage(`File selected: ${file.name}`);
      setGeneratedFiles({});
      setUploadStatus({});
    }
  };

  // Upload rates to database AND generate inventory tables with correct rate_ids
  // This is a single operation that:
  // 1. Uploads rates to hotel_room_rates table (gets new auto-increment IDs)
  // 2. Reads back the newly inserted IDs from database
  // 3. Generates hotel_room_inventories with those IDs as rate_id
  const handleUploadRatesAndGenerateInventories = async () => {
    if (!uploadedFile || !hotelId) {
      setError('Please select a file and ensure hotel ID is set');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage('Uploading rates to database and generating inventory files...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        
        try {
          // This new endpoint:
          // 1. Gets MAX(id) before upload
          // 2. Uploads rates to DB
          // 3. Gets newly inserted IDs
          // 4. Generates inventories with those IDs
          const response = await axios.post(`${API_BASE}/upload-rates-and-generate-inventories`, {
            hotelId: hotelId,
            ratesFileData: base64
          });

          if (response.data.success) {
            // Set the generated inventory files (with correct rate_ids)
            setGeneratedFiles(response.data.files);
            
            // Mark rates as already uploaded (since we uploaded them)
            setUploadStatus({
              hotel_room_rates: 'success',
              hotel_room_rates_message: `Uploaded ${response.data.ratesUploaded.inserted} rates to database`
            });
            
            setSuccessMessage(
              `✅ Rates uploaded successfully! ${response.data.newRateIds.length} new rates inserted with IDs: ${response.data.newRateIds.slice(0, 5).join(', ')}${response.data.newRateIds.length > 5 ? '...' : ''}. ` +
              `Inventory files generated with correct rate_ids. Now upload the inventory files.`
            );
          } else {
            setError(response.data.message || 'Failed to upload rates and generate inventories');
          }
        } catch (err) {
          console.error('Error uploading rates and generating inventories:', err);
          setError(err.response?.data?.message || err.message || 'Failed to upload rates and generate inventories');
        } finally {
          setIsGenerating(false);
        }
      };
      reader.readAsDataURL(uploadedFile);
    } catch (err) {
      console.error('Error reading file:', err);
      setError('Failed to read file');
      setIsGenerating(false);
    }
  };

  // Legacy function - kept for backwards compatibility but not used in new flow
  const handleGenerateInventories = async () => {
    // Now redirects to the combined upload function
    await handleUploadRatesAndGenerateInventories();
  };

  // Download generated file
  const handleDownloadGeneratedFile = (tableName) => {
    try {
      const fileData = generatedFiles[tableName];
      if (!fileData) {
        setError(`File ${tableName} not found`);
        return;
      }

      const base64Data = typeof fileData === 'string' ? fileData : fileData.data;
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

  // Upload single table to database
  const handleUploadTable = async (tableName) => {
    try {
      setIsUploading(true);
      setUploadStatus(prev => ({ ...prev, [tableName]: 'uploading' }));
      setError(null);

      const fileData = generatedFiles[tableName];
      if (!fileData) {
        throw new Error(`File data for ${tableName} not found`);
      }
      
      const base64Data = typeof fileData === 'string' ? fileData : fileData.data;
      
      if (!base64Data) {
        throw new Error(`No data content found for ${tableName}`);
      }

      console.log(`Uploading ${tableName} to database...`);
      
      const response = await axios.post(`${API_BASE}/upload-single-table`, {
        tableName: tableName,
        fileData: { data: base64Data }
      });

      if (response.data.success) {
        setUploadStatus(prev => ({ 
          ...prev, 
          [tableName]: 'success',
          [`${tableName}_message`]: `Uploaded ${response.data.inserted}/${response.data.total} rows`
        }));
        
        // After uploading hotel_room_rates, regenerate inventories with correct rate_ids from DB
        // This is CRITICAL - the rate_ids are only available after the rates are in the database
        if (tableName === 'hotel_room_rates') {
          setSuccessMessage('Rates uploaded successfully! Now regenerating inventory tables with correct rate IDs...');
          await regenerateInventoriesWithRateIds();
        }
      } else {
        setUploadStatus(prev => ({ 
          ...prev, 
          [tableName]: 'error',
          [`${tableName}_message`]: response.data.error || 'Upload failed'
        }));
        setError(`Failed to upload ${tableName}: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`Error uploading ${tableName}:`, err);
      setUploadStatus(prev => ({ 
        ...prev, 
        [tableName]: 'error',
        [`${tableName}_message`]: err.response?.data?.message || err.message
      }));
      setError(`Failed to upload ${tableName}: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Regenerate inventory tables after hotel_room_rates is uploaded to get correct rate_ids
  const regenerateInventoriesWithRateIds = async () => {
    try {
      setSuccessMessage('Regenerating inventory tables with correct rate IDs from database...');
      setError(null);
      
      // Small delay to ensure database has committed the rates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await axios.post(`${API_BASE}/regenerate-inventories-with-rate-ids`, {
        hotelId: hotelId
      });

      if (response.data.success) {
        // Update the generated files with new inventories that have correct rate_ids
        setGeneratedFiles(prev => ({
          ...prev,
          hotel_room_inventories: response.data.files.hotel_room_inventories,
          hotel_room_daily_inventories: response.data.files.hotel_room_daily_inventories
        }));
        
        // Reset upload status for inventory tables so user can re-upload them
        setUploadStatus(prev => ({
          ...prev,
          hotel_room_inventories: null,
          hotel_room_inventories_message: null,
          hotel_room_daily_inventories: null,
          hotel_room_daily_inventories_message: null
        }));
        
        setSuccessMessage(`Inventory tables regenerated with ${response.data.ratesCount} rate IDs from database. Please upload the inventory tables now.`);
      } else {
        setError('Failed to regenerate inventories: ' + (response.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error regenerating inventories:', err);
      setError('Failed to regenerate inventories with rate IDs: ' + (err.response?.data?.message || err.message));
    }
  };

  // Upload all tables to database in correct order
  // IMPORTANT: hotel_room_rates must be uploaded FIRST, then inventories (which depend on rate_ids)
  const handleUploadAllTables = async () => {
    const allTables = Object.keys(generatedFiles);
    
    // Define the correct upload order: rates first, then inventories
    const uploadOrder = [
      'hotel_room_rates',
      'hotel_room_inventories', 
      'hotel_room_daily_inventories'
    ];
    
    // Sort tables by upload order
    const sortedTables = [...allTables].sort((a, b) => {
      const indexA = uploadOrder.indexOf(a);
      const indexB = uploadOrder.indexOf(b);
      // Tables not in the order list go last
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    setSuccessMessage('Uploading tables in sequence (rates first, then inventories)...');
    
    for (const tableName of sortedTables) {
      if (uploadStatus[tableName] !== 'success') {
        await handleUploadTable(tableName);
        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setSuccessMessage('All tables have been processed!');
  };

  // Add new room category
  const handleAddCategory = async () => {
    if (!newCategoryHotelId || !newCategoryName) {
      setError('Please enter both Hotel ID and Category Name');
      return;
    }

    setIsSavingCategory(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/add-room-category`, {
        hotelId: newCategoryHotelId,
        categoryName: newCategoryName
      });

      if (response.data.success) {
        setSuccessMessage(`Room category "${newCategoryName}" added successfully for Hotel ID: ${newCategoryHotelId}`);
        setNewCategoryHotelId('');
        setNewCategoryName('');
        setShowCategoryModal(false);
      } else {
        setError(response.data.message || 'Failed to add room category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      setError(err.response?.data?.message || err.message || 'Failed to add room category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Reset to main view
  const handleBack = () => {
    setCurrentView('main');
    setHotelId('');
    setRatesData([]);
    setUploadedFile(null);
    setGeneratedFiles({});
    setUploadStatus({});
    setError(null);
    setSuccessMessage(null);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="hotels-page-container">
      <style>{`
        .hotels-page-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          color: #fff;
        }

        .page-header {
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

        /* Main View Styles */
        .main-buttons-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .main-action-card {
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 2.5rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .main-action-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 44, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .main-action-card:hover {
          border-color: #ff6b2c;
          transform: translateY(-5px);
          box-shadow: 0 10px 40px rgba(255, 107, 44, 0.2);
        }

        .main-action-card:hover::before {
          opacity: 1;
        }

        .main-action-card.secondary:hover {
          border-color: #3b82f6;
          box-shadow: 0 10px 40px rgba(59, 130, 246, 0.2);
        }

        .main-action-card.secondary::before {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), transparent);
        }

        .main-action-card.tertiary:hover {
          border-color: #22c55e;
          box-shadow: 0 10px 40px rgba(34, 197, 94, 0.2);
        }

        .main-action-card.tertiary::before {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent);
        }

        .action-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          display: block;
        }

        .action-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: #fff;
        }

        .action-description {
          color: #666;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        /* Section Styles */
        .section-container {
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 1.5rem;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* Input Styles */
        .input-group {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .input-field {
          flex: 1;
          min-width: 200px;
          padding: 0.9rem 1.25rem;
          background: #111;
          border: 1px solid #333;
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.25s ease;
        }

        .input-field:focus {
          outline: none;
          border-color: #ff6b2c;
          box-shadow: 0 0 0 3px rgba(255, 107, 44, 0.1);
        }

        .input-field::placeholder {
          color: #666;
        }

        /* Button Styles */
        .btn-primary {
          padding: 0.9rem 1.5rem;
          background: linear-gradient(135deg, #ff6b2c, #ff8c5a);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 25px rgba(255, 107, 44, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 0.9rem 1.5rem;
          background: #1a1a1a;
          border: 1px solid #333;
          color: #a0a0a0;
          border-radius: 12px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-secondary:hover {
          background: #2a2a2a;
          border-color: #444;
          color: #fff;
        }

        .btn-success {
          padding: 0.9rem 1.5rem;
          background: linear-gradient(135deg, #22c55e, #4ade80);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-success:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 25px rgba(34, 197, 94, 0.4);
        }

        .btn-success:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-blue {
          padding: 0.9rem 1.5rem;
          background: linear-gradient(135deg, #3b82f6, #60a5fa);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-blue:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 25px rgba(59, 130, 246, 0.4);
        }

        .btn-blue:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Table Styles */
        .rates-table-container {
          overflow-x: auto;
          margin-top: 1.5rem;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
        }

        .rates-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .rates-table th,
        .rates-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #2a2a2a;
        }

        .rates-table th {
          background: #1a1a1a;
          color: #a0a0a0;
          font-weight: 600;
          white-space: nowrap;
        }

        .rates-table td {
          color: #fff;
        }

        .rates-table tr:hover td {
          background: #1a1a1a;
        }

        /* File Upload Styles */
        .upload-zone {
          border: 2px dashed #333;
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #111;
          margin-top: 1.5rem;
        }

        .upload-zone:hover {
          border-color: #ff6b2c;
          background: #1a1a1a;
        }

        .upload-zone.has-file {
          border-style: solid;
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.05);
        }

        .upload-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        /* Generated Files Grid */
        .files-grid {
          display: grid;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .file-card {
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .file-card.success {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.05);
        }

        .file-card.error {
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(239, 68, 68, 0.05);
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-icon {
          font-size: 1.5rem;
        }

        .file-name {
          font-weight: 600;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .file-rows {
          font-size: 0.85rem;
          color: #666;
        }

        .file-actions {
          display: flex;
          gap: 0.5rem;
        }

        .file-status {
          font-size: 0.85rem;
          margin-top: 0.5rem;
          color: #22c55e;
        }

        .file-status.error {
          color: #ef4444;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        .modal-content {
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          animation: slideUp 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          color: #fff;
        }

        .modal-close {
          background: none;
          border: none;
          color: #666;
          font-size: 1.5rem;
          cursor: pointer;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: #fff;
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          justify-content: flex-end;
        }

        /* Spinner */
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .actions-row {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 1rem;
          padding: 1rem;
          background: #111;
          border-radius: 12px;
          flex-wrap: wrap;
        }

        .pagination-btn {
          padding: 0.5rem 1rem;
          background: #1a1a1a;
          border: 1px solid #333;
          color: #a0a0a0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.85rem;
        }

        .pagination-btn:hover:not(:disabled) {
          background: #2a2a2a;
          border-color: #ff6b2c;
          color: #fff;
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-info {
          color: #a0a0a0;
          font-size: 0.9rem;
          padding: 0 1rem;
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
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .hotels-page-container {
            padding: 1rem;
          }

          .main-buttons-container {
            grid-template-columns: 1fr;
          }

          .input-group {
            flex-direction: column;
          }

          .file-card {
            flex-direction: column;
            align-items: stretch;
          }

          .file-actions {
            justify-content: center;
          }
        }
      `}</style>

      <div className="page-header">
        <button 
          className="back-button" 
          onClick={currentView === 'main' ? () => navigate('/') : handleBack}
        >
          ←
        </button>
        <div className="header-content">
          <h1>{currentView === 'main' ? 'Hotels Management' : currentView === 'existing' ? 'Existing Contract Update' : 'New Contract Update'}</h1>
          <p className="subtitle">
            {currentView === 'main' 
              ? 'Manage hotel contracts, rates, and inventory' 
              : currentView === 'existing'
              ? 'Update rates and generate inventory for existing hotels'
              : 'Upload a new hotel contract'}
          </p>
        </div>
        <img src={aahaasLogo} alt="Aahaas" className="header-logo" />
      </div>

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

      {/* Main View */}
      {currentView === 'main' && (
        <>
          <div className="main-buttons-container">
            <div className="main-action-card" onClick={() => setCurrentView('existing')}>
              <span className="action-icon">📝</span>
              <h2 className="action-title">Existing Contract Update</h2>
              <p className="action-description">
                Update rates for existing hotels. Fetch current rates, modify them, and regenerate inventory tables.
              </p>
            </div>

            <div className="main-action-card tertiary" onClick={() => setShowCategoryModal(true)}>
              <span className="action-icon">🏷️</span>
              <h2 className="action-title">Add New Room Categories</h2>
              <p className="action-description">
                Add new room categories for existing hotels. Categories will be stored in the database.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Existing Contract Update View */}
      {currentView === 'existing' && (
        <>
          {/* Step 1: Fetch Rates */}
          <div className="section-container">
            <h2 className="section-title">📋 Step 1: Fetch Hotel Rates</h2>
            
            <div className="input-group">
              <input
                type="text"
                className="input-field"
                placeholder="Enter Hotel ID"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
              />
              <button 
                className="btn-primary"
                onClick={handleFetchRates}
                disabled={isLoading || !hotelId}
              >
                {isLoading ? <span className="spinner"></span> : '🔍'} Fetch Rates
              </button>
            </div>

            {ratesData.length > 0 && (
              <>
                <div className="hotel-id-badge">🏨 Hotel ID: {hotelId} | {ratesData.length} rate records</div>
                
                <div className="rates-table-container">
                  <table className="rates-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Room Category</th>
                        <th>Room Type</th>
                        <th>Meal Plan</th>
                        <th>Adult Rate</th>
                        <th>Child w/Bed</th>
                        <th>Child w/o Bed</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratesData
                        .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                        .map((rate, idx) => (
                        <tr key={idx}>
                          <td>{rate.id}</td>
                          <td>{rate.room_category_id}</td>
                          <td>{rate.room_type_id}</td>
                          <td>{rate.meal_plan}</td>
                          <td>{rate.adult_rate}</td>
                          <td>{rate.child_with_bed_rate}</td>
                          <td>{rate.child_without_bed_rate}</td>
                          <td>{formatDate(rate.booking_start_date)}</td>
                          <td>{formatDate(rate.booking_end_date)}</td>
                          <td>{rate.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {ratesData.length > rowsPerPage && (
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      ⏮️ First
                    </button>
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      ◀️ Prev
                    </button>
                    <span className="pagination-info">
                      Page {currentPage} of {Math.ceil(ratesData.length / rowsPerPage)} 
                      ({(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, ratesData.length)} of {ratesData.length})
                    </span>
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(ratesData.length / rowsPerPage)))}
                      disabled={currentPage >= Math.ceil(ratesData.length / rowsPerPage)}
                    >
                      Next ▶️
                    </button>
                    <button 
                      className="pagination-btn"
                      onClick={() => setCurrentPage(Math.ceil(ratesData.length / rowsPerPage))}
                      disabled={currentPage >= Math.ceil(ratesData.length / rowsPerPage)}
                    >
                      Last ⏭️
                    </button>
                  </div>
                )}

                <div className="actions-row">
                  <button 
                    className="btn-secondary"
                    onClick={handleDownloadRates}
                    disabled={isLoading}
                  >
                    ⬇️ Download Rates Excel
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Step 2: Upload Modified Rates */}
          {ratesData.length > 0 && (
            <div className="section-container">
              <h2 className="section-title">📤 Step 2: Upload Modified Rates & Generate Inventories</h2>
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                After editing the rates Excel file, upload it here. The system will:
              </p>
              <ol style={{ color: '#a0a0a0', fontSize: '0.9rem', marginLeft: '1.25rem', marginBottom: '1rem', lineHeight: 1.8 }}>
                <li>Upload rates to <code style={{ color: '#ff6b2c' }}>hotel_room_rates</code> table (gets new IDs)</li>
                <li>Read back the newly inserted IDs from database</li>
                <li>Generate <code style={{ color: '#22c55e' }}>hotel_room_inventories</code> with correct rate_ids</li>
              </ol>

              <div 
                className={`upload-zone ${uploadedFile ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadedFile ? (
                  <>
                    <span className="upload-icon">📄</span>
                    <p style={{ fontWeight: 600, color: '#fff' }}>{uploadedFile.name}</p>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <span className="upload-icon">📁</span>
                    <p style={{ color: '#a0a0a0' }}>Click to upload modified rates Excel file</p>
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>Supports .xlsx and .xls files</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {uploadedFile && (
                <div className="actions-row">
                  <button 
                    className="btn-success"
                    onClick={handleUploadRatesAndGenerateInventories}
                    disabled={isGenerating}
                    style={{ padding: '1rem 2rem' }}
                  >
                    {isGenerating ? <span className="spinner"></span> : '🚀'} Upload Rates to DB & Generate Inventories
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Upload Inventory Files */}
          {Object.keys(generatedFiles).length > 0 && (
            <div className="section-container">
              <h2 className="section-title">📊 Step 3: Upload Inventory Tables to Database</h2>
              
              {/* Show success message about rates */}
              {uploadStatus['hotel_room_rates'] === 'success' && (
                <div style={{ 
                  background: 'rgba(34, 197, 94, 0.1)', 
                  border: '1px solid rgba(34, 197, 94, 0.3)', 
                  borderRadius: '12px', 
                  padding: '1rem 1.25rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <p style={{ color: '#22c55e', fontWeight: 600 }}>
                    ✅ Rates uploaded to database! The inventory files below have correct rate_ids.
                  </p>
                </div>
              )}
              
              {/* Show info about the inventory files */}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.1)', 
                border: '1px solid rgba(59, 130, 246, 0.3)', 
                borderRadius: '12px', 
                padding: '1rem 1.25rem', 
                marginBottom: '1.5rem' 
              }}>
                <p style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '0.5rem' }}>📋 Next Steps:</p>
                <p style={{ color: '#a0a0a0', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  The inventory files below have been generated with the correct <code style={{ color: '#22c55e' }}>rate_id</code> values 
                  from the newly uploaded rates. Click the upload button (📤) for each file to save them to the database.
                </p>
              </div>

              <div className="files-grid">
                {Object.entries(generatedFiles).map(([tableName, fileData]) => (
                  <div 
                    key={tableName} 
                    className={`file-card ${uploadStatus[tableName] === 'success' ? 'success' : uploadStatus[tableName] === 'error' ? 'error' : ''}`}
                  >
                    <div className="file-info">
                      <span className="file-icon">
                        {tableName === 'hotel_room_rates' ? '📋' : 
                         tableName === 'hotel_room_inventories' ? '📦' : '📅'}
                      </span>
                      <div>
                        <div className="file-name">{tableName}.xlsx</div>
                        <div className="file-rows">
                          {fileData.rows || '?'} row(s)
                          {(tableName === 'hotel_room_inventories' || tableName === 'hotel_room_daily_inventories') && 
                           uploadStatus[tableName] !== 'success' && (
                            <span style={{ color: '#22c55e', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                              ✓ Has correct rate_ids
                            </span>
                          )}
                        </div>
                        {uploadStatus[`${tableName}_message`] && (
                          <div className={`file-status ${uploadStatus[tableName] === 'error' ? 'error' : ''}`}>
                            {uploadStatus[`${tableName}_message`]}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="file-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => handleDownloadGeneratedFile(tableName)}
                        title="Download file to review"
                      >
                        ⬇️
                      </button>
                      <button 
                        className="btn-blue"
                        onClick={() => handleUploadTable(tableName)}
                        disabled={isUploading || uploadStatus[tableName] === 'success'}
                        title={uploadStatus[tableName] === 'success' ? 'Already uploaded' : 'Upload to database'}
                      >
                        {uploadStatus[tableName] === 'uploading' ? <span className="spinner"></span> : 
                         uploadStatus[tableName] === 'success' ? '✅' : '📤'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="actions-row">
                <button 
                  className="btn-primary"
                  onClick={handleUploadAllTables}
                  disabled={isUploading}
                >
                  📤 Upload All Tables
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Room Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏷️ Add New Room Category</h2>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="input-field"
                placeholder="Hotel ID"
                value={newCategoryHotelId}
                onChange={(e) => setNewCategoryHotelId(e.target.value)}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Category Name (e.g., Deluxe Suite)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCategoryModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-success"
                onClick={handleAddCategory}
                disabled={isSavingCategory || !newCategoryHotelId || !newCategoryName}
              >
                {isSavingCategory ? <span className="spinner"></span> : '✓'} Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HotelsPage;
