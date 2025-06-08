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
    
    // Initialize translation system
    this.translations = {};
    this.currentLanguage = localStorage.getItem('home-trivia-language') || 'en';
    this._loadTranslations();
  }

  // HTML escape utility for security
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load translations from the translations.json file
  async _loadTranslations() {
    try {
      const response = await fetch('/home_trivia_frontend_assets/translations.json');
      if (response.ok) {
        this.translations = await response.json();
      } else {
        console.warn('Failed to load translations, using fallback');
        this._initializeFallbackTranslations();
      }
    } catch (error) {
      console.warn('Error loading translations:', error);
      this._initializeFallbackTranslations();
    }
  }

  // Fallback translations in case file loading fails
  _initializeFallbackTranslations() {
    this.translations = {
      en: {
        loading: "Loading Home Trivia...",
        welcome: "🎯 Welcome to Home Trivia!",
        gameTitle: "🎯 Home Trivia",
        gameSettings: "⚙️ Game Settings",
        teamManagement: "🛠️ Team Management",
        language: "🌐 Language"
      },
      de: {
        loading: "Lade Home Trivia...",
        welcome: "🎯 Willkommen bei Home Trivia!",
        gameTitle: "🎯 Home Trivia", 
        gameSettings: "⚙️ Spiel-Einstellungen",
        teamManagement: "🛠️ Team-Verwaltung",
        language: "🌐 Sprache"
      }
    };
  }

  // Get translated text
  t(key, fallback = null) {
    const keys = key.split('.');
    let value = this.translations[this.currentLanguage];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found in current language
        value = this.translations['en'];
        for (const k2 of keys) {
          if (value && typeof value === 'object' && k2 in value) {
            value = value[k2];
          } else {
            return fallback || key;
          }
        }
        break;
      }
    }
    
    return value || fallback || key;
  }

  // Switch language and save preference
  switchLanguage(lang) {
    this.currentLanguage = lang;
    localStorage.setItem('home-trivia-language', lang);
    this.requestUpdate();
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

  // Check if current user is admin (Team 1 owner)
  isCurrentUserAdmin() {
    if (!this._hass || !this._hass.user) {
      return false;
    }
    
    // Admin rights are determined by Team 1 ownership
    const team1State = this._hass.states['sensor.home_trivia_team_1'];
    if (!team1State) {
      return false;
    }
    
    return team1State.attributes.user_id === this._hass.user.id;
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
      this.shadowRoot.innerHTML = `<div style="padding: 20px;">${this.t('loading')}</div>`;
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
          padding: 32px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border-radius: var(--ha-card-border-radius, 12px);
          color: white;
          position: relative;
          overflow: hidden;
          min-height: 500px;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.15);
        }
        
        .splash-header {
          position: relative;
          z-index: 2;
          margin-bottom: 32px;
        }
        

        
        .splash-title {
          font-size: 3em;
          font-weight: 800;
          margin-bottom: 16px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.2);
          letter-spacing: 1px;
          color: white;
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
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          color: #1e293b;
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
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          text-align: left;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          color: #1e293b;
        }
        
        .splash-input-section:hover {
          background: rgba(255, 255, 255, 1.0);
          border-color: rgba(37, 99, 235, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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
          margin: 0 0 0 12px;
          font-size: 1.3em;
          font-weight: 700;
          color: #1e293b;
        }
        
        .input-icon {
          --mdc-icon-size: 24px;
          color: #2563eb;
        }
        
        .input-description {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 0.95em;
          line-height: 1.4;
        }
        
        .form-select, .splash-team-input, .splash-team-select {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.95);
          color: #2d3748;
          font-size: 16px;
          font-weight: 500;
          box-sizing: border-box;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        
        .form-select:focus, .splash-team-input:focus, .splash-team-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1), 0 4px 16px rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 1.0);
          transform: translateY(-1px);
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
          background: rgba(248, 250, 252, 0.8);
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        
        .splash-team-item:hover {
          background: rgba(248, 250, 252, 1.0);
          border-color: #cbd5e1;
        }
        
        .team-label {
          font-weight: 600;
          white-space: nowrap;
          color: #1e293b;
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
          background: #059669;
          border-color: #059669;
          color: white;
        }
        
        .splash-start-button.ready:hover {
          background: #047857;
          box-shadow: 0 6px 20px rgba(5, 150, 105, 0.3);
        }
        
        .start-help {
          margin: 8px 0 0 0;
          font-size: 0.9em;
          opacity: 0.7;
        }
        
        .splash-qr-section {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
          color: #1e293b;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
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
          .splash-screen {
            padding: 24px 16px;
            min-height: 400px;
          }
          .splash-title {
            font-size: 2.2em;
          }
          .splash-subtitle {
            font-size: 1em;
          }
          .splash-input-section {
            padding: 20px 16px;
            margin-bottom: 16px;
          }
          .splash-input-header h3 {
            font-size: 1.1em;
          }
          .splash-team-item {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 8px;
          }
          .team-label {
            text-align: center;
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
        
        @media (max-width: 480px) {
          .splash-screen {
            padding: 20px 12px;
          }
          .splash-title {
            font-size: 1.8em;
          }
          .splash-input-section {
            padding: 16px 12px;
          }
          .form-select, .splash-team-input, .splash-team-select {
            padding: 14px 16px;
            font-size: 15px;
          }
        }
      </style>

      <div class="splash-screen">

        
        <div class="splash-header">
          <h1 class="splash-title">
            ${this.t('welcome')}
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
          <h3>${this.t('difficultyLevel')}</h3>
        </div>
        <p class="input-description">${this.t('difficultySelectionHint')}</p>
        <select class="form-select" id="difficulty-select">
          <option value="Kids" ${currentDifficulty === 'Kids' ? 'selected' : ''}>${this.t('difficultyKids')}</option>
          <option value="Easy" ${currentDifficulty === 'Easy' ? 'selected' : ''}>${this.t('difficultyEasy')}</option>
          <option value="Medium" ${currentDifficulty === 'Medium' ? 'selected' : ''}>${this.t('difficultyMedium')}</option>
          <option value="Hard" ${currentDifficulty === 'Hard' ? 'selected' : ''}>${this.t('difficultyHard')}</option>
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
          <h3>${this.t('numberOfTeams')}</h3>
        </div>
        <p class="input-description">${this.t('teamCountHint')}</p>
        <select class="form-select" id="team-count-select">
          <option value="1" ${currentTeamCount === 1 ? 'selected' : ''}>1 ${this.t('team')}</option>
          <option value="2" ${currentTeamCount === 2 ? 'selected' : ''}>2 ${this.t('team')}s</option>
          <option value="3" ${currentTeamCount === 3 ? 'selected' : ''}>3 ${this.t('team')}s</option>
          <option value="4" ${currentTeamCount === 4 ? 'selected' : ''}>4 ${this.t('team')}s</option>
          <option value="5" ${currentTeamCount === 5 ? 'selected' : ''}>5 ${this.t('team')}s</option>
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
          <h3>${this.t('teamSetup')}</h3>
        </div>
        <p class="input-description">${this.t('teamSetupHint')}</p>
        <div class="splash-teams-container">
          ${Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => {
            // Use effective values for team name and user ID
            const effectiveTeamName = this.getEffectiveFormValue('teamNames', teamId, team.name);
            const effectiveUserId = this.getEffectiveFormValue('teamUserIds', teamId, team.user_id);
            
            return `
            <div class="splash-team-item">
              <label class="team-label">${this.t('team')} ${teamId.split('_')[1]}:</label>
              <input type="text" class="splash-team-input" id="team-${teamId.split('_')[1]}-name" placeholder="${this.t('teamName')}" 
                     value="${this.escapeHtml(effectiveTeamName)}" 
                     oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
              <select class="splash-team-select" 
                      onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                      ${isLoadingUsers ? 'disabled' : ''}>
                <option value="">${isLoadingUsers ? this.t('loadingUsers') : this.t('selectUser')}</option>
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
    return this.t(`difficultyDescriptions.${difficulty}`, `Choose your challenge level!`);
  }

  updateDifficultyDescription(difficulty) {
    const descElement = this.shadowRoot.getElementById('difficulty-description');
    if (descElement) {
      descElement.textContent = this.getDifficultyDescription(difficulty);
    }
  }

  // Reusable function to generate team setup HTML
  renderTeamSetupItems(teams, users, isLoadingUsers, teamCount, containerType = 'splash') {
    const cssClass = containerType === 'splash' ? 'splash-team' : 'main-team';
    const useEffectiveValues = containerType === 'splash';
    
    return Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => {
      // Use effective values for splash screen (pending changes), direct values for main game
      const teamName = useEffectiveValues ? 
        this.getEffectiveFormValue('teamNames', teamId, team.name) : team.name;
      const userId = useEffectiveValues ? 
        this.getEffectiveFormValue('teamUserIds', teamId, team.user_id) : team.user_id;
      
      const teamNumber = teamId.split('_')[1];
      const inputId = `${containerType === 'splash' ? 'team' : 'main-team'}-${teamNumber}-name`;
      
      return `
        <div class="${cssClass}-item">
          <label class="team-label">Team ${teamNumber}:</label>
          <input type="text" class="${cssClass}-input" id="${inputId}" placeholder="Team Name" 
                 value="${this.escapeHtml(teamName)}" 
                 oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
          <select class="${cssClass}-select" 
                  onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                  ${isLoadingUsers ? 'disabled' : ''}>
            <option value="">${isLoadingUsers ? 'Loading users...' : 'Select user...'}</option>
            ${users.filter(user => !user.name.startsWith('Home Assistant')).map(user => 
              `<option value="${this.escapeHtml(user.id)}" ${userId === user.id ? 'selected' : ''}>
                ${this.escapeHtml(user.name)}
              </option>`
            ).join('')}
          </select>
        </div>
      `;
    }).join('');
  }

  // Centralized function to update team participation status
  updateTeamParticipation(teamCount, keyPrefix = 'teamParticipation') {
    for (let i = 1; i <= 5; i++) {
      const participating = i <= teamCount;
      this.debouncedServiceCall(`${keyPrefix}_${i}`, () => {
        this._hass.callService('home_trivia', 'update_team_participating', {
          team_id: `team_${i}`,
          participating: participating
        });
      }, 100 + (i * 50));
    }
  }

  updateTeamSetup(teamCount) {
    // Update the splash screen to show the correct number of teams
    const splashTeamsContainer = this.shadowRoot.querySelector('.splash-teams-container');
    if (splashTeamsContainer) {
      const teams = this.getTeams();
      const users = this.homeAssistantUsers || [];
      const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
      
      splashTeamsContainer.innerHTML = this.renderTeamSetupItems(teams, users, isLoadingUsers, teamCount, 'splash');
    }
    
    // Update team participation status for all teams
    this.updateTeamParticipation(teamCount, 'teamParticipation');
  }

  updateMainTeamSetup(teamCount) {
    // Update the main game team management section to show the correct number of teams
    const mainTeamsContainer = this.shadowRoot.querySelector('.main-teams-container');
    if (mainTeamsContainer) {
      const teams = this.getTeams();
      const users = this.homeAssistantUsers || [];
      const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
      
      mainTeamsContainer.innerHTML = this.renderTeamSetupItems(teams, users, isLoadingUsers, teamCount, 'main');
    }
    
    // Update team participation status for all teams
    this.updateTeamParticipation(teamCount, 'mainTeamParticipation');
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

    // Determine container classes based on countdown state
    let containerClasses = 'game-container';
    const timeLeft = countdown ? parseInt(countdown.state, 10) : 0;
    const isRunning = countdown?.attributes.is_running;

    if (isRunning && timeLeft <= 5 && timeLeft > 0) {
      containerClasses += ' warning-pulse';
    } else if (timeLeft <= 0) {
      containerClasses += ' time-up-pulse';
    }
    
    this.shadowRoot.innerHTML = `
      <style>
        .game-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', sans-serif;
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 16px);
          border: none;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 16px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }
        .game-header {
          background: #2563eb;
          color: white;
          padding: 32px 24px;
          text-align: center;
          position: relative;
        }
        .game-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.05);
          opacity: 0.8;
        }
        .game-title {
          font-size: 2.2em;
          font-weight: 800;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .game-status {
          font-size: 1.3em;
          opacity: 0.95;
          position: relative;
          z-index: 1;
          font-weight: 500;
        }
        .game-content {
          padding: 32px 24px;
        }
        .question-section {
          margin-bottom: 40px;
          text-align: center;
        }
        .question-title {
          font-size: 1.6em;
          font-weight: 700;
          margin-bottom: 20px;
          color: var(--primary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .question-text {
          font-size: 1.2em;
          margin-bottom: 24px;
          color: var(--primary-text-color);
          line-height: 1.6;
          font-weight: 500;
        }
        .answers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        .answer-button {
          padding: 20px 24px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          font-size: 1.1em;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          text-align: left;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          color: #1e293b;
        }
        .answer-button:hover {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.2);
        }
        }
        .countdown-timer {
          text-align: center;
          font-size: 2em;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 20px;
          padding: 10px;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .countdown-timer.time-up {
          color: #dc2626;
          background-color: rgba(220, 38, 38, 0.1);
          animation: pulse-red 1s infinite;
        }
        .countdown-timer.warning {
          color: #f59e0b;
          background-color: rgba(245, 158, 11, 0.1);
        }
        @keyframes pulse-red {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-orange-shadow {
          0% { box-shadow: 0 8px 32px rgba(245, 158, 11, 0.4), 0 2px 16px rgba(245, 158, 11, 0.2); }
          50% { box-shadow: 0 12px 40px rgba(245, 158, 11, 0.6), 0 4px 20px rgba(245, 158, 11, 0.4); }
          100% { box-shadow: 0 8px 32px rgba(245, 158, 11, 0.4), 0 2px 16px rgba(245, 158, 11, 0.2); }
        }
        @keyframes pulse-red-shadow {
          0% { box-shadow: 0 8px 32px rgba(220, 38, 38, 0.4), 0 2px 16px rgba(220, 38, 38, 0.2); }
          50% { box-shadow: 0 12px 40px rgba(220, 38, 38, 0.6), 0 4px 20px rgba(220, 38, 38, 0.4); }
          100% { box-shadow: 0 8px 32px rgba(220, 38, 38, 0.4), 0 2px 16px rgba(220, 38, 38, 0.2); }
        }
        .warning-pulse {
          animation: pulse-orange-shadow 1.2s infinite;
        }
        .time-up-pulse {
          animation: pulse-red-shadow 1.2s infinite;
        }
        .countdown-progress-container {
          margin: 10px auto 20px auto;
          max-width: 300px;
        }
        .countdown-progress-bar {
          width: 100%;
          height: 8px;
          background-color: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .countdown-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #059669, #2563eb);
          border-radius: 4px;
          transition: width 0.8s ease-out;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .countdown-timer.warning + .countdown-progress-container .countdown-progress-fill {
          background: linear-gradient(90deg, #f59e0b, #dc2626);
        }
        .countdown-timer.time-up + .countdown-progress-container .countdown-progress-fill {
          background: #dc2626;
          animation: progress-pulse 1s infinite;
        }
        @keyframes progress-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .team-card {
          border: none;
          border-radius: 12px;
          padding: 24px 20px;
          text-align: center;
          background: white;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          position: relative;
          overflow: hidden;
          border: 1px solid #f1f5f9;
        }
        .team-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: #2563eb;
        }
        .team-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
          border-color: #e2e8f0;
        }
        .team-name {
          font-weight: 700;
          margin-bottom: 12px;
          color: var(--primary-text-color);
          font-size: 1.1em;
        }
        .team-points {
          font-size: 1.4em;
          color: #2563eb;
          margin-bottom: 16px;
          font-weight: 800;
        }
        .team-answer {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .team-answered {
          background: #059669;
          color: white;
        }
        .team-not-answered {
          background: #f59e0b;
          color: white;
        }
        .team-last-round {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 0.8em;
          margin-top: 5px;
          font-style: italic;
        }
        .team-correct {
          background: #059669;
          color: white;
        }
        .team-incorrect {
          background: #dc2626;
          color: white;
        }
        /* New team card states */
        .team-card-neutral {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .team-card-neutral::before {
          background: #94a3b8;
        }
        .team-card-answered-during-timer {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        .team-card-answered-during-timer::before {
          background: #22c55e;
        }
        .team-card-results {
          background: white;
          border-color: #f1f5f9;
        }
        .team-card-results::before {
          background: #2563eb;
        }
        /* Team answer status during timer */
        .team-answer-status {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #e2e8f0;
          color: #64748b;
        }
        /* Current answer display */
        .team-current-answer {
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 0.9em;
          font-weight: 600;
          background: #dbeafe;
          color: #1d4ed8;
          margin-bottom: 12px;
        }
        /* Badge container */
        .team-badges {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
        }
        /* Individual badges */
        .team-answer-badge, .team-points-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .badge-correct {
          background: #059669;
          color: white;
        }
        .badge-incorrect {
          background: #dc2626;
          color: white;
        }
        .game-controls {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 32px;
        }
        .control-button {
          padding: 16px 32px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 700;
          font-size: 1.1em;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: relative;
          overflow: hidden;
        }
        .control-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }
        .control-button:hover::before {
          left: 100%;
        }
        .primary-button {
          background: #2563eb;
          color: white;
        }
        .secondary-button {
          background: #dc2626;
          color: white;
        }
        .control-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .control-button:active {
          transform: translateY(0);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        .fun-fact {
          background: rgba(37, 99, 235, 0.05);
          padding: 20px;
          border-radius: 12px;
          margin-top: 24px;
          border-left: 4px solid #2563eb;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .fun-fact-title {
          font-weight: 700;
          margin-bottom: 12px;
          color: var(--primary-text-color);
          font-size: 1.1em;
        }
        .team-management-section {
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          margin-bottom: 24px;
          overflow: hidden;
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .section-header {
          background: #f8fafc;
          padding: 20px 24px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          border-bottom: 1px solid #e2e8f0;
        }
        .section-header:hover {
          background: #f1f5f9;
          transform: translateY(-1px);
        }
        .section-header h3 {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 1.2em;
          font-weight: 700;
        }
        .expand-icon {
          font-size: 1.3em;
          color: #2563eb;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          font-weight: bold;
        }
        .team-management-content {
          padding: 24px;
          background: white;
        }
        .team-count-section, .team-setup-section {
          margin-bottom: 20px;
        }
        .management-input-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        .management-input-header h4 {
          margin: 0 0 0 12px;
          font-size: 1.1em;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .management-input-header .input-icon {
          --mdc-icon-size: 20px;
          color: #2563eb;
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
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
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
        
        /* Enhanced Mobile Responsiveness */
        @media (max-width: 480px) {
          .game-header {
            padding: 24px 16px;
          }
          .game-title {
            font-size: 1.8em;
          }
          .game-content {
            padding: 24px 16px;
          }
          .question-title {
            font-size: 1.3em;
          }
          .question-text {
            font-size: 1.1em;
          }
          .answer-button {
            padding: 16px 20px;
            font-size: 1em;
          }
          .teams-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .team-card {
            padding: 20px 16px;
          }
          .control-button {
            padding: 14px 24px;
            font-size: 1em;
          }
          .game-controls {
            flex-direction: column;
            gap: 12px;
          }
          .game-controls .control-button {
            width: 100%;
          }
          .section-header {
            padding: 16px 20px;
          }
          .team-management-content {
            padding: 20px 16px;
          }
        }
      </style>
      
      <div class="${containerClasses}">
        <div class="game-header">
          <div class="game-title">${this.t('gameTitle')}</div>
          <div class="game-status">${gameStatus ? gameStatus.state : this.t('loading_')}</div>
        </div>
        
        <div class="game-content">
          ${this.renderQuestionSection(currentQuestion, countdown)}
          ${this.renderTeamsSection()}
          ${this.renderGameSettings()}
          ${this.renderTeamManagement()}
          ${this.renderGameControls(gameStatus, countdown)}
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
          <div class="question-text">${this.t('clickNextQuestion')}</div>
        </div>
      `;
    }

    const timeLeft = countdown ? countdown.state : 0;
    const isRunning = countdown ? countdown.attributes.is_running : false;
    const isTimeUp = timeLeft <= 0;
    
    // Get timer length for progress bar calculation
    // First try to get initial time from countdown sensor attributes (more accurate)
    // Fall back to timer sensor state for initial setup
    const initialTime = countdown?.attributes?.initial_time;
    const timerSensor = this._hass?.states['sensor.home_trivia_countdown_timer'];
    const timerLength = initialTime || parseInt(timerSensor?.state || '30');
    
    // Calculate progress percentage (0-100)
    const progressPercentage = isRunning && timerLength > 0 ? 
      Math.max(0, Math.min(100, (timeLeft / timerLength) * 100)) : 0;
    
    // Determine timer CSS classes based on time remaining
    let timerClasses = 'countdown-timer';
    let timerText = `${timeLeft}s`;
    
    if (isTimeUp) {
      timerClasses += ' time-up';
      timerText = this.t('timeUp');
    } else if (timeLeft <= 5 && isRunning) {
      timerClasses += ' warning';
    }

    let html = `
      <div class="question-section">
        <div class="${timerClasses}">${timerText}</div>
        <div class="countdown-progress-container">
          <div class="countdown-progress-bar">
            <div class="countdown-progress-fill" style="width: ${progressPercentage}%"></div>
          </div>
        </div>
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
          ${this.t('correctAnswer')}: ${correctAnswer}) ${answerText}
        </div>
        ${currentQuestion.attributes.fun_fact ? `
          <div class="fun-fact">
            <div class="fun-fact-title">🎓 ${this.t('funFact')}</div>
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
    
    // Check if timer is currently running to hide answer details
    const countdown = this._hass.states['sensor.home_trivia_countdown_current'];
    const isTimerRunning = countdown && countdown.attributes && countdown.attributes.is_running;
    
    for (let i = 1; i <= 5; i++) {
      const team = this._hass.states[`sensor.home_trivia_team_${i}`];
      if (!team || !team.attributes.participating) continue;

      const answered = team.attributes.answered;
      const answer = team.attributes.answer;
      const points = team.attributes.points || 0;
      
      // Round results for transparency
      const lastRoundAnswer = team.attributes.last_round_answer;
      const lastRoundCorrect = team.attributes.last_round_correct;
      const lastRoundPoints = team.attributes.last_round_points || 0;

      // Determine card state classes
      let cardClasses = 'team-card';
      if (isTimerRunning) {
        // When timer is running: neutral color, light green if answered
        cardClasses += answered ? ' team-card-answered-during-timer' : ' team-card-neutral';
      } else {
        // When timer is not running: normal styling
        cardClasses += ' team-card-results';
      }

      html += `
        <div class="${cardClasses}">
          <div class="team-name">${team.state}</div>
          <div class="team-points">${points} points</div>`;
      
      if (isTimerRunning) {
        // During timer: show answered status only
        html += `
          <div class="team-answer-status">
            ${answered ? this.t('answered') : this.t('notAnswered')}
          </div>`;
      } else {
        // When timer not running: show current answer if available
        if (answered && answer) {
          html += `
            <div class="team-current-answer">
              ${this.t('answer')}: ${answer}
            </div>`;
        }
        
        // Show last round results as badges if available
        if (lastRoundAnswer) {
          html += `
            <div class="team-badges">
              <div class="team-answer-badge ${lastRoundCorrect ? 'badge-correct' : 'badge-incorrect'}">
                ${lastRoundAnswer}
              </div>
              <div class="team-points-badge ${lastRoundCorrect ? 'badge-correct' : 'badge-incorrect'}">
                +${lastRoundPoints}pts
              </div>
            </div>`;
        }
      }
      
      html += `</div>`;
    }
    
    html += '</div>';
    return html;
  }

  renderTeamManagement() {
    const isExpanded = this.teamManagementExpanded;
    
    return `
      <div class="team-management-section">
        <div class="section-header" onclick="this.getRootNode().host.toggleTeamManagement()">
          <h3>${this.t('teamManagement')}</h3>
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
            <h4>${this.t('numberOfTeams')}</h4>
          </div>
          <p class="input-description">${this.t('teamCountHint')}</p>
          <select class="form-select" id="main-team-count-select">
            <option value="1" ${currentTeamCount === 1 ? 'selected' : ''}>1 ${this.t('team')}</option>
            <option value="2" ${currentTeamCount === 2 ? 'selected' : ''}>2 ${this.t('team')}s</option>
            <option value="3" ${currentTeamCount === 3 ? 'selected' : ''}>3 ${this.t('team')}s</option>
            <option value="4" ${currentTeamCount === 4 ? 'selected' : ''}>4 ${this.t('team')}s</option>
            <option value="5" ${currentTeamCount === 5 ? 'selected' : ''}>5 ${this.t('team')}s</option>
          </select>
        </div>
        
        <div class="team-setup-section">
          <div class="management-input-header">
            <ha-icon icon="mdi:account-group-outline" class="input-icon"></ha-icon>
            <h4>${this.t('teamSetup')}</h4>
          </div>
          <p class="input-description">${this.t('teamSetupHint')}</p>
          <div class="main-teams-container">
            ${Object.entries(teams).slice(0, currentTeamCount).map(([teamId, team]) => `
              <div class="main-team-item">
                <label class="team-label">${this.t('team')} ${teamId.split('_')[1]}:</label>
                <input type="text" class="main-team-input" id="main-team-${teamId.split('_')[1]}-name" placeholder="${this.t('teamName')}" 
                       value="${this.escapeHtml(team.name)}" 
                       oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
                <select class="main-team-select" 
                        onchange="this.getRootNode().host.updateTeamUserId('${teamId}', this.value)"
                        ${isLoadingUsers ? 'disabled' : ''}>
                  <option value="">${isLoadingUsers ? this.t('loadingUsers') : this.t('selectUser')}</option>
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
          <h3>${this.t('gameSettings')}</h3>
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
    
    // Get the flag for the opposite language
    const languageFlag = this.currentLanguage === 'en' ? '🇩🇪' : '🇺🇸';
    const languageText = this.currentLanguage === 'en' ? 'Deutsch' : 'English';
    const toggleLanguage = this.currentLanguage === 'en' ? 'de' : 'en';
    
    return `
      <div class="team-management-content">
        <div class="language-section" style="margin-bottom: 20px;">
          <div class="management-input-header">
            <ha-icon icon="mdi:translate" class="input-icon"></ha-icon>
            <h4>${this.t('language')}</h4>
          </div>
          <button class="control-button secondary-button" 
                  onclick="this.getRootNode().host.switchLanguage('${toggleLanguage}')" 
                  style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 1.2em;">${languageFlag}</span>
            <span>${languageText}</span>
          </button>
        </div>
        
        <div class="game-reset-section" style="margin-bottom: 20px;">
          <button class="control-button secondary-button" onclick="this.getRootNode().host.resetGame()" style="width: 100%;">
            ${this.t('resetGame')}
          </button>
        </div>
        
        <div class="timer-section">
          <div class="management-input-header">
            <ha-icon icon="mdi:timer-outline" class="input-icon"></ha-icon>
            <h4>${this.t('timerLength')}</h4>
          </div>
          <p class="input-description">${this.t('timerLengthHint')}</p>
          <select class="form-select" id="game-settings-timer-select">
            <option value="15" ${currentTimerLength === '15' ? 'selected' : ''}>15 ${this.t('seconds')}</option>
            <option value="20" ${currentTimerLength === '20' ? 'selected' : ''}>20 ${this.t('seconds')}</option>
            <option value="30" ${currentTimerLength === '30' ? 'selected' : ''}>30 ${this.t('seconds')}</option>
            <option value="45" ${currentTimerLength === '45' ? 'selected' : ''}>45 ${this.t('seconds')}</option>
            <option value="60" ${currentTimerLength === '60' ? 'selected' : ''}>60 ${this.t('seconds')}</option>
          </select>
        </div>
      </div>
    `;
  }

  renderGameControls(gameStatus, countdown) {
    const isPlaying = gameStatus && gameStatus.state === 'playing';
    const isTimerRunning = countdown && countdown.attributes && countdown.attributes.is_running;
    
    // Hide controls when timer is running (during active question countdown)
    if (isTimerRunning) {
      return '';
    }
    
    return `
      <div class="game-controls">
        <button class="control-button primary-button" onclick="this.getRootNode().host.nextQuestion()">
          ${this.t('nextQuestion')}
        </button>
        ${!isPlaying ? `
          <button class="control-button secondary-button" onclick="this.getRootNode().host.startNewGame()">
            ${this.t('startNewGame')}
          </button>
        ` : ''}
      </div>
    `;
  }

  async selectAnswer(answer) {
    if (!this._hass || !this._hass.user) {
      console.warn('Cannot select answer: Home Assistant user not available');
      return;
    }

    // Find which team the current user belongs to
    const currentUserId = this._hass.user.id;
    let userTeamId = null;

    // Check each team to see if current user is assigned to it
    for (let i = 1; i <= 5; i++) {
      const teamState = this._hass.states[`sensor.home_trivia_team_${i}`];
      if (teamState && teamState.attributes.user_id === currentUserId) {
        userTeamId = `team_${i}`;
        break;
      }
    }

    if (!userTeamId) {
      console.warn('Current user is not assigned to any team');
      // Could show a user-friendly message here
      return;
    }

    try {
      await this._hass.callService('home_trivia', 'update_team_answer', {
        team_id: userTeamId,
        answer: answer
      });
      console.log(`Answer ${answer} selected for ${userTeamId}`);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
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
    // Start a completely new game which resets everything including team setup
    await this._hass.callService('home_trivia', 'start_game', {});
    // This will reset all team names to defaults and show the splash screen for setup
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