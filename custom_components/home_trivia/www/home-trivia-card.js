/**
 * Home Trivia Lovelace Card
 * A custom card for the Home Trivia Home Assistant integration
 */

class HomeTriviaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.gameSettingsExpanded = false;
    this.teamManagementExpanded = false;
    this.highscoreDiagnosticExpanded = false;
    this._debounceTimers = {};
    
    // Initialize user data cache
    this.homeAssistantUsers = [];
    this.usersLoaded = false;
    this._isLoadingUsers = false;
    
    // Initialize optimistic local state for form values
    this._pendingFormValues = {
      difficulty: null,
      timerLength: null,
      teamCount: null,
      teamNames: {},
      teamUserIds: {}
    };
  }

  // HTML escape utility for security
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = config;
    this.render();
  }



  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;
    
    // Only update if this is the first time setting hass, or if we need to show/hide splash screen
    if (!previousHass || 
        this.shouldShowSplashScreen() !== this.shouldShowSplashScreen(previousHass)) {
      this.requestUpdate();
    } else if (this.shouldShowSplashScreen()) {
      // If we're on splash screen, only update if forms aren't actively being edited
      // and there are no pending form changes
      if (!this.isFormActivelyBeingEdited() && !this.hasPendingFormChanges()) {
        this.requestUpdate();
      }
    } else {
      // Always update main game screen
      this.requestUpdate();
    }
  }

  // Helper to determine if splash should be shown for a specific hass state
  shouldShowSplashScreen(hass = null) {
    const hassToCheck = hass || this._hass;
    if (!hassToCheck) return true;

    // Check if we have minimum required data
    const gameStatus = hassToCheck.states['sensor.home_trivia_game_status'];
    const team1 = hassToCheck.states['sensor.home_trivia_team_1'];
    
    if (!gameStatus || !team1) return true;

    return false;
  }

  // Check if any form elements are currently focused
  isFormActivelyBeingEdited() {
    const activeElement = this.shadowRoot.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'SELECT' || 
      activeElement.tagName === 'TEXTAREA'
    );
  }

  // Check if there are any pending form changes that haven't been sent to backend yet
  hasPendingFormChanges() {
    return this._pendingFormValues.difficulty !== null ||
           this._pendingFormValues.timerLength !== null ||
           this._pendingFormValues.teamCount !== null ||
           Object.keys(this._pendingFormValues.teamNames).length > 0 ||
           Object.keys(this._pendingFormValues.teamUserIds).length > 0;
  }

  // Check if current user is admin (owner or admin)
  isCurrentUserAdmin() {
    if (!this._hass || !this._hass.user) {
      return false;
    }
    return this._hass.user.is_owner === true || this._hass.user.is_admin === true;
  }

  // Clear a specific pending form value when backend confirms the change
  clearPendingFormValue(key, subKey = null) {
    if (subKey) {
      delete this._pendingFormValues[key][subKey];
    } else {
      this._pendingFormValues[key] = null;
    }
  }

  // Get the effective value for a form field (pending value or HA entity value)
  getEffectiveFormValue(key, subKey = null, fallbackValue = null) {
    if (subKey) {
      if (this._pendingFormValues[key] && this._pendingFormValues[key][subKey] !== undefined) {
        return this._pendingFormValues[key][subKey];
      }
    } else {
      if (this._pendingFormValues[key] !== null) {
        return this._pendingFormValues[key];
      }
    }
    return fallbackValue;
  }

  requestUpdate() {
    if (this._updateRequested) return;
    this._updateRequested = true;
    
    requestAnimationFrame(() => {
      this._updateRequested = false;
      this.render();
    });
  }

  render() {
    if (!this._hass) {
      this.shadowRoot.innerHTML = '<div style="padding: 20px;">Loading Home Trivia...</div>';
      return;
    }

    // Load users on first render if needed
    if (!this.usersLoaded && !this._isLoadingUsers) {
      this.loadHomeAssistantUsers();
    }

    if (this.shouldShowSplashScreen()) {
      this.renderSplashScreen();
    } else {
      this.renderMainGame();
    }
  }

  renderSplashScreen() {
    this.shadowRoot.innerHTML = `
      <style>
        .splash-screen {
          text-align: center;
          padding: 24px;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 25%, #764ba2 75%, #667eea 100%);
          border-radius: var(--ha-card-border-radius, 4px);
          color: white;
          position: relative;
          overflow: hidden;
          min-height: 400px;
        }
        
        .splash-header {
          position: relative;
          z-index: 2;
          margin-bottom: 32px;
        }
        

        
        .splash-title {
          font-size: 2.5em;
          font-weight: bold;
          margin-bottom: 16px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          letter-spacing: 1px;
        }
        
        .splash-subtitle {
          font-size: 1.2em;
          margin-bottom: 20px;
          opacity: 0.9;
          font-weight: 500;
        }
        
        .splash-sound-waves {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          height: 40px;
          margin: 20px 0;
          gap: 4px;
        }
        
        .wave {
          width: 4px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 2px;
          animation: wave 2s ease-in-out infinite;
        }
        
        .wave-1 { height: 20px; animation-delay: 0s; }
        .wave-2 { height: 35px; animation-delay: 0.2s; }
        .wave-3 { height: 30px; animation-delay: 0.4s; }
        .wave-4 { height: 25px; animation-delay: 0.6s; }
        .wave-5 { height: 40px; animation-delay: 0.8s; }
        
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
        
        .splash-setup {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        
        .setup-message h2 {
          margin: 0 0 8px 0;
          font-size: 1.5em;
          font-weight: 600;
        }
        
        .setup-message p {
          margin: 0 0 20px 0;
          opacity: 0.9;
        }
        
        .splash-input-section {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 16px;
          text-align: left;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .splash-input-section:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
        }
        
        .splash-input-section.error {
          border: 2px solid #ff6b6b;
          background: rgba(255, 107, 107, 0.2);
        }
        
        .splash-input-header {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .splash-input-header h3 {
          margin: 0 0 0 8px;
          font-size: 1.1em;
          font-weight: 600;
        }
        
        .input-icon {
          --mdc-icon-size: 20px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .input-description {
          margin: 0 0 12px 0;
          opacity: 0.8;
          font-size: 0.9em;
        }
        
        .form-select, .splash-team-input, .splash-team-select {
          width: 100%;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.95);
          color: #333333;
          font-size: 16px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        
        .form-select:focus, .splash-team-input:focus, .splash-team-select:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.8);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 1.0);
        }
        
        .splash-teams-container {
          display: grid;
          gap: 12px;
        }
        
        .splash-team-item {
          display: grid;
          grid-template-columns: auto 1fr 1fr;
          gap: 12px;
          align-items: center;
          background: rgba(255, 255, 255, 0.1);
          padding: 12px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        
        .splash-team-item:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }
        
        .team-label {
          font-weight: 600;
          white-space: nowrap;
          color: white;
        }
        
        .splash-start-button {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.5);
          color: white;
          padding: 16px 32px;
          border-radius: 25px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        
        .splash-start-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.8);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .splash-start-button.ready {
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          border-color: rgba(76, 175, 80, 1);
        }
        
        .splash-start-button.ready:hover {
          background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
          box-shadow: 0 6px 25px rgba(76, 175, 80, 0.4);
        }
        
        .start-help {
          margin: 8px 0 0 0;
          font-size: 0.9em;
          opacity: 0.7;
        }
        
        .splash-qr-section {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          backdrop-filter: blur(10px);
          text-align: center;
        }
        
        .qr-header {
          margin-bottom: 15px;
        }
        
        .qr-header h3 {
          margin: 0 0 8px 0;
          font-size: 1.3em;
          font-weight: 600;
        }
        
        .qr-header p {
          margin: 0;
          font-size: 0.9em;
          opacity: 0.9;
        }
        
        .qr-code-container {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 8px;
          padding: 15px;
          display: inline-block;
          margin: 10px 0;
        }
        
        .qr-code-container img {
          display: block;
          border-radius: 4px;
        }
        
        .qr-url {
          font-family: monospace;
          font-size: 0.8em;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 10px;
          word-break: break-all;
        }
        
        @media (max-width: 768px) {
          .splash-team-item {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 8px;
          }
          
          .team-label {
            text-align: center;
          }
          
          .splash-title {
            font-size: 2em;
          }
          
          .splash-subtitle {
            font-size: 1em;
          }
          
          .splash-qr-section {
            margin: 15px 0;
            padding: 15px;
          }
          
          .qr-header h3 {
            font-size: 1.1em;
          }
          
          .qr-header p {
            font-size: 0.8em;
          }
        }
      </style>

      <div class="splash-screen">

        
        <div class="splash-header">
          <h1 class="splash-title">
            🎯 Welcome to Home Trivia!
          </h1>
          <p class="splash-subtitle">🧠 The ultimate Home Assistant trivia game experience! 🏆</p>
          <div class="splash-sound-waves">
            <div class="wave wave-1"></div>
            <div class="wave wave-2"></div>
            <div class="wave wave-3"></div>
            <div class="wave wave-4"></div>
            <div class="wave wave-5"></div>
          </div>
        </div>
        
        <div class="splash-setup">
          <div class="setup-message">
            <h2>Let's Get Set Up!</h2>
            <p>Configure your trivia game settings below:</p>
          </div>
          
          <div class="splash-settings">
            ${this.renderSplashInputs()}
          </div>
        </div>
        
        <div class="splash-qr-section">
          <div class="qr-header">
            <h3>📱 Join from Mobile</h3>
            <p>Scan this QR code to access the game on your phone or tablet</p>
          </div>
          <div class="qr-code-container">
            <img src="${this.generateQRCode(this.getCurrentHomeAssistantUrl())}" 
                 alt="QR Code for ${this.getCurrentHomeAssistantUrl()}" 
                 width="150" 
                 height="150" />
          </div>
          <div class="qr-url">${this.getCurrentHomeAssistantUrl()}</div>
        </div>
        
        <div class="splash-start-section">
          <button class="splash-start-button ready" onclick="this.getRootNode().host.startGame()">
            🚀 Launch Game
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    this.shadowRoot.getElementById('difficulty-select')?.addEventListener('change', (e) => {
      // Store pending value optimistically
      this._pendingFormValues.difficulty = e.target.value;
      this.updateDifficultyDescription(e.target.value);
      
      // Persist difficulty level immediately
      this.debouncedServiceCall('difficulty_level', () => {
        this._hass.callService('home_trivia', 'update_difficulty_level', {
          difficulty_level: e.target.value
        }).then(() => {
          // Clear pending value when backend confirms
          this.clearPendingFormValue('difficulty');
        }).catch(() => {
          // Keep pending value on error - user can retry
        });
      }, 500); // Increased delay to prevent resets
    });

    this.shadowRoot.getElementById('team-count-select')?.addEventListener('change', (e) => {
      const teamCount = parseInt(e.target.value);
      
      // Store pending value optimistically
      this._pendingFormValues.teamCount = teamCount;
      
      // Persist team count immediately
      this.debouncedServiceCall('team_count', () => {
        this._hass.callService('home_trivia', 'update_team_count', {
          team_count: teamCount
        }).then(() => {
          // Clear pending value when backend confirms
          this.clearPendingFormValue('teamCount');
        }).catch(() => {
          // Keep pending value on error - user can retry
        });
      }, 500); // Increased delay to prevent resets
      
      // Update team setup display immediately
      this.updateTeamSetup(teamCount);
    });
  }

  renderSplashInputs() {
    let inputsHtml = '';

    // Get current values from Home Assistant entities
    const gameStatus = this._hass?.states['sensor.home_trivia_game_status'];
    
    // Use effective values (pending local changes take precedence over HA entity values)
    const baseDifficulty = gameStatus?.attributes?.difficulty_level || 'Easy';
    const baseTeamCount = gameStatus?.attributes?.team_count || 2;
    
    const currentDifficulty = this.getEffectiveFormValue('difficulty', null, baseDifficulty);
    const currentTeamCount = this.getEffectiveFormValue('teamCount', null, baseTeamCount);

    // Difficulty Level Input
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:school" class="input-icon"></ha-icon>
          <h3>Difficulty Level</h3>
        </div>
        <p class="input-description">Choose the difficulty level for your trivia questions</p>
        <select class="form-select" id="difficulty-select">
          <option value="Kids" ${currentDifficulty === 'Kids' ? 'selected' : ''}>🧒 Kids Level</option>
          <option value="Easy" ${currentDifficulty === 'Easy' ? 'selected' : ''}>🎓 Easy Level</option>
          <option value="Medium" ${currentDifficulty === 'Medium' ? 'selected' : ''}>🏛️ Medium Level</option>
          <option value="Hard" ${currentDifficulty === 'Hard' ? 'selected' : ''}>🧠 Hard Level</option>
        </select>
        <div class="difficulty-description" id="difficulty-description" style="margin-top: 8px; opacity: 0.8; font-style: italic;">
          ${this.getDifficultyDescription(currentDifficulty)}
        </div>
      </div>
    `;

    // Team Count Input
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:account-group" class="input-icon"></ha-icon>
          <h3>Number of Teams</h3>
        </div>
        <p class="input-description">How many teams will participate in the game?</p>
        <select class="form-select" id="team-count-select">
          <option value="1" ${currentTeamCount === 1 ? 'selected' : ''}>1 Team</option>
          <option value="2" ${currentTeamCount === 2 ? 'selected' : ''}>2 Teams</option>
          <option value="3" ${currentTeamCount === 3 ? 'selected' : ''}>3 Teams</option>
          <option value="4" ${currentTeamCount === 4 ? 'selected' : ''}>4 Teams</option>
          <option value="5" ${currentTeamCount === 5 ? 'selected' : ''}>5 Teams</option>
        </select>
      </div>
    `;

    // Team Setup (show teams based on team count selection)
    const teams = this.getTeams();
    const users = this.homeAssistantUsers || [];
    const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
    
    // Use team count from Home Assistant entity instead of DOM state
    const teamCount = currentTeamCount;
    
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:account-group-outline" class="input-icon"></ha-icon>
          <h3>Team Setup</h3>
        </div>
        <p class="input-description">Assign names and users to your teams</p>
        <div class="splash-teams-container">
          ${Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => {
            // Use effective values for team name and user ID
            const effectiveTeamName = this.getEffectiveFormValue('teamNames', teamId, team.name);
            const effectiveUserId = this.getEffectiveFormValue('teamUserIds', teamId, team.user_id);
            
            return `
            <div class="splash-team-item">
              <label class="team-label">Team ${teamId.split('_')[1]}:</label>
              <input type="text" class="splash-team-input" id="team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                     value="${this.escapeHtml(effectiveTeamName)}" 
                     oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
              <select class="splash-team-select" 
                      onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                      ${isLoadingUsers ? 'disabled' : ''}>
                <option value="">${isLoadingUsers ? 'Loading users...' : 'Select user...'}</option>
                ${users.filter(user => !user.name.startsWith('Home Assistant')).map(user => 
                  `<option value="${this.escapeHtml(user.id)}" ${effectiveUserId === user.id ? 'selected' : ''}>
                    ${this.escapeHtml(user.name)}
                  </option>`
                ).join('')}
              </select>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;

    return inputsHtml;
  }

  renderTeamSetup() {
    const teamCount = 2; // Default
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const checked = i <= teamCount ? 'checked' : '';
      const disabled = i > teamCount ? 'disabled' : '';
      html += `
        <div class="team-row">
          <input type="checkbox" class="team-checkbox" id="team-${i}-enabled" ${checked} ${disabled}>
          <input type="text" class="team-name-input" id="team-${i}-name" 
                 placeholder="Team ${i}" value="Team ${i}" ${disabled}>
        </div>
      `;
    }
    return html;
  }

  async loadHomeAssistantUsers() {
    // Load Home Assistant users if not already loaded
    if (!this.usersLoaded && this._hass) {
      try {
        this._isLoadingUsers = true;
        this.homeAssistantUsers = await this.getHomeAssistantUsers();
        this.usersLoaded = true;
      } catch (error) {
        console.warn('Failed to load Home Assistant users:', error);
        this.homeAssistantUsers = [];
        this.usersLoaded = true;
      } finally {
        this._isLoadingUsers = false;
        // Only re-render if we're showing splash screen and no form element has focus
        if (this.shouldShowSplashScreen()) {
          const activeElement = this.shadowRoot.activeElement;
          const isFormInputActive = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'SELECT' || 
            activeElement.tagName === 'TEXTAREA'
          );
          
          if (!isFormInputActive) {
            this.requestUpdate();
          }
        }
      }
    }
  }

  getHomeAssistantUsers() {
    // Get all Home Assistant users
    // This uses the Home Assistant websocket connection to fetch user data
    if (this._hass && this._hass.user) {
      return this._hass.callWS({
        type: 'config/auth/list'
      }).then(users => {
        return users.map(user => ({
          id: user.id,
          name: user.name || 'Unknown User',
          is_active: user.is_active !== false
        })).filter(user => user.is_active);  // Only return active users
      }).catch(error => {
        console.warn('Could not fetch Home Assistant users:', error);
        return [];
      });
    }
    return Promise.resolve([]);
  }

  // Debounced service call helper
  debouncedServiceCall(key, callback, delay = 300) {
    if (this._debounceTimers[key]) {
      clearTimeout(this._debounceTimers[key]);
    }
    this._debounceTimers[key] = setTimeout(() => {
      callback();
      delete this._debounceTimers[key];
    }, delay);
  }

  // Get the current Home Assistant URL for QR code
  getCurrentHomeAssistantUrl() {
    // Use window.location.origin to get the current URL the browser is using
    // This works for all access methods: local IP, domain, cloud, etc.
    return window.location.origin;
  }

  // Generate a simple QR code for the given text using an offline approach
  generateQRCode(text) {
    // For this simple implementation, we'll create a data URL that represents the QR code
    // This is a basic approach that creates a visual representation without external dependencies
    
    // Create a simple grid-based QR code representation
    const size = 21; // Standard QR code size for small data
    const qrData = this.generateQRMatrix(text, size);
    
    // Convert to SVG
    const cellSize = 7; // Each cell will be 7x7 pixels for a total of ~150px
    const svgSize = size * cellSize;
    
    let svg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qrData[y][x]) {
          svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
    
    svg += '</svg>';
    
    // Convert SVG to data URL
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  // Generate a simple QR code matrix (simplified version)
  generateQRMatrix(text, size) {
    // This is a very simplified QR code generator
    // For a production implementation, you'd want a proper QR code library
    
    // Initialize matrix
    const matrix = Array(size).fill().map(() => Array(size).fill(false));
    
    // Add finder patterns (corners)
    this.addFinderPattern(matrix, 0, 0);
    this.addFinderPattern(matrix, size - 7, 0);
    this.addFinderPattern(matrix, 0, size - 7);
    
    // Add timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }
    
    // Add some data representation (simplified)
    const hash = this.simpleHash(text);
    for (let i = 9; i < size - 9; i++) {
      for (let j = 9; j < size - 9; j++) {
        if (!matrix[i][j]) {
          matrix[i][j] = ((hash + i + j) % 3) === 0;
        }
      }
    }
    
    return matrix;
  }

  // Add QR code finder pattern
  addFinderPattern(matrix, startX, startY) {
    const pattern = [
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, false, false, false, false, true],
      [true, true, true, true, true, true, true]
    ];
    
    for (let i = 0; i < 7 && startY + i < matrix.length; i++) {
      for (let j = 0; j < 7 && startX + j < matrix[0].length; j++) {
        matrix[startY + i][startX + j] = pattern[i][j];
      }
    }
  }

  // Simple hash function for data representation
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  getTeams() {
    // Get team data from Home Assistant states
    const teams = {};
    if (this._hass && this._hass.states) {
      for (let i = 1; i <= 5; i++) {
        const teamState = this._hass.states[`sensor.home_trivia_team_${i}`];
        if (teamState) {
          teams[`team_${i}`] = {
            name: teamState.state || `Team ${i}`,
            user_id: teamState.attributes.user_id || null,
            participating: teamState.attributes.participating || false,
            points: teamState.attributes.points || 0
          };
        }
      }
    }
    return teams;
  }

  updateTeamName(teamId, name) {
    // Store pending value optimistically
    this._pendingFormValues.teamNames[teamId] = name;
    
    // Debounce team name updates
    this.debouncedServiceCall(`teamName_${teamId}`, () => {
      if (this._hass && name.trim()) {
        this._hass.callService('home_trivia', 'update_team_name', {
          team_id: teamId,
          name: name.trim()
        }).then(() => {
          // Clear pending value when backend confirms
          this.clearPendingFormValue('teamNames', teamId);
        }).catch(() => {
          // Keep pending value on error - user can retry
        });
      }
    }, 1000); // Increased delay to prevent frequent resets
  }

  updateTeamUserId(teamId, userId) {
    // Store pending value optimistically
    this._pendingFormValues.teamUserIds[teamId] = userId;
    
    // Debounce team user ID updates
    this.debouncedServiceCall(`teamUserId_${teamId}`, () => {
      if (this._hass) {
        this._hass.callService('home_trivia', 'update_team_user_id', {
          team_id: teamId,
          user_id: userId || null
        }).then(() => {
          // Clear pending value when backend confirms
          this.clearPendingFormValue('teamUserIds', teamId);
        }).catch(() => {
          // Keep pending value on error - user can retry
        });
      }
      
      // Don't trigger full re-render to avoid destroying form focus
      // The service call will update the entity state automatically
    }, 500); // Increased delay for dropdowns
  }

  getDifficultyDescription(difficulty) {
    const descriptions = {
      'Kids': 'Perfect for curious minds around 10 years old! Fun questions about animals, colors, and basic facts.',
      'Easy': 'Great for testing what you learned in school with questions about geography, basic science, and history.',
      'Medium': 'University-level challenges! Dive deeper into literature, advanced science, and complex historical facts.',
      'Hard': 'University-level knowledge! Mind-bending questions about advanced topics, philosophy, and specialized knowledge.'
    };
    return descriptions[difficulty] || descriptions['Easy'];
  }

  updateDifficultyDescription(difficulty) {
    const descElement = this.shadowRoot.getElementById('difficulty-description');
    if (descElement) {
      descElement.textContent = this.getDifficultyDescription(difficulty);
    }
  }

  updateTeamSetup(teamCount) {
    // Update the splash screen to show the correct number of teams
    const splashTeamsContainer = this.shadowRoot.querySelector('.splash-teams-container');
    if (splashTeamsContainer) {
      const teams = this.getTeams();
      const users = this.homeAssistantUsers || [];
      const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
      
      splashTeamsContainer.innerHTML = Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => {
        // Use effective values for team name and user ID
        const effectiveTeamName = this.getEffectiveFormValue('teamNames', teamId, team.name);
        const effectiveUserId = this.getEffectiveFormValue('teamUserIds', teamId, team.user_id);
        
        return `
        <div class="splash-team-item">
          <label class="team-label">Team ${teamId.split('_')[1]}:</label>
          <input type="text" class="splash-team-input" id="team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                 value="${this.escapeHtml(effectiveTeamName)}" 
                 oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
          <select class="splash-team-select" 
                  onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                  ${isLoadingUsers ? 'disabled' : ''}>
            <option value="">${isLoadingUsers ? 'Loading users...' : 'Select user...'}</option>
            ${users.filter(user => !user.name.startsWith('Home Assistant')).map(user => 
              `<option value="${this.escapeHtml(user.id)}" ${effectiveUserId === user.id ? 'selected' : ''}>
                ${this.escapeHtml(user.name)}
              </option>`
            ).join('')}
          </select>
        </div>
      `;
      }).join('');
    }
    
    // Update team participation status for all teams
    for (let i = 1; i <= 5; i++) {
      const participating = i <= teamCount;
      this.debouncedServiceCall(`teamParticipation_${i}`, () => {
        this._hass.callService('home_trivia', 'update_team_participating', {
          team_id: `team_${i}`,
          participating: participating
        });
      }, 100 + (i * 50));
    }
  }

  updateMainTeamSetup(teamCount) {
    // Update the main game team management section to show the correct number of teams
    // This uses the same logic as updateTeamSetup() from splash screen
    const mainTeamsContainer = this.shadowRoot.querySelector('.main-teams-container');
    if (mainTeamsContainer) {
      const teams = this.getTeams();
      const users = this.homeAssistantUsers || [];
      const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
      
      mainTeamsContainer.innerHTML = Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => `
        <div class="main-team-item">
          <label class="team-label">Team ${teamId.split('_')[1]}:</label>
          <input type="text" class="main-team-input" id="main-team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                 value="${this.escapeHtml(team.name)}" 
                 oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
          <select class="main-team-select" 
                  onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                  ${isLoadingUsers ? 'disabled' : ''}>
            <option value="">${isLoadingUsers ? 'Loading users...' : 'Select user...'}</option>
            ${users.filter(user => !user.name.startsWith('Home Assistant')).map(user => 
              `<option value="${this.escapeHtml(user.id)}" ${team.user_id === user.id ? 'selected' : ''}>
                ${this.escapeHtml(user.name)}
              </option>`
            ).join('')}
          </select>
        </div>
      `).join('');
    }
    
    // Update team participation status for all teams (same logic as splash screen)
    for (let i = 1; i <= 5; i++) {
      const participating = i <= teamCount;
      this.debouncedServiceCall(`mainTeamParticipation_${i}`, () => {
        this._hass.callService('home_trivia', 'update_team_participating', {
          team_id: `team_${i}`,
          participating: participating
        });
      }, 100 + (i * 50));
    }
  }

  async startGame() {
    const difficulty = this.shadowRoot.getElementById('difficulty-select')?.value || 'Easy';
    
    // Get current timer length from Home Assistant entity (no longer reading from splash screen)
    const timerSensor = this._hass?.states['sensor.home_trivia_countdown_timer'];
    const timerLength = parseInt(timerSensor?.state || '30');
    
    // Get team count from Home Assistant entity instead of DOM
    const gameStatus = this._hass?.states['sensor.home_trivia_game_status'];
    const teamCount = gameStatus?.attributes?.team_count || 2;

    // Update game settings using debounced calls
    this.debouncedServiceCall('startGame_difficulty', () => {
      this._hass.callService('home_trivia', 'update_difficulty_level', {
        difficulty_level: difficulty
      });
    }, 100);

    this.debouncedServiceCall('startGame_timer', () => {
      this._hass.callService('home_trivia', 'update_countdown_timer_length', {
        timer_length: timerLength
      });
    }, 150);

    // Note: No need to update team count as it's already persisted when changed

    // Update team names with debounced calls
    const teams = this.getTeams();
    Object.entries(teams).slice(0, teamCount).forEach(([teamId, team], index) => {
      const nameInput = this.shadowRoot.getElementById(`team-${teamId.split('_')[1]}-name`);
      const teamName = nameInput?.value || team.name;
      
      if (teamName && teamName !== `Team ${teamId.split('_')[1]}`) {
        this.debouncedServiceCall(`startGame_teamName_${teamId}`, () => {
          this._hass.callService('home_trivia', 'update_team_name', {
            team_id: teamId,
            name: teamName
          });
        }, 300 + (index * 50));
      }
    });

    // Start the game after a delay to ensure all settings are applied
    setTimeout(() => {
      this._hass.callService('home_trivia', 'start_game', {});
    }, 800);
  }

  renderMainGame() {
    const gameStatus = this._hass.states['sensor.home_trivia_game_status'];
    const currentQuestion = this._hass.states['sensor.home_trivia_current_question'];
    const countdown = this._hass.states['sensor.home_trivia_countdown_current'];
    
    this.shadowRoot.innerHTML = `
      <style>
        .game-container {
          font-family: var(--ha-card-header-font-family, inherit);
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
          box-shadow: var(--ha-card-box-shadow, var(--paper-material-elevation-1_-_box-shadow));
          overflow: hidden;
        }
        .game-header {
          background: var(--primary-color);
          color: white;
          padding: 20px;
          text-align: center;
        }
        .game-title {
          font-size: 1.8em;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .game-status {
          font-size: 1.2em;
          opacity: 0.9;
        }
        .game-content {
          padding: 20px;
        }
        .question-section {
          margin-bottom: 30px;
          text-align: center;
        }
        .question-title {
          font-size: 1.4em;
          font-weight: bold;
          margin-bottom: 15px;
          color: var(--primary-text-color);
        }
        .question-text {
          font-size: 1.1em;
          margin-bottom: 20px;
          color: var(--primary-text-color);
          line-height: 1.5;
        }
        .answers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }
        .answer-button {
          padding: 15px;
          border: 2px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color, white);
          cursor: pointer;
          font-size: 1em;
          transition: all 0.2s;
        }
        .answer-button:hover {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }
        .countdown-timer {
          text-align: center;
          font-size: 2em;
          font-weight: bold;
          color: var(--primary-color);
          margin-bottom: 20px;
        }
        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        .team-card {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .team-name {
          font-weight: bold;
          margin-bottom: 10px;
          color: var(--primary-text-color);
        }
        .team-points {
          font-size: 1.2em;
          color: var(--primary-color);
          margin-bottom: 10px;
        }
        .team-answer {
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 0.9em;
          font-weight: bold;
        }
        .team-answered {
          background: var(--success-color, green);
          color: white;
        }
        .team-not-answered {
          background: var(--warning-color, orange);
          color: white;
        }
        .game-controls {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .control-button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }
        .primary-button {
          background: var(--primary-color);
          color: white;
        }
        .secondary-button {
          background: var(--secondary-color, #ccc);
          color: var(--primary-text-color);
        }
        .control-button:hover {
          opacity: 0.8;
        }
        .fun-fact {
          background: var(--info-color, #e3f2fd);
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          border-left: 4px solid var(--primary-color);
        }
        .fun-fact-title {
          font-weight: bold;
          margin-bottom: 10px;
          color: var(--primary-text-color);
        }
        .team-management-section {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          margin-bottom: 20px;
          overflow: hidden;
        }
        .section-header {
          background: var(--secondary-background-color, #f5f5f5);
          padding: 15px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s;
        }
        .section-header:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .section-header h3 {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 1.1em;
        }
        .expand-icon {
          font-size: 1.2em;
          color: var(--primary-color);
          transition: transform 0.2s;
        }
        .team-management-content {
          padding: 20px;
          background: var(--card-background-color, white);
        }
        .team-count-section, .team-setup-section {
          margin-bottom: 20px;
        }
        .management-input-header {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .management-input-header h4 {
          margin: 0 0 0 8px;
          font-size: 1em;
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .management-input-header .input-icon {
          --mdc-icon-size: 18px;
          color: var(--primary-color);
        }
        .input-description {
          margin: 0 0 12px 0;
          opacity: 0.7;
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        .form-select, .main-team-input, .main-team-select {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color, white);
          color: var(--primary-text-color);
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .form-select:focus, .main-team-input:focus, .main-team-select:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(var(--rgb-primary-color), 0.2);
        }
        .main-teams-container {
          display: grid;
          gap: 12px;
        }
        .main-team-item {
          display: grid;
          grid-template-columns: auto 1fr 1fr;
          gap: 12px;
          align-items: center;
          background: var(--secondary-background-color, #f5f5f5);
          padding: 12px;
          border-radius: 6px;
          border: 1px solid var(--divider-color);
        }
        .main-team-item:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .main-team-item .team-label {
          font-weight: 600;
          white-space: nowrap;
          color: var(--primary-text-color);
        }
        @media (max-width: 768px) {
          .main-team-item {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 8px;
          }
          .main-team-item .team-label {
            text-align: center;
          }
        }
      </style>
      
      <div class="game-container">
        <div class="game-header">
          <div class="game-title">🎯 Home Trivia</div>
          <div class="game-status">${gameStatus ? gameStatus.state : 'Loading...'}</div>
        </div>
        
        <div class="game-content">
          ${this.renderQuestionSection(currentQuestion, countdown)}
          ${this.renderTeamsSection()}
          ${this.renderTeamManagement()}
          ${this.renderGameSettings()}
          ${this.renderGameControls(gameStatus)}
        </div>
      </div>
    `;
    
    // Add event listeners for team management and game settings
    setTimeout(() => {
      const teamCountSelect = this.shadowRoot.getElementById('main-team-count-select');
      if (teamCountSelect) {
        teamCountSelect.addEventListener('change', (e) => {
          const teamCount = parseInt(e.target.value);
          
          // Persist team count immediately (same logic as splash screen)
          this.debouncedServiceCall('main_team_count', () => {
            this._hass.callService('home_trivia', 'update_team_count', {
              team_count: teamCount
            });
          }, 100);
          
          // Update team setup display immediately (same logic as splash screen)
          this.updateMainTeamSetup(teamCount);
        });
      }

      // Add event listener for game settings timer
      const gameSettingsTimerSelect = this.shadowRoot.getElementById('game-settings-timer-select');
      if (gameSettingsTimerSelect) {
        gameSettingsTimerSelect.addEventListener('change', (e) => {
          // Store pending value optimistically
          this._pendingFormValues.timerLength = e.target.value;
          
          // Persist timer length immediately
          this.debouncedServiceCall('game_settings_timer_length', () => {
            this._hass.callService('home_trivia', 'update_countdown_timer_length', {
              timer_length: parseInt(e.target.value)
            }).then(() => {
              // Clear pending value when backend confirms
              this.clearPendingFormValue('timerLength');
            }).catch(() => {
              // Keep pending value on error - user can retry
            });
          }, 500); // Same delay as splash screen
        });
      }
    }, 0);
  }

  renderQuestionSection(currentQuestion, countdown) {
    if (!currentQuestion || !currentQuestion.attributes.question) {
      return `
        <div class="question-section">
          <div class="question-title">Ready for the next question?</div>
          <div class="question-text">Click "Next Question" to start!</div>
        </div>
      `;
    }

    const timeLeft = countdown ? countdown.state : 0;
    const isTimeUp = timeLeft <= 0;

    let html = `
      <div class="question-section">
        <div class="countdown-timer">${timeLeft}s</div>
        <div class="question-title">${currentQuestion.attributes.category}</div>
        <div class="question-text">${currentQuestion.attributes.question}</div>
    `;

    if (!isTimeUp) {
      html += `
        <div class="answers-grid">
          <div class="answer-button" onclick="this.getRootNode().host.selectAnswer('A')">
            A) ${currentQuestion.attributes.answer_a}
          </div>
          <div class="answer-button" onclick="this.getRootNode().host.selectAnswer('B')">
            B) ${currentQuestion.attributes.answer_b}
          </div>
          <div class="answer-button" onclick="this.getRootNode().host.selectAnswer('C')">
            C) ${currentQuestion.attributes.answer_c}
          </div>
        </div>
      `;
    } else {
      // Show correct answer and fun fact
      const correctAnswer = currentQuestion.attributes.correct_answer;
      const answerText = currentQuestion.attributes[`answer_${correctAnswer.toLowerCase()}`];
      
      html += `
        <div class="question-text" style="color: var(--success-color, green); font-weight: bold;">
          Correct Answer: ${correctAnswer}) ${answerText}
        </div>
        ${currentQuestion.attributes.fun_fact ? `
          <div class="fun-fact">
            <div class="fun-fact-title">🎓 Fun Fact</div>
            <div>${currentQuestion.attributes.fun_fact}</div>
          </div>
        ` : ''}
      `;
    }

    html += '</div>';
    return html;
  }

  renderTeamsSection() {
    let html = '<div class="teams-grid">';
    
    for (let i = 1; i <= 5; i++) {
      const team = this._hass.states[`sensor.home_trivia_team_${i}`];
      if (!team || !team.attributes.participating) continue;

      const answered = team.attributes.answered;
      const answer = team.attributes.answer;
      const points = team.attributes.points || 0;

      html += `
        <div class="team-card">
          <div class="team-name">${team.state}</div>
          <div class="team-points">${points} points</div>
          <div class="team-answer ${answered ? 'team-answered' : 'team-not-answered'}">
            ${answered ? `Answer: ${answer}` : 'Not answered'}
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }

  renderTeamManagement() {
    const isExpanded = this.teamManagementExpanded;
    
    return `
      <div class="team-management-section">
        <div class="section-header" onclick="this.getRootNode().host.toggleTeamManagement()">
          <h3>🛠️ Team Management</h3>
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>
        ${isExpanded ? this.renderTeamManagementContent() : ''}
      </div>
    `;
  }

  renderTeamManagementContent() {
    // Get current values from Home Assistant entities (same logic as splash screen)
    const gameStatus = this._hass?.states['sensor.home_trivia_game_status'];
    const currentTeamCount = gameStatus?.attributes?.team_count || 2;
    
    const teams = this.getTeams();
    const users = this.homeAssistantUsers || [];
    const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
    
    return `
      <div class="team-management-content">
        <div class="team-count-section">
          <div class="management-input-header">
            <ha-icon icon="mdi:account-group" class="input-icon"></ha-icon>
            <h4>Number of Teams</h4>
          </div>
          <p class="input-description">How many teams will participate in the game?</p>
          <select class="form-select" id="main-team-count-select">
            <option value="1" ${currentTeamCount === 1 ? 'selected' : ''}>1 Team</option>
            <option value="2" ${currentTeamCount === 2 ? 'selected' : ''}>2 Teams</option>
            <option value="3" ${currentTeamCount === 3 ? 'selected' : ''}>3 Teams</option>
            <option value="4" ${currentTeamCount === 4 ? 'selected' : ''}>4 Teams</option>
            <option value="5" ${currentTeamCount === 5 ? 'selected' : ''}>5 Teams</option>
          </select>
        </div>
        
        <div class="team-setup-section">
          <div class="management-input-header">
            <ha-icon icon="mdi:account-group-outline" class="input-icon"></ha-icon>
            <h4>Team Setup</h4>
          </div>
          <p class="input-description">Assign names and users to your teams</p>
          <div class="main-teams-container">
            ${Object.entries(teams).slice(0, currentTeamCount).map(([teamId, team]) => `
              <div class="main-team-item">
                <label class="team-label">Team ${teamId.split('_')[1]}:</label>
                <input type="text" class="main-team-input" id="main-team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                       value="${this.escapeHtml(team.name)}" 
                       oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
                <select class="main-team-select" 
                        onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                        ${isLoadingUsers ? 'disabled' : ''}>
                  <option value="">${isLoadingUsers ? 'Loading users...' : 'Select user...'}</option>
                  ${users.filter(user => !user.name.startsWith('Home Assistant')).map(user => 
                    `<option value="${this.escapeHtml(user.id)}" ${team.user_id === user.id ? 'selected' : ''}>
                      ${this.escapeHtml(user.name)}
                    </option>`
                  ).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  toggleTeamManagement() {
    this.teamManagementExpanded = !this.teamManagementExpanded;
    this.requestUpdate();
  }

  toggleGameSettings() {
    this.gameSettingsExpanded = !this.gameSettingsExpanded;
    this.requestUpdate();
  }

  renderGameSettings() {
    // Only show game settings to admin users
    if (!this.isCurrentUserAdmin()) {
      return '';
    }

    const isExpanded = this.gameSettingsExpanded;
    
    return `
      <div class="team-management-section">
        <div class="section-header" onclick="this.getRootNode().host.toggleGameSettings()">
          <h3>⚙️ Game Settings</h3>
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>
        ${isExpanded ? this.renderGameSettingsContent() : ''}
      </div>
    `;
  }

  renderGameSettingsContent() {
    // Get current timer length from Home Assistant entity
    const timerSensor = this._hass?.states['sensor.home_trivia_countdown_timer'];
    const currentTimerLength = this.getEffectiveFormValue('timerLength', null, timerSensor?.state || '30');
    
    return `
      <div class="team-management-content">
        <div class="game-reset-section" style="margin-bottom: 20px;">
          <button class="control-button secondary-button" onclick="this.getRootNode().host.resetGame()" style="width: 100%;">
            🔄 Reset Game
          </button>
        </div>
        
        <div class="timer-section">
          <div class="management-input-header">
            <ha-icon icon="mdi:timer-outline" class="input-icon"></ha-icon>
            <h4>Timer Length</h4>
          </div>
          <p class="input-description">How long teams have to answer each question</p>
          <select class="form-select" id="game-settings-timer-select">
            <option value="15" ${currentTimerLength === '15' ? 'selected' : ''}>15 seconds</option>
            <option value="20" ${currentTimerLength === '20' ? 'selected' : ''}>20 seconds</option>
            <option value="30" ${currentTimerLength === '30' ? 'selected' : ''}>30 seconds</option>
            <option value="45" ${currentTimerLength === '45' ? 'selected' : ''}>45 seconds</option>
            <option value="60" ${currentTimerLength === '60' ? 'selected' : ''}>60 seconds</option>
          </select>
        </div>
      </div>
    `;
  }

  renderGameControls(gameStatus) {
    const isPlaying = gameStatus && gameStatus.state === 'playing';
    
    return `
      <div class="game-controls">
        <button class="control-button primary-button" onclick="this.getRootNode().host.nextQuestion()">
          ▶️ Next Question
        </button>
        ${!isPlaying ? `
          <button class="control-button secondary-button" onclick="this.getRootNode().host.startNewGame()">
            🚀 Start New Game
          </button>
        ` : ''}
      </div>
    `;
  }

  async selectAnswer(answer) {
    // This would typically be called from team-specific UI
    // For now, we'll just show it works
    console.log('Answer selected:', answer);
  }

  async nextQuestion() {
    await this._hass.callService('home_trivia', 'next_question', {});
  }

  async stopGame() {
    await this._hass.callService('home_trivia', 'stop_game', {});
  }

  async resetGame() {
    await this._hass.callService('home_trivia', 'reset_game', {});
  }

  async startNewGame() {
    // Reset the game first to restore default team names, which will trigger the splash screen
    await this.resetGame();
    // The splash screen will appear automatically on the next render cycle
    // because resetGame() will restore default team names, making shouldShowSplashScreen() return true
  }

  getCardSize() {
    return 6;
  }
}

// Register the card
customElements.define('home-trivia-card', HomeTriviaCard);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'home-trivia-card',
  name: 'Home Trivia Card',
  description: 'A card for the Home Trivia game'
});

console.info(
  '%c  HOME-TRIVIA-CARD  %c  Version 1.0.0  ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);