document.addEventListener('DOMContentLoaded', () => {
  const promptTextarea = document.getElementById('prompt');
  const generateBtn = document.getElementById('generateBtn');
  const output = document.getElementById('output');
  const status = document.getElementById('status');

  // Make output div accept HTML
  output.innerHTML = '<div class="placeholder">Enter a prompt above and click generate. Try: "3 days in Tokyo" or "Beach vacation in Bali"</div>';

  // Update status
  function updateStatus(message, type = 'info') {
    if (status) {
      status.textContent = message;
      status.className = `status ${type}`;
      status.style.color = type === 'error' ? '#f44336' : 
                           type === 'success' ? '#4CAF50' : '#666';
    }
  }

  // Format itinerary as beautiful HTML
  function formatItinerary(itineraryText) {
    try {
      const data = JSON.parse(itineraryText);
      
      return `
        <div class="itinerary-container">
          <!-- Header -->
          <div class="itinerary-header">
            <h2><span class="icon">✈️</span> ${data.destination || 'Travel Destination'}</h2>
            <div class="meta-info">
              <span class="tag"><span class="icon">📅</span> ${data.duration || 'N/A'}</span>
              <span class="tag"><span class="icon">💰</span> ${data.budgetLevel || 'N/A'}</span>
              <span class="tag"><span class="icon">🌤️</span> ${data.bestSeason || 'N/A'}</span>
              ${data.estimatedCost ? `<span class="tag"><span class="icon">💳</span> ${data.estimatedCost}</span>` : ''}
            </div>
          </div>

          <!-- Highlights -->
          <div class="section">
            <h3><span class="icon">🌟</span> Top Highlights</h3>
            <div class="highlights-grid">
              ${(data.highlights || []).map(highlight => `
                <div class="highlight-card">
                  <span class="icon">✅</span> ${highlight}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Daily Itinerary -->
          <div class="section">
            <h3><span class="icon">📅</span> Daily Plan</h3>
            ${(data.itinerary || []).map(day => `
              <div class="day-card">
                <div class="day-header">
                  <h4>Day ${day.day}: ${day.theme || 'Activities'}</h4>
                </div>
                <div class="day-content">
                  ${day.morning ? `<div class="time-slot morning">
                    <span class="time-icon">🌅</span>
                    <div class="time-content">
                      <strong>Morning</strong>
                      <p>${day.morning}</p>
                    </div>
                  </div>` : ''}
                  
                  ${day.afternoon ? `<div class="time-slot afternoon">
                    <span class="time-icon">☀️</span>
                    <div class="time-content">
                      <strong>Afternoon</strong>
                      <p>${day.afternoon}</p>
                    </div>
                  </div>` : ''}
                  
                  ${day.evening && day.evening !== 'N/A' ? `<div class="time-slot evening">
                    <span class="time-icon">🌙</span>
                    <div class="time-content">
                      <strong>Evening</strong>
                      <p>${day.evening}</p>
                    </div>
                  </div>` : ''}
                  
                  ${day.accommodation && day.accommodation !== 'N/A' ? `
                  <div class="accommodation">
                    <span class="icon">🏨</span>
                    <span><strong>Stay:</strong> ${day.accommodation}</span>
                  </div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Tips Grid -->
          <div class="tips-grid">
            ${data.packingTips && data.packingTips.length > 0 ? `
            <div class="tip-card">
              <h4><span class="icon">🎒</span> Packing Tips</h4>
              <ul>
                ${data.packingTips.map(tip => `<li>${tip}</li>`).join('')}
              </ul>
            </div>` : ''}
            
            ${data.localCuisine && data.localCuisine.length > 0 ? `
            <div class="tip-card">
              <h4><span class="icon">🍽️</span> Local Cuisine</h4>
              <ul>
                ${data.localCuisine.map(food => `<li>${food}</li>`).join('')}
              </ul>
            </div>` : ''}
            
            ${data.safetyNotes && data.safetyNotes.length > 0 ? `
            <div class="tip-card">
              <h4><span class="icon">⚠️</span> Safety Notes</h4>
              <ul>
                ${data.safetyNotes.map(note => `<li>${note}</li>`).join('')}
              </ul>
            </div>` : ''}
          </div>

          <!-- Footer -->
          <div class="itinerary-footer">
            <p><span class="icon">✨</span> Generated with AI-powered Travel Planner</p>
            <button class="print-btn" onclick="window.print()">
              <span class="icon">🖨️</span> Print Itinerary
            </button>
          </div>
        </div>
      `;
      
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      // Return as formatted JSON if not valid
      return `
        <div class="json-fallback">
          <h3>Raw Itinerary Data</h3>
          <pre>${itineraryText}</pre>
          <button class="toggle-btn" onclick="this.parentElement.querySelector('pre').classList.toggle('expanded')">
            Toggle Full View
          </button>
        </div>
      `;
    }
  }

  // Main generate function
  async function generateItinerary() {
    const prompt = promptTextarea.value.trim();
    
    if (!prompt || prompt.length < 3) {
      updateStatus('Please describe your trip (min 3 characters)', 'error');
      output.innerHTML = '<div class="error-message">❌ Please enter a trip description first!</div>';
      return;
    }

    // Show loading
    updateStatus('✨ Creating your personalized itinerary...', 'info');
    output.innerHTML = `
      <div class="loading">
        <div class="spinner">✈️</div>
        <p>Generating your perfect ${prompt.toLowerCase().includes('day') ? '' : '3-day '}itinerary...</p>
      </div>
    `;
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      
      if (data.success && data.itinerary) {
        const formattedHTML = formatItinerary(data.itinerary);
        output.innerHTML = formattedHTML;
        updateStatus(`✅ Itinerary generated successfully! (${data.metadata?.responseTime || 'fast'})`, 'success');
      } else {
        throw new Error(data.error || 'Failed to generate itinerary');
      }
      
    } catch (error) {
      console.error('Error:', error);
      output.innerHTML = `
        <div class="error-message">
          <h3>❌ Error Generating Itinerary</h3>
          <p>${error.message}</p>
          <p><strong>Try:</strong></p>
          <ul>
            <li>Checking if server is running</li>
            <li>Using a different prompt</li>
            <li>Refreshing the page</li>
          </ul>
        </div>
      `;
      updateStatus('❌ Failed to generate itinerary', 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = '✨ Generate Itinerary';
    }
  }

  // Event Listeners
  generateBtn.addEventListener('click', generateItinerary);
  
  promptTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateItinerary();
    }
  });

  // Initialize
  updateStatus('Ready to plan your adventure! ✈️', 'info');
});
window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('✅ Service Worker Registered:', registration.scope);
            })
            .catch((err) => {
                console.log('❌ Service Worker registration failed:', err);
            });
    }
});
// Your existing code ends with:
window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('✅ Service Worker Registered:', registration.scope);
            })
            .catch((err) => {
                console.log('❌ Service Worker registration failed:', err);
            });
    }
});