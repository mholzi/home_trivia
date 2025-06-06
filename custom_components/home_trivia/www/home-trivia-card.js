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

  shouldShowSplashScreen() {
    const hass = this._hass;
    if (!hass) return true;

    // Check if we have minimum required data
    const gameStatus = hass.states['sensor.home_trivia_game_status'];
    const team1 = hass.states['sensor.home_trivia_team_1'];
    
    if (!gameStatus || !team1) return true;

    // Check if teams have names
    for (let i = 1; i <= 5; i++) {
      const team = hass.states[`sensor.home_trivia_team_${i}`];
      if (team && team.attributes.participating && team.state === `Team ${i}`) {
        return true; // Default name detected, show splash
      }
    }

    return false;
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
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
        
        .splash-floating-notes {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: 1;
        }
        
        .note {
          position: absolute;
          font-size: 2em;
          color: rgba(255, 255, 255, 0.3);
          animation: float 6s ease-in-out infinite;
        }
        
        .note-1 { top: 10%; left: 10%; animation-delay: 0s; }
        .note-2 { top: 20%; right: 15%; animation-delay: 1s; }
        .note-3 { top: 60%; left: 20%; animation-delay: 2s; }
        .note-4 { top: 70%; right: 10%; animation-delay: 3s; }
        .note-5 { top: 40%; left: 50%; animation-delay: 4s; }
        
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
            opacity: 0.3;
          }
          50% { 
            transform: translateY(-20px) rotate(10deg); 
            opacity: 0.6;
          }
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
          background: rgba(255, 255, 255, 0.9);
          color: var(--primary-text-color);
          font-size: 16px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        
        .form-select:focus, .splash-team-input:focus, .splash-team-select:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.8);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.95);
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
        }
      </style>

      <div class="splash-screen">
        <div class="splash-floating-notes">
          <div class="note note-1">🎵</div>
          <div class="note note-2">🎼</div>
          <div class="note note-3">🎯</div>
          <div class="note note-4">🧠</div>
          <div class="note note-5">⚙️</div>
        </div>
        
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
        
        <div class="splash-start-section">
          <button class="splash-start-button ready" onclick="this.getRootNode().host.startGame()">
            🚀 Launch Game
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    this.shadowRoot.getElementById('difficulty-select')?.addEventListener('change', (e) => {
      this.updateDifficultyDescription(e.target.value);
      // Persist difficulty level immediately
      this.debouncedServiceCall('difficulty_level', () => {
        this._hass.callService('home_trivia', 'update_difficulty_level', {
          difficulty_level: e.target.value
        });
      }, 100);
    });

    this.shadowRoot.getElementById('timer-select')?.addEventListener('change', (e) => {
      // Persist timer length immediately
      this.debouncedServiceCall('timer_length', () => {
        this._hass.callService('home_trivia', 'update_countdown_timer_length', {
          timer_length: parseInt(e.target.value)
        });
      }, 100);
    });

    this.shadowRoot.getElementById('team-count-select')?.addEventListener('change', (e) => {
      const teamCount = parseInt(e.target.value);
      
      // Persist team count immediately
      this.debouncedServiceCall('team_count', () => {
        this._hass.callService('home_trivia', 'update_team_count', {
          team_count: teamCount
        });
      }, 100);
      
      // Update team setup display immediately
      this.updateTeamSetup(teamCount);
    });
  }

  renderSplashInputs() {
    let inputsHtml = '';

    // Get current values from Home Assistant entities
    const gameStatus = this._hass?.states['sensor.home_trivia_game_status'];
    const timerSensor = this._hass?.states['sensor.home_trivia_countdown_timer'];
    
    const currentDifficulty = gameStatus?.attributes?.difficulty_level || 'Easy';
    const currentTimerLength = timerSensor?.state || '30';
    const currentTeamCount = gameStatus?.attributes?.team_count || 2;

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

    // Timer Length Input
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:timer-outline" class="input-icon"></ha-icon>
          <h3>Timer Length</h3>
        </div>
        <p class="input-description">How long teams have to answer each question</p>
        <select class="form-select" id="timer-select">
          <option value="15" ${currentTimerLength === '15' ? 'selected' : ''}>15 seconds</option>
          <option value="20" ${currentTimerLength === '20' ? 'selected' : ''}>20 seconds</option>
          <option value="30" ${currentTimerLength === '30' ? 'selected' : ''}>30 seconds</option>
          <option value="45" ${currentTimerLength === '45' ? 'selected' : ''}>45 seconds</option>
          <option value="60" ${currentTimerLength === '60' ? 'selected' : ''}>60 seconds</option>
        </select>
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
          ${Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => `
            <div class="splash-team-item">
              <label class="team-label">Team ${teamId.split('_')[1]}:</label>
              <input type="text" class="splash-team-input" id="team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                     value="${this.escapeHtml(team.name)}" 
                     oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
              <select class="splash-team-select" 
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
    // Debounce team name updates
    this.debouncedServiceCall(`teamName_${teamId}`, () => {
      if (this._hass && name.trim()) {
        this._hass.callService('home_trivia', 'update_team_name', {
          team_id: teamId,
          name: name.trim()
        });
      }
    }, 300); // Reduced delay for more immediate persistence
  }

  updateTeamUserId(teamId, userId) {
    // Debounce team user ID updates
    this.debouncedServiceCall(`teamUserId_${teamId}`, () => {
      if (this._hass) {
        this._hass.callService('home_trivia', 'update_team_user_id', {
          team_id: teamId,
          user_id: userId || null
        });
      }
      
      // Don't trigger full re-render to avoid destroying form focus
      // The service call will update the entity state automatically
    });
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
      
      splashTeamsContainer.innerHTML = Object.entries(teams).slice(0, teamCount).map(([teamId, team]) => `
        <div class="splash-team-item">
          <label class="team-label">Team ${teamId.split('_')[1]}:</label>
          <input type="text" class="splash-team-input" id="team-${teamId.split('_')[1]}-name" placeholder="Team Name" 
                 value="${this.escapeHtml(team.name)}" 
                 oninput="this.getRootNode().host.updateTeamName('${teamId}', this.value)">
          <select class="splash-team-select" 
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

  async startGame() {
    const difficulty = this.shadowRoot.getElementById('difficulty-select')?.value || 'Easy';
    const timerLength = parseInt(this.shadowRoot.getElementById('timer-select')?.value || '30');
    
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
        .score-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 600px) {
          .score-section {
            grid-template-columns: 1fr;
            gap: 15px;
          }
        }
        .highscore-panel {
          border: 2px solid var(--primary-color);
          border-radius: 8px;
          padding: 15px;
          background: var(--card-background-color, white);
        }
        .team-scores-panel {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 15px;
          background: var(--card-background-color, white);
        }
        .panel-title {
          font-weight: bold;
          font-size: 1.2em;
          margin-bottom: 10px;
          color: var(--primary-text-color);
          text-align: center;
        }
        .highscore-content {
          text-align: center;
        }
        .highscore-team {
          font-size: 1.1em;
          font-weight: bold;
          color: var(--primary-color);
          margin-bottom: 5px;
        }
        .highscore-average {
          font-size: 1.4em;
          font-weight: bold;
          color: var(--success-color, green);
          margin-bottom: 5px;
        }
        .highscore-details {
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        .team-score-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color);
        }
        .team-score-item:last-child {
          border-bottom: none;
        }
        .team-score-name {
          font-weight: bold;
          color: var(--primary-text-color);
        }
        .team-score-average {
          font-weight: bold;
          color: var(--primary-color);
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
      </style>
      
      <div class="game-container">
        <div class="game-header">
          <div class="game-title">🎯 Home Trivia</div>
          <div class="game-status">${gameStatus ? gameStatus.state : 'Loading...'}</div>
        </div>
        
        <div class="game-content">
          ${this.renderQuestionSection(currentQuestion, countdown)}
          ${this.renderScoreSection()}
          ${this.renderGameControls(gameStatus)}
        </div>
      </div>
    `;
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

  renderScoreSection() {
    const highscoreSensor = this._hass.states['sensor.home_trivia_highscore'];
    const roundCounter = this._hass.states['sensor.home_trivia_round_counter'];
    
    const currentRound = roundCounter ? parseInt(roundCounter.state) : 0;
    
    // Left side: Global Highscore (always visible)
    let highscoreHtml = '<div class="highscore-content">';
    if (highscoreSensor && highscoreSensor.attributes && highscoreSensor.attributes.team_name !== "No Team") {
      const avgPoints = highscoreSensor.attributes.average_points || 0;
      const totalPoints = highscoreSensor.attributes.total_points || 0;
      const totalRounds = highscoreSensor.attributes.total_rounds || 0;
      const teamName = highscoreSensor.attributes.team_name || "Unknown Team";
      
      highscoreHtml += `
        <div class="highscore-team">🏆 ${this.escapeHtml(teamName)}</div>
        <div class="highscore-average">${avgPoints.toFixed(1)} pts/round</div>
        <div class="highscore-details">${totalPoints} pts in ${totalRounds} rounds</div>
      `;
    } else {
      highscoreHtml += `
        <div class="highscore-team">🏆 No Record Yet</div>
        <div class="highscore-average">0.0 pts/round</div>
        <div class="highscore-details">Play a round to set the first record!</div>
      `;
    }
    highscoreHtml += '</div>';
    
    // Right side: Team averages (only after round 1)
    let teamScoresHtml = '';
    if (currentRound > 0) {
      teamScoresHtml += '<div class="team-scores-content">';
      
      for (let i = 1; i <= 5; i++) {
        const team = this._hass.states[`sensor.home_trivia_team_${i}`];
        if (!team || !team.attributes || !team.attributes.participating) continue;
        
        const points = team.attributes.points || 0;
        const average = currentRound > 0 ? (points / currentRound).toFixed(1) : '0.0';
        const teamName = team.state || `Team ${i}`;
        
        teamScoresHtml += `
          <div class="team-score-item">
            <span class="team-score-name">${this.escapeHtml(teamName)}</span>
            <span class="team-score-average">${average} pts/round</span>
          </div>
        `;
      }
      
      teamScoresHtml += '</div>';
    } else {
      teamScoresHtml += `
        <div class="team-scores-content" style="text-align: center; color: var(--secondary-text-color);">
          Team averages will appear after the first round
        </div>
      `;
    }
    
    return `
      <div class="score-section">
        <div class="highscore-panel">
          <div class="panel-title">🏆 All-Time Highscore</div>
          ${highscoreHtml}
        </div>
        <div class="team-scores-panel">
          <div class="panel-title">📊 Current Game Averages</div>
          ${teamScoresHtml}
        </div>
      </div>
      <div class="teams-grid">
        ${this.renderTeamsSection()}
      </div>
    `;
  }

  renderTeamsSection() {
    let html = '';
    
    for (let i = 1; i <= 5; i++) {
      const team = this._hass.states[`sensor.home_trivia_team_${i}`];
      if (!team || !team.attributes || !team.attributes.participating) continue;

      const answered = team.attributes.answered || false;
      const answer = team.attributes.answer || '';
      const points = team.attributes.points || 0;
      const teamName = team.state || `Team ${i}`;

      html += `
        <div class="team-card">
          <div class="team-name">${this.escapeHtml(teamName)}</div>
          <div class="team-points">${points} points</div>
          <div class="team-answer ${answered ? 'team-answered' : 'team-not-answered'}">
            ${answered ? `Answer: ${this.escapeHtml(answer)}` : 'Not answered'}
          </div>
        </div>
      `;
    }
    
    return html;
  }

  renderGameControls(gameStatus) {
    const isPlaying = gameStatus && gameStatus.state === 'playing';
    
    return `
      <div class="game-controls">
        <button class="control-button primary-button" onclick="this.getRootNode().host.nextQuestion()">
          ▶️ Next Question
        </button>
        ${isPlaying ? `
          <button class="control-button secondary-button" onclick="this.getRootNode().host.stopGame()">
            ⏹️ Stop Game
          </button>
        ` : `
          <button class="control-button secondary-button" onclick="this.getRootNode().host.startGame()">
            🚀 Start Game
          </button>
        `}
        <button class="control-button secondary-button" onclick="this.getRootNode().host.resetGame()">
          🔄 Reset Game
        </button>
      </div>
    `;
  }

  async selectAnswer(answer) {
    // This method would typically be called from team-specific UI
    // For now, just mark all participating teams as having selected this answer
    // In a real implementation, this would be per-team
    
    const currentQuestion = this._hass.states['sensor.home_trivia_current_question'];
    const countdown = this._hass.states['sensor.home_trivia_countdown_current'];
    
    if (!currentQuestion || !currentQuestion.attributes.question) {
      console.log('No active question');
      return;
    }
    
    const correctAnswer = currentQuestion.attributes.correct_answer;
    const isCorrect = answer === correctAnswer;
    const timeLeft = countdown ? parseInt(countdown.state) : 0;
    
    // Calculate points: 10 base points + time bonus if correct
    const basePoints = 10;
    const timeBonus = isCorrect ? timeLeft : 0;
    const totalPoints = basePoints + timeBonus;
    
    // For now, award points to the first participating team that hasn't answered
    // In a real implementation, this would be team-specific
    for (let i = 1; i <= 5; i++) {
      const team = this._hass.states[`sensor.home_trivia_team_${i}`];
      if (!team || !team.attributes.participating || team.attributes.answered) continue;
      
      // Mark team as answered
      await this._hass.callService('home_trivia', 'update_team_answer', {
        team_id: `team_${i}`,
        answer: answer
      });
      
      // Award points if correct
      if (isCorrect) {
        await this._hass.callService('home_trivia', 'award_points', {
          team_id: `team_${i}`,
          points: totalPoints
        });
        
        console.log(`Team ${i} answered correctly! Awarded ${totalPoints} points (${basePoints} base + ${timeBonus} time bonus)`);
      } else {
        console.log(`Team ${i} answered incorrectly.`);
      }
      
      break; // Only handle the first team for now
    }
  }

  async nextQuestion() {
    // Complete the current round first (if there was a question)
    const currentQuestion = this._hass.states['sensor.home_trivia_current_question'];
    if (currentQuestion && currentQuestion.attributes && currentQuestion.attributes.question) {
      await this._hass.callService('home_trivia', 'complete_round', {});
      
      // Small delay to allow state updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reset team answers for the next question
      for (let i = 1; i <= 5; i++) {
        const team = this._hass.states[`sensor.home_trivia_team_${i}`];
        if (team && team.attributes && team.attributes.participating) {
          await this._hass.callService('home_trivia', 'update_team_answer', {
            team_id: `team_${i}`,
            answer: null
          });
        }
      }
      
      // Another small delay before moving to next question
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Move to the next question
    await this._hass.callService('home_trivia', 'next_question', {});
  }

  async stopGame() {
    await this._hass.callService('home_trivia', 'stop_game', {});
  }

  async resetGame() {
    await this._hass.callService('home_trivia', 'reset_game', {});
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