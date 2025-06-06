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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        
        .splash-title {
          font-size: 2.5em;
          font-weight: bold;
          margin-bottom: 16px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .splash-subtitle {
          font-size: 1.2em;
          margin-bottom: 20px;
          opacity: 0.9;
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
        }
        
        .setup-message h2 {
          margin: 0 0 8px 0;
          font-size: 1.5em;
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
        }
        
        .form-select:focus, .splash-team-input:focus, .splash-team-select:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.8);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
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
        }
        
        .splash-start-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.8);
          transform: translateY(-2px);
        }
        
        .splash-start-button.ready {
          background: rgba(76, 175, 80, 0.8);
          border-color: rgba(76, 175, 80, 1);
        }
        
        .splash-start-button.ready:hover {
          background: rgba(76, 175, 80, 1);
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
          }
          
          .team-label {
            text-align: center;
          }
        }
      </style>
      
      <div class="splash-screen">
        <div class="splash-floating-notes">
          <div class="note note-1">🎯</div>
          <div class="note note-2">🧠</div>
          <div class="note note-3">💡</div>
          <div class="note note-4">❓</div>
          <div class="note note-5">🏆</div>
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
    });

    this.shadowRoot.getElementById('team-count-select')?.addEventListener('change', (e) => {
      this.updateTeamSetup(parseInt(e.target.value));
    });
  }

  renderSplashInputs() {
    let inputsHtml = '';

    // Difficulty Level Input
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:school" class="input-icon"></ha-icon>
          <h3>Difficulty Level</h3>
        </div>
        <p class="input-description">Choose the difficulty level for your trivia questions</p>
        <select class="form-select" id="difficulty-select">
          <option value="Kids">🧒 Kids Level</option>
          <option value="Easy" selected>🎓 Easy Level</option>
          <option value="Medium">🏛️ Medium Level</option>
          <option value="Difficult">🧠 Difficult Level</option>
        </select>
        <div class="difficulty-description" id="difficulty-description" style="margin-top: 8px; opacity: 0.8; font-style: italic;">
          Great for testing what you learned in school with questions about geography, basic science, and history.
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
          <option value="15">15 seconds</option>
          <option value="20">20 seconds</option>
          <option value="30" selected>30 seconds</option>
          <option value="45">45 seconds</option>
          <option value="60">60 seconds</option>
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
          <option value="1">1 Team</option>
          <option value="2" selected>2 Teams</option>
          <option value="3">3 Teams</option>
          <option value="4">4 Teams</option>
          <option value="5">5 Teams</option>
        </select>
      </div>
    `;

    // Team Setup (always show with user dropdowns)
    const teams = this.getTeams();
    const users = this.homeAssistantUsers || [];
    const isLoadingUsers = this._isLoadingUsers || (!this.usersLoaded && users.length === 0);
    
    inputsHtml += `
      <div class="splash-input-section">
        <div class="splash-input-header">
          <ha-icon icon="mdi:account-group-outline" class="input-icon"></ha-icon>
          <h3>Team Setup</h3>
        </div>
        <p class="input-description">Assign names and users to your teams</p>
        <div class="splash-teams-container">
          ${Object.entries(teams).slice(0, 2).map(([teamId, team]) => `
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
        // Re-render if we're showing splash screen
        if (this.shouldShowSplashScreen()) {
          this.requestUpdate();
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
    }, 500); // Longer delay for text input
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
      
      // Trigger immediate UI refresh to reflect the change
      setTimeout(() => {
        if (this.shouldShowSplashScreen()) {
          this.requestUpdate();
        }
      }, 100);
    });
  }

  updateDifficultyDescription(difficulty) {
    const descriptions = {
      'Kids': 'Perfect for curious minds around 10 years old! Fun questions about animals, colors, and basic facts.',
      'Easy': 'Great for testing what you learned in school with questions about geography, basic science, and history.',
      'Medium': 'University-level challenges! Dive deeper into literature, advanced science, and complex historical facts.',
      'Difficult': 'For true intellectuals! Mind-bending questions about philosophy, advanced mathematics, and physics.'
    };
    
    const descElement = this.shadowRoot.getElementById('difficulty-description');
    if (descElement) {
      descElement.textContent = descriptions[difficulty] || '';
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
    
    // Update team participation status
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
    const teamCount = parseInt(this.shadowRoot.getElementById('team-count-select')?.value || '2');

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

    this.debouncedServiceCall('startGame_teamCount', () => {
      this._hass.callService('home_trivia', 'update_team_count', {
        team_count: teamCount
      });
    }, 200);

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
      </style>
      
      <div class="game-container">
        <div class="game-header">
          <div class="game-title">🎯 Home Trivia</div>
          <div class="game-status">${gameStatus ? gameStatus.state : 'Loading...'}</div>
        </div>
        
        <div class="game-content">
          ${this.renderQuestionSection(currentQuestion, countdown)}
          ${this.renderTeamsSection()}
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