import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import aahaasLogo from '../images/aahaas_monoMain.png';

function LifestylePage() {
  const navigate = useNavigate();
  // Add timestamp to force fresh load of iframe
  const [iframeKey] = useState(() => Date.now());
  const lifestyleAppUrl = `https://makeaibackend.aahaas.com/lifestyle-app/?t=${iframeKey}`;

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
  }, []);

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
      
      // Add required IDs based on step
      if (step.requiresId === 'lifestyle_id' && lifestyleId) {
        formData.append('lifestyle_id', lifestyleId);
      } else if (step.requiresId === 'rate_id' && rateId) {
        formData.append('rate_id', rateId);
      } else if (step.requiresId === 'both') {
        if (lifestyleId) formData.append('lifestyle_id', lifestyleId);
        if (rateId) formData.append('rate_id', rateId);
      }

      const response = await fetch(`https://makeaibackend.aahaas.com${step.endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Store generated IDs
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

        // Mark step as completed
        setCompletedSteps(prev => [...prev, currentStep]);

        // Clear file selection
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

  // Move to next step
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

  // Reset wizard
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

  // Get current step info
  const currentStepInfo = steps.find(s => s.step === currentStep);

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
            📤 Step-by-Step Upload
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

      {/* Step-by-Step Upload Panel */}
      {showUploadPanel && (
        <div style={{
          backgroundColor: '#1a1a2e',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          marginTop: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'white', fontSize: '1.1rem', margin: 0 }}>
              Step-by-Step Database Upload
            </h3>
            <button
              onClick={resetWizard}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🔄 Reset Wizard
            </button>
          </div>

          {/* ID Display */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: lifestyleId ? '#065f46' : '#374151',
              borderRadius: '6px',
              color: 'white',
              fontSize: '0.85rem'
            }}>
              <strong>lifestyle_id:</strong> {lifestyleId || 'Not yet generated'}
            </div>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: rateId ? '#065f46' : '#374151',
              borderRadius: '6px',
              color: 'white',
              fontSize: '0.85rem'
            }}>
              <strong>rate_id:</strong> {rateId || 'Not yet generated'}
            </div>
          </div>

          {/* Step Progress */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            {steps.map((step) => (
              <div
                key={step.step}
                onClick={() => {
                  // Only allow going back to completed steps or the next step
                  if (completedSteps.includes(step.step) || step.step === currentStep || step.step === Math.max(...completedSteps, 0) + 1) {
                    setCurrentStep(step.step);
                    setSelectedFile(null);
                    setStepResult(null);
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: completedSteps.includes(step.step) 
                    ? '#10b981' 
                    : step.step === currentStep 
                      ? '#3b82f6' 
                      : '#374151',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.8rem',
                  cursor: completedSteps.includes(step.step) || step.step === currentStep || step.step === Math.max(...completedSteps, 0) + 1 ? 'pointer' : 'not-allowed',
                  opacity: step.step > Math.max(...completedSteps, 0) + 1 ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {completedSteps.includes(step.step) ? '✅' : `Step ${step.step}`}
                <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>{step.title}</span>
              </div>
            ))}
          </div>

          {/* Current Step Details */}
          {currentStepInfo && (
            <div style={{
              backgroundColor: '#1e3a5f',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: '1px solid #3b82f6'
            }}>
              <h4 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                Step {currentStep}: {currentStepInfo.title}
              </h4>
              <p style={{ color: '#93c5fd', margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
                {currentStepInfo.description}
              </p>
              
              {/* Required IDs warning */}
              {currentStepInfo.requiresId && (
                <div style={{
                  backgroundColor: currentStepInfo.requiresId === 'lifestyle_id' && lifestyleId ? '#065f46' : 
                                  currentStepInfo.requiresId === 'rate_id' && rateId ? '#065f46' :
                                  currentStepInfo.requiresId === 'both' && lifestyleId && rateId ? '#065f46' : '#7f1d1d',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  color: 'white'
                }}>
                  {currentStepInfo.requiresId === 'lifestyle_id' && (
                    lifestyleId 
                      ? `✅ Using lifestyle_id: ${lifestyleId}` 
                      : '⚠️ Complete Step 1 first to get lifestyle_id'
                  )}
                  {currentStepInfo.requiresId === 'rate_id' && (
                    rateId 
                      ? `✅ Using rate_id: ${rateId}` 
                      : '⚠️ Complete Step 3 first to get rate_id'
                  )}
                  {currentStepInfo.requiresId === 'both' && (
                    lifestyleId && rateId 
                      ? `✅ Using lifestyle_id: ${lifestyleId}, rate_id: ${rateId}` 
                      : `⚠️ Need both IDs - lifestyle_id: ${lifestyleId || 'missing'}, rate_id: ${rateId || 'missing'}`
                  )}
                </div>
              )}

              {/* Instructions */}
              <div style={{
                backgroundColor: '#0f2744',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.8rem',
                color: '#93c5fd'
              }}>
                <strong>📋 Instructions:</strong>
                <ol style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                  <li>Download <code>{currentStepInfo.name}.xlsx</code> from the Lifestyle app below</li>
                  {currentStepInfo.requiresId && (
                    <li>The {currentStepInfo.requiresId === 'both' ? 'lifestyle_id and rate_id' : currentStepInfo.requiresId} will be auto-assigned during upload</li>
                  )}
                  <li>Select the downloaded file and click "Upload to Database"</li>
                  {currentStepInfo.generatesId && (
                    <li>After upload, you'll get the {currentStepInfo.generatesId} for the next steps</li>
                  )}
                </ol>
              </div>

              {/* File Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="step-file-input"
                />
                <label
                  htmlFor="step-file-input"
                  style={{
                    display: 'inline-block',
                    padding: '0.6rem 1rem',
                    backgroundColor: '#374151',
                    color: 'white',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    marginRight: '0.75rem'
                  }}
                >
                  📁 Select {currentStepInfo.name}.xlsx
                </label>
                {selectedFile && (
                  <span style={{ color: '#10b981', fontSize: '0.85rem' }}>
                    ✓ {selectedFile.name}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleStepUpload}
                  disabled={uploading || !selectedFile || (
                    (currentStepInfo.requiresId === 'lifestyle_id' && !lifestyleId) ||
                    (currentStepInfo.requiresId === 'rate_id' && !rateId) ||
                    (currentStepInfo.requiresId === 'both' && (!lifestyleId || !rateId))
                  )}
                  style={{
                    padding: '0.6rem 1.5rem',
                    backgroundColor: uploading ? '#6b7280' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    opacity: !selectedFile ? 0.5 : 1
                  }}
                >
                  {uploading ? '⏳ Uploading...' : '🚀 Upload to Database'}
                </button>

                {completedSteps.includes(currentStep) && currentStep < 6 && (
                  <button
                    onClick={goToNextStep}
                    style={{
                      padding: '0.6rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    Next Step →
                  </button>
                )}
              </div>

              {/* Result Message */}
              {stepResult && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: stepResult.success ? '#065f46' : '#7f1d1d',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}>
                  <strong>{stepResult.success ? '✅ Success!' : '❌ Error'}</strong>
                  <p style={{ margin: '0.25rem 0 0 0' }}>{stepResult.message}</p>
                  {stepResult.newId && (
                    <p style={{ margin: '0.25rem 0 0 0', color: '#fcd34d' }}>
                      Generated ID: {stepResult.newId}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Completion Message */}
          {completedSteps.length === 6 && (
            <div style={{
              backgroundColor: '#065f46',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: 'white'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>🎉 All Steps Completed!</h4>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                Successfully uploaded all lifestyle tables to the database.<br/>
                lifestyle_id: <strong>{lifestyleId}</strong> | rate_id: <strong>{rateId}</strong>
              </p>
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
