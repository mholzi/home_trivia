# 🎯 Home Trivia

**The ultimate knowledge competition game for Home Assistant!**

Transform your smart home into a fun trivia battleground where friends and family can compete in an exciting quiz game. Home Trivia brings the excitement of game shows right to your Home Assistant dashboard!

## 🎉 Release Notes - v1.0.0 (First Official Release!)

**Welcome to the first official release of Home Trivia!** 🎊

This milestone release brings you a complete, ready-to-use trivia game for your Home Assistant setup. Everything you need is included out-of-the-box:

✅ **Zero Setup Required** - Just install and play! No YAML editing, no manual configurations  
✅ **Lovelace Card Included** - Beautiful UI card automatically available after installation  
✅ **Mobile Optimized** - Perfect for party gaming on phones and tablets with QR code for easy access  
✅ **Multiple Difficulty Levels** - From kids to intellectuals, everyone can play  
✅ **Team Competition** - Support for up to 5 teams with custom or default names  
✅ **Smart Scoring** - Base points plus speed bonuses keep games exciting  
✅ **Persistent Settings** - Your game preferences are automatically saved and restored with optimistic UI updates  
✅ **Animated Progress Bar** - Smooth visual countdown with live timer updates and dynamic color transitions  

**Getting Started is Simple:**
1. Install via HACS or manually
2. Add the integration in Home Assistant settings
3. Add the card to your dashboard with: `type: custom:home-trivia-card`
4. Start playing immediately!

*No technical expertise needed - if you can install Home Assistant integrations, you can run Home Trivia!*

## 🚀 Enhanced User Experience

**Optimistic UI for Seamless Setup:** Home Trivia now features a responsive, intuitive interface that provides immediate feedback during configuration. When you make changes to game settings like difficulty level, timer duration, or team setup, your selections are instantly reflected in the UI and maintained while the backend processes your changes.

**Key UI Improvements:**
- **Instant Response** - Dropdowns and inputs respond immediately to your selections
- **No Input Reverting** - Your choices stay locked in while being saved to Home Assistant
- **Smart Re-rendering** - The interface only updates when necessary, preserving your active editing sessions
- **Persistent Form State** - Partially completed configurations are maintained even if the backend is busy

This means you can configure your entire trivia game setup smoothly in one session, without frustrating input reversions or having to re-enter the same information multiple times.

**Enhanced Team 1 Owner Controls:** The owner of Team 1 now has access to exclusive Game Settings during gameplay, providing streamlined controls for timer adjustments and game management without cluttering the interface for regular players.

## ✨ Features

### 🎮 **Multiple Difficulty Levels**
- **🧒 Kids Level** - Perfect for curious minds around 10 years old
- **🎓 Easy Level** - A-level knowledge for school topics  
- **🏛️ Medium Level** - University-level challenges
- **🧠 Hard Level** - University-level knowledge for true intellectuals

### 👥 **Team Competition** 
- Support for 1-5 teams with custom or default names
- Real-time scoring with speed bonuses
- Visual feedback when teams answer
- Comprehensive team management

### ⏱️ **Smart Timing System**
- Configurable countdown timer (10-120 seconds)
- **Automatic countdown** - Timer decreases live every second
- **Visual progress bar** - Smooth animated progress bar shows time remaining at a glance
- **Dynamic visual feedback** - Progress bar changes from green to blue normally, orange for warnings, red pulsing when time is up
- **Smooth animations** - CSS transitions provide fluid, non-jerky countdown experience 
- Speed bonus points based on remaining time
- Automatic progression and round management
- **No manual setup needed** - Timer and progress bar work automatically when integration is installed

### 🏆 **Advanced Scoring**
- **Automated Points Logic**: Scoring runs automatically when rounds end (no user setup needed)
- **Base Points**: 10 points for correct answers
- **Speed Bonus**: Extra points for quick responses (remaining seconds on timer)
- **Round Results Tracking**: Detailed round-by-round answer history and correctness
- **High Score Tracking**: Both total points and average per round with automatic updates
- **Answer Reset**: Team answers automatically cleared for next round

### 🎨 **Beautiful Interface**
- Modern, responsive Lovelace card
- Mobile-friendly design with QR code for easy device access
- Intuitive splash screen for easy setup
- **Live countdown timer** with automatic updates every second
- **Animated progress bar** - Smooth visual countdown with gradient colors and fluid transitions
- **Visual timer feedback** - Progress bar and timer change colors and animations when time runs out
- Real-time game status updates
- **Team 1 Owner Game Settings** - Dedicated settings panel for timer controls and game management (visible only to Team 1 owner)

## 🚀 Quick Start

**Ready to play in minutes!** Home Trivia works out-of-the-box with zero configuration needed.

### Installation via HACS (Recommended)
1. Open HACS in Home Assistant
2. Add this repository as a custom repository
3. Install "Home Trivia" 
4. Restart Home Assistant
5. Add the integration via Settings → Integrations
6. **That's it!** The Lovelace card is automatically available

### Manual Installation
1. Copy the `custom_components/home_trivia` folder to your HA config directory
2. Restart Home Assistant
3. Add the integration via Settings → Integrations
4. **Done!** Everything else is included automatically

### Adding the Card to Your Dashboard
Simply add this single line to your Lovelace dashboard:
```yaml
type: custom:home-trivia-card
```

**No additional setup required!** The card includes everything needed for immediate gameplay.

## 🎯 How to Play

2. **Start Game**: Click "Start Trivia Game" to begin
3. **Answer Questions**: Teams select A, B, or C for each question
4. **Scoring**: Get 10 base points + speed bonus for correct answers
5. **Fun Facts**: Learn something new after each question!

**🔄 Settings Persistence**: Your game configuration (difficulty, team count, timer length) is automatically saved. Next time you open Home Trivia, your preferences will be exactly as you left them!

## 🎲 Game Logic

### Question Categories
The game features 7 mandatory categories across all difficulty levels:
- **Fun Facts** - Interesting and surprising facts from various domains
- **History** - Historical events, figures, and periods  
- **Geography** - Countries, capitals, landmarks, and geographical features
- **Music** - Musicians, genres, instruments, and musical history
- **Literature** - Authors, books, poetry, and literary movements
- **Science** - Biology, chemistry, physics, and scientific discoveries
- **Politics** - Government systems, political figures, and civic knowledge

### Scoring System
- **Automated Scoring**: Points are automatically calculated and awarded when rounds end
- **Correct Answer**: 10 base points
- **Speed Bonus**: Time remaining on timer (e.g., 20 seconds left = +20 points)
- **Round Completion**: Scoring triggers when "Next Question" is pressed or timer expires
- **Answer Reset**: Team answers are automatically cleared for the next round
- **High Scores**: Tracked by average points per round with automatic updates

### Team Features
- Custom or default team names
- Real-time answer tracking
- Visual indication of answered teams
- Points history and statistics

## 🤖 Automated Scoring System

**Zero-Setup Required!** Home Trivia features a fully automated scoring system that works seamlessly in the background:

### 🎯 **How It Works**
- **Round End Detection**: Scoring automatically triggers when "Next Question" is pressed or timer expires
- **Answer Comparison**: Each participating team's answer is compared to the correct answer from the current question
- **Point Calculation**: 
  - ✅ **Correct Answer**: 10 base points + speed bonus (remaining seconds on timer)
  - ❌ **Incorrect/Missing**: 0 points
- **Speed Bonus**: Rewards quick thinking with extra points equal to remaining timer seconds
- **Automatic Updates**: Team points and round results update instantly

### 📊 **Detailed Tracking**
Each team entity automatically maintains:
- **Current Points**: Running total updated after each round
- **Last Round Results**: Answer given, correctness, and points earned
- **Round History**: Complete record of performance for transparency

### 🔄 **Round Management**
- **Answer Reset**: Team answers automatically cleared for next round
- **Round Counter**: Increments automatically to track game progress  
- **High Score Updates**: Best scores updated automatically based on average points per round

**No manual intervention needed!** The system runs entirely in the backend Python integration, providing a seamless experience for all players.

## 🔧 Configuration

The integration supports configuration through the UI with **automatic persistent storage**:

### 🔄 Persistent Settings (New in v1.0.0!)
All game setup parameters are **automatically saved** and restored across Home Assistant restarts:
- **Difficulty Level**: Choose question complexity - *setting is remembered*
- **Team Count**: 1-5 participating teams - *setting is remembered*  
- **Timer Length**: 10-120 seconds per question - *setting is remembered* (configurable via Team 1 Owner Game Settings)
- **Team Names**: Custom or default names for each team - *names are remembered*

**No manual configuration required!** Simply set your preferences once on the splash screen, and they'll be automatically restored every time you use Home Trivia, even after Home Assistant restarts or reloads.

### ⚙️ Admin Game Settings (New!)
The owner of **Team 1** has access to an exclusive **Game Settings** section that includes:
- **Timer Length Control**: Adjust question timer from 15-60 seconds during gameplay
- **Reset Game**: Convenient reset button to restart the entire game session
- **Team 1 Owner Access**: Only visible to the user assigned to Team 1

**Admin Rights**: Admin privileges are determined by Team 1 ownership. Whoever is assigned as the user for Team 1 becomes the game administrator with access to exclusive settings and controls.

The Game Settings section provides streamlined game management tools while keeping the interface clean for regular players.

### Configuration Options
- **Difficulty Levels**: Kids, Easy, Medium, Hard
- **Team Count**: 1 to 5 teams maximum
- **Timer Range**: 10 to 120 seconds per question
- **Automatic Countdown**: Timer decrements live every second with visual feedback
- **Team Customization**: Custom or default names and participation status

### 🔥 Live Timer Features
The countdown timer now works **automatically** with no setup required:
- **Real-time countdown**: Decrements every second and updates the UI live
- **Animated progress bar**: Smooth visual progress indicator with CSS transitions
- **Dynamic colors**: Progress bar transitions from green to blue, orange for warnings, red when time expires
- **Visual feedback**: Orange warning at ≤5 seconds, red pulsing animation when time is up
- **Fluid animations**: Non-jerky, smooth countdown experience with 0.8-second transition timing
- **Smart cleanup**: Automatically stops when games start/stop or when timer reaches zero
- **Non-blocking**: Uses Home Assistant's async framework for smooth performance

## 🎮 Services

Home Trivia exposes several services for automation:
- `home_trivia.start_game` - Start a new game
- `home_trivia.stop_game` - Stop current game (available for automation, UI button removed for cleaner interface)
- `home_trivia.next_question` - Move to next question
- `home_trivia.update_team_answer` - Submit team answer
- `home_trivia.update_difficulty_level` - Change difficulty

## 📊 Entity Overview

### Main Sensors
- `sensor.home_trivia_game_status` - Current game state
- `sensor.home_trivia_current_question` - Active question details
- `sensor.home_trivia_countdown_current` - **Live countdown timer** (auto-decrements every second)
- `sensor.home_trivia_countdown_timer` - Timer length configuration

### Team Sensors (1-5)
- `sensor.home_trivia_team_X` - Team information and stats
- **Attributes**: points, answer, answered status, participation, user_id
- **Round Results**: last_round_answer, last_round_correct, last_round_points
- **Automated Updates**: Points and round results update automatically when rounds end

### Game Management
- `sensor.home_trivia_round_counter` - Current round number
- `sensor.home_trivia_highscore` - Best scores tracking
- `sensor.home_trivia_played_questions` - Question history

## 🏗️ Architecture

Built on the solid foundation of modern Home Assistant practices:
- **Zero-Setup Philosophy** - Works out of the box
- **Bundled Lovelace Card** - No manual configuration needed
- **State Restoration** - Survives HA restarts
- **Mobile Optimized** - Perfect for party gaming

## 🤝 Contributing

We welcome contributions! Whether it's:
- 📝 Adding new questions
- 🐛 Bug fixes and improvements  
- 🎨 UI enhancements
- 📚 Documentation updates

## 📄 License

MIT License - Feel free to use and modify!

---

**Made with ❤️ for the Home Assistant community**

*Transform your home into the ultimate trivia arena!*
