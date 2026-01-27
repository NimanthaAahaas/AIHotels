import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import aahaasLogo from '../images/aahaas_monoMain.png';

function LifestylePage() {
  const navigate = useNavigate();
  // Add timestamp to force fresh load of iframe
  const [iframeKey] = useState(() => Date.now());
  const lifestyleAppUrl = `http://localhost:3003/lifestyle-app/?t=${iframeKey}`;

  // Upload state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  // Required files for upload
  const requiredFiles = [
    { key: 'tbl_lifestyle', name: 'tbl_lifestyle.xlsx', description: 'Main lifestyle table' },
    { key: 'tbl_lifestyle_detail', name: 'tbl_lifestyle_detail.xlsx', description: 'Lifestyle details' },
    { key: 'tbl_lifestyle_rates', name: 'tbl_lifestyle_rates.xlsx', description: 'Lifestyle rates' },
    { key: 'life_style_rates_packages', name: 'life_style_rates_packages.xlsx', description: 'Rate packages' },
    { key: 'tbl_lifestyle_inventory', name: 'tbl_lifestyle_inventory.xlsx', description: 'Inventory data' },
    { key: 'tbl_lifestyle_terms_and_conditions', name: 'tbl_lifestyle_terms_and_conditions.xlsx', description: 'Terms & conditions' }
  ];

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = { ...uploadFiles };
    
    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      
      // Match file to required files - use exact matching with specific patterns
      // Order matters: check more specific patterns first
      let matchedKey = null;
      
      if (fileName.includes('terms_and_conditions') || fileName.includes('termsncondition')) {
        matchedKey = 'tbl_lifestyle_terms_and_conditions';
      } else if (fileName.includes('rates_packages') || fileName.includes('rate_packages')) {
        matchedKey = 'life_style_rates_packages';
      } else if (fileName.includes('inventory')) {
        matchedKey = 'tbl_lifestyle_inventory';
      } else if (fileName.includes('lifestyle_detail') || fileName.includes('_detail')) {
        // Handles both 'detail' and 'details'
        matchedKey = 'tbl_lifestyle_detail';
      } else if (fileName.includes('lifestyle_rates') || fileName.includes('_rates.')) {
        matchedKey = 'tbl_lifestyle_rates';
      } else if (fileName.includes('tbl_lifestyle') && !fileName.includes('detail') && !fileName.includes('rates') && !fileName.includes('inventory') && !fileName.includes('terms')) {
        matchedKey = 'tbl_lifestyle';
      }
      
      if (matchedKey) {
        newFiles[matchedKey] = file;
        console.log(`Matched file "${file.name}" to "${matchedKey}"`);
      } else {
        console.log(`Could not match file "${file.name}" to any table`);
      }
    });
    
    setUploadFiles(newFiles);
    setUploadResult(null);
  };

  // Handle upload to database
  const handleUpload = async () => {
    // Debug: Log current files
    console.log('Upload clicked. Current files:', Object.keys(uploadFiles));
    console.log('Files object:', uploadFiles);
    
    // Check if we have at least one file selected
    if (Object.keys(uploadFiles).length === 0) {
      setUploadResult({ success: false, message: 'Please select at least one Excel file to upload' });
      return;
    }

    // Validate dependencies - tbl_lifestyle must be present if uploading dependent tables
    const dependentOnLifestyle = ['tbl_lifestyle_detail', 'tbl_lifestyle_rates', 'tbl_lifestyle_inventory', 'tbl_lifestyle_terms_and_conditions'];
    const dependentOnRates = ['life_style_rates_packages', 'tbl_lifestyle_inventory'];
    
    const hasDependentOnLifestyle = dependentOnLifestyle.some(key => uploadFiles[key]);
    const hasDependentOnRates = dependentOnRates.some(key => uploadFiles[key]);
    
    console.log('Has tbl_lifestyle:', !!uploadFiles['tbl_lifestyle']);
    console.log('Has dependent on lifestyle:', hasDependentOnLifestyle);
    
    if (hasDependentOnLifestyle && !uploadFiles['tbl_lifestyle']) {
      setUploadResult({ 
        success: false, 
        message: '⚠️ You must include tbl_lifestyle.xlsx when uploading detail, rates, inventory, or terms tables. The lifestyle_id is auto-generated and needed for FK mapping.' 
      });
      return;
    }
    
    if (hasDependentOnRates && !uploadFiles['tbl_lifestyle_rates']) {
      setUploadResult({ 
        success: false, 
        message: '⚠️ You must include tbl_lifestyle_rates.xlsx when uploading packages or inventory tables. The rate_id is auto-generated from lifestyle_rate_id.' 
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      Object.entries(uploadFiles).forEach(([key, file]) => {
        formData.append(key, file);
      });

      const response = await fetch('http://localhost:3003/api/upload-lifestyle-to-database', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResult({ 
          success: true, 
          message: `Successfully uploaded! Lifestyle ID: ${result.lifestyle_id}`,
          details: result
        });
        // Clear files after successful upload
        setUploadFiles({});
      } else {
        setUploadResult({ 
          success: false, 
          message: result.message || 'Upload failed',
          details: result
        });
      }
    } catch (error) {
      setUploadResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
    } finally {
      setUploading(false);
    }
  };

  // Clear selected files
  const clearFiles = () => {
    setUploadFiles({});
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="lifestyle-page">
      <div className="page-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingBottom: '1rem',
        borderBottom: '1px solid #2a2a2a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="back-button" onClick={() => navigate('/')}>
            ←
          </button>
          <div>
            <h1 className="page-title">Lifestyle</h1>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              AI-powered product generation
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowUploadPanel(!showUploadPanel)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: showUploadPanel ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background-color 0.2s'
            }}
          >
            📤 Upload to Database
          </button>
          <img 
            src={aahaasLogo} 
            alt="Aahaas" 
            style={{ 
              height: '36px', 
              opacity: 0.7,
              transition: 'opacity 0.25s ease'
            }}
            onMouseEnter={(e) => e.target.style.opacity = 1}
            onMouseLeave={(e) => e.target.style.opacity = 0.7}
          />
        </div>
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div style={{
          backgroundColor: '#1a1a2e',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          marginTop: '1rem'
        }}>
          <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem' }}>
            Upload Excel Files to Database
          </h3>
          <div style={{ 
            backgroundColor: '#1e3a5f', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            border: '1px solid #3b82f6'
          }}>
            <p style={{ color: '#93c5fd', fontSize: '0.85rem', margin: 0 }}>
              <strong>⚠️ Important:</strong> Upload all files together for proper FK mapping:
            </p>
            <ul style={{ color: '#93c5fd', fontSize: '0.8rem', margin: '0.5rem 0 0 1rem', paddingLeft: '0.5rem' }}>
              <li><strong>tbl_lifestyle.xlsx</strong> → generates <code>lifestyle_id</code> (required for all other tables)</li>
              <li><strong>tbl_lifestyle_rates.xlsx</strong> → generates <code>lifestyle_rate_id</code> (becomes <code>rate_id</code> for packages & inventory)</li>
            </ul>
          </div>

          {/* File Input */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="lifestyle-file-input"
            />
            <label
              htmlFor="lifestyle-file-input"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#374151',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginRight: '1rem'
              }}
            >
              📁 Select Excel Files
            </label>
            {Object.keys(uploadFiles).length > 0 && (
              <button
                onClick={clearFiles}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Selected Files List */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            {requiredFiles.map(rf => (
              <div
                key={rf.key}
                style={{
                  padding: '0.75rem',
                  backgroundColor: uploadFiles[rf.key] ? '#065f46' : '#374151',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>
                  {uploadFiles[rf.key] ? '✅' : '⬜'}
                </span>
                <div>
                  <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: '500' }}>
                    {rf.name}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    {rf.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || Object.keys(uploadFiles).length === 0}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: uploading ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: uploading || Object.keys(uploadFiles).length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              opacity: Object.keys(uploadFiles).length === 0 ? 0.5 : 1
            }}
          >
            {uploading ? '⏳ Uploading...' : '🚀 Upload to Database'}
          </button>

          {/* Result Message */}
          {uploadResult && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: uploadResult.success ? '#065f46' : '#7f1d1d',
              borderRadius: '8px',
              color: 'white'
            }}>
              <strong>{uploadResult.success ? '✅ Success!' : '❌ Error'}</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {uploadResult.message}
              </p>
              {uploadResult.details && uploadResult.details.results && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                  {Object.entries(uploadResult.details.results).map(([table, info]) => (
                    <div key={table}>
                      • {table}: {info.inserted || info.error || 'OK'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="lifestyle-container">
        <iframe
          src={lifestyleAppUrl}
          title="Lifestyle AI Product Generator"
          className="lifestyle-iframe"
          frameBorder="0"
          allow="clipboard-write"
          onLoad={(e) => {
            try {
              e.target.contentWindow.scrollTo(0, 0);
            } catch (err) {
              // Cross-origin restriction, handled by iframe's own scroll
            }
          }}
        />
      </div>
    </div>
  );
}

export default LifestylePage;
