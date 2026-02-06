import React from 'react';
import { useNavigate } from 'react-router-dom';
import aahaasLogo from '../images/aahaas logo.png';
import hotelsImage from '../images/hotels.jpg';
import lifestyleImage from '../images/lifestyle.jpg';
import hotelManagementImage from '../images/hotelmanagement.jpg';

// Floating Particle Component
const Particle = ({ delay, left }) => (
  <div 
    className="particle" 
    style={{ 
      left: `${left}%`,
      animationDelay: `${delay}s`,
      width: `${Math.random() * 4 + 2}px`,
      height: `${Math.random() * 4 + 2}px`,
    }} 
  />
);

// Animated Background Particles
const ParticlesBackground = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: Math.random() * 20,
    left: Math.random() * 100,
  }));

  return (
    <div className="particles-container">
      {particles.map(p => (
        <Particle key={p.id} delay={p.delay} left={p.left} />
      ))}
    </div>
  );
};

// 3D Animated Robot Component (moves around the page)
const AIRobot = () => (
  <div className="robot-container">
    <div className="robot">
      {/* Robot Head */}
      <div className="robot-head">
        <div className="robot-antenna">
          <div className="antenna-ball"></div>
        </div>
        <div className="robot-face">
          <div className="robot-eyes">
            <div className="robot-eye left">
              <div className="eye-pupil"></div>
            </div>
            <div className="robot-eye right">
              <div className="eye-pupil"></div>
            </div>
          </div>
          <div className="robot-mouth"></div>
        </div>
      </div>
      {/* Robot Body */}
      <div className="robot-body">
        <div className="robot-chest">
          <div className="chest-light"></div>
          <div className="chest-panel">
            <div className="panel-line"></div>
            <div className="panel-line"></div>
            <div className="panel-line"></div>
          </div>
        </div>
        {/* Robot Arms */}
        <div className="robot-arm left-arm">
          <div className="arm-segment upper"></div>
          <div className="arm-segment lower"></div>
          <div className="robot-hand"></div>
        </div>
        <div className="robot-arm right-arm">
          <div className="arm-segment upper"></div>
          <div className="arm-segment lower"></div>
          <div className="robot-hand"></div>
        </div>
      </div>
      {/* Glow Effect */}
      <div className="robot-glow"></div>
    </div>
  </div>
);

function MainPage() {
  const navigate = useNavigate();

  return (
    <div className="main-page">
      <ParticlesBackground />
      
      {/* 3D AI Robot */}
      <AIRobot />
      
      {/* Logo */}
      <div className="logo-container">
        <img src={aahaasLogo} alt="Aahaas" />
      </div>
      
      {/* Title */}
      <h1 className="main-title">Aahaas AI Product Generator</h1>
      
      {/* Subtitle */}
      <p className="main-subtitle">
        Intelligent Contract Processing & Data Management Platform
      </p>
      
      {/* Animated Line */}
      <div className="animated-line"></div>
      
      {/* Navigation Buttons */}
      <div className="button-container">
        <button 
          className="main-button hotels-button"
          onClick={() => navigate('/hotels')}
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div className="button-image-container" style={{
            width: '100%',
            height: '140px',
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            position: 'relative'
          }}>
            <img 
              src={hotelsImage} 
              alt="Hotels" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s ease'
              }}
              className="button-image"
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.3) 50%, transparent 100%)'
            }}></div>
          </div>
          <div style={{ padding: '1.25rem', textAlign: 'left' }}>
            <span className="button-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Hotels</span>
            <span className="button-description" style={{ 
              display: 'block', 
              marginTop: '0.5rem',
              fontSize: '0.9rem',
              opacity: 0.7 
            }}>
              Upload & process hotel contracts with AI
            </span>
          </div>
        </button>
        
        <button 
          className="main-button hotels-management-button"
          onClick={() => navigate('/hotels-management')}
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div className="button-image-container" style={{
            width: '100%',
            height: '140px',
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            position: 'relative'
          }}>
            <img 
              src={hotelManagementImage} 
              alt="Hotels Management" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s ease'
              }}
              className="button-image"
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.3) 50%, transparent 100%)'
            }}></div>
          </div>
          <div style={{ padding: '1.25rem', textAlign: 'left' }}>
            <span className="button-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Hotel Amendments</span>
            <span className="button-description" style={{ 
              display: 'block', 
              marginTop: '0.5rem',
              fontSize: '0.9rem',
              opacity: 0.7 
            }}>
              Update rates, inventory & room categories
            </span>
          </div>
        </button>
        
        <button 
          className="main-button lifestyle-button"
          onClick={() => navigate('/lifestyle')}
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div className="button-image-container" style={{
            width: '100%',
            height: '140px',
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            position: 'relative'
          }}>
            <img 
              src={lifestyleImage} 
              alt="Lifestyle" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s ease'
              }}
              className="button-image"
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.3) 50%, transparent 100%)'
            }}></div>
          </div>
          <div style={{ padding: '1.25rem', textAlign: 'left' }}>
            <span className="button-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Lifestyle</span>
            <span className="button-description" style={{ 
              display: 'block', 
              marginTop: '0.5rem',
              fontSize: '0.9rem',
              opacity: 0.7 
            }}>
              AI-powered product generation
            </span>
          </div>
        </button>
      </div>
      
      {/* Footer */}
      <footer className="footer" style={{ 
        position: 'absolute', 
        bottom: '10px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        border: 'none',
        padding: '0.5rem'
      }}>
        <p style={{ opacity: 0.5, fontSize: '0.8rem', margin: 0 }}>
          © 2026 Aahaas. Powered by AI.
        </p>
      </footer>
    </div>
  );
}

export default MainPage;
