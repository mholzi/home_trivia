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

    if (this.shouldShowSplashScreen()) {
      this.renderSplashScreen();
    } else {
      this.renderMainGame();
    }
  }

  renderSplashScreen() {
    this.shadowRoot.innerHTML = `
      <style>
        .splash-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          font-family: var(--ha-card-header-font-family, inherit);
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
          box-shadow: var(--ha-card-box-shadow, var(--paper-material-elevation-1_-_box-shadow));
        }
        .splash-title {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 20px;
          color: var(--primary-text-color);
          text-align: center;
        }
        .splash-subtitle {
          font-size: 1.2em;
          margin-bottom: 30px;
          color: var(--secondary-text-color);
          text-align: center;
        }
        .form-group {
          width: 100%;
          max-width: 400px;
          margin-bottom: 20px;
        }
        .form-label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: var(--primary-text-color);
        }
        .form-input, .form-select {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 16px;
          box-sizing: border-box;
        }
        .team-setup {
          width: 100%;
          max-width: 500px;
          margin-bottom: 20px;
        }
        .team-row {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          gap: 10px;
        }
        .team-checkbox {
          margin-right: 10px;
        }
        .team-name-input {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
        }
        .start-button {
          padding: 15px 30px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 20px;
        }
        .start-button:hover {
          background: var(--primary-color-dark, var(--primary-color));
        }
        .difficulty-description {
          font-size: 0.9em;
          color: var(--secondary-text-color);
          margin-top: 5px;
          font-style: italic;
        }
      </style>
      <div class="splash-container">
        <div class="splash-title">🎯 Home Trivia</div>
        <div class="splash-subtitle">Set up your trivia game</div>
        
        <div class="form-group">
          <label class="form-label">Difficulty Level</label>
          <select class="form-select" id="difficulty-select">
            <option value="Kids">🧒 Kids Level</option>
            <option value="Easy" selected>🎓 Easy Level</option>
            <option value="Medium">🏛️ Medium Level</option>
            <option value="Difficult">🧠 Difficult Level</option>
          </select>
          <div class="difficulty-description" id="difficulty-description">
            Great for testing what you learned in school with questions about geography, basic science, and history.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Timer Length</label>
          <select class="form-select" id="timer-select">
            <option value="15">15 seconds</option>
            <option value="20">20 seconds</option>
            <option value="30" selected>30 seconds</option>
            <option value="45">45 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Number of Teams</label>
          <select class="form-select" id="team-count-select">
            <option value="1">1 Team</option>
            <option value="2" selected>2 Teams</option>
            <option value="3">3 Teams</option>
            <option value="4">4 Teams</option>
            <option value="5">5 Teams</option>
          </select>
        </div>

        <div class="team-setup" id="team-setup">
          <label class="form-label">Team Names</label>
          ${this.renderTeamSetup()}
        </div>

        <button class="start-button" onclick="this.getRootNode().host.startGame()">
          🚀 Start Trivia Game
        </button>
      </div>
    `;

    // Add event listeners
    this.shadowRoot.getElementById('difficulty-select').addEventListener('change', (e) => {
      this.updateDifficultyDescription(e.target.value);
    });

    this.shadowRoot.getElementById('team-count-select').addEventListener('change', (e) => {
      this.updateTeamSetup(parseInt(e.target.value));
    });
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
    for (let i = 1; i <= 5; i++) {
      const checkbox = this.shadowRoot.getElementById(`team-${i}-enabled`);
      const input = this.shadowRoot.getElementById(`team-${i}-name`);
      
      if (i <= teamCount) {
        checkbox.checked = true;
        checkbox.disabled = false;
        input.disabled = false;
      } else {
        checkbox.checked = false;
        checkbox.disabled = true;
        input.disabled = true;
      }
    }
  }

  async startGame() {
    const difficulty = this.shadowRoot.getElementById('difficulty-select').value;
    const timerLength = parseInt(this.shadowRoot.getElementById('timer-select').value);
    const teamCount = parseInt(this.shadowRoot.getElementById('team-count-select').value);

    // Update game settings
    await this._hass.callService('home_trivia', 'update_difficulty_level', {
      difficulty_level: difficulty
    });

    await this._hass.callService('home_trivia', 'update_countdown_timer_length', {
      timer_length: timerLength
    });

    await this._hass.callService('home_trivia', 'update_team_count', {
      team_count: teamCount
    });

    // Update team names
    for (let i = 1; i <= teamCount; i++) {
      const nameInput = this.shadowRoot.getElementById(`team-${i}-name`);
      if (nameInput && nameInput.value) {
        await this._hass.callService('home_trivia', 'update_team_name', {
          team_id: `team_${i}`,
          name: nameInput.value
        });
      }
    }

    // Start the game
    await this._hass.callService('home_trivia', 'start_game', {});
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