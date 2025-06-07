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
✅ **Team Competition** - Support for up to 5 teams with custom names  
✅ **Smart Scoring** - Base points plus speed bonuses keep games exciting  
✅ **Persistent Settings** - Your game preferences are automatically saved and restored  

**Getting Started is Simple:**
1. Install via HACS or manually
2. Add the integration in Home Assistant settings
3. Add the card to your dashboard with: `type: custom:home-trivia-card`
4. Start playing immediately!

*No technical expertise needed - if you can install Home Assistant integrations, you can run Home Trivia!*

## ✨ Features

### 🎮 **Multiple Difficulty Levels**
- **🧒 Kids Level** - Perfect for curious minds around 10 years old
- **🎓 Easy Level** - A-level knowledge for school topics  
- **🏛️ Medium Level** - University-level challenges
- **🧠 Hard Level** - University-level knowledge for true intellectuals

### 👥 **Team Competition** 
- Support for 1-5 teams with custom names
- Real-time scoring with speed bonuses
- Visual feedback when teams answer
- Comprehensive team management

### ⏱️ **Smart Timing System**
- Configurable countdown timer (10-120 seconds)
- Speed bonus points based on remaining time
- Automatic progression and round management

### 🏆 **Advanced Scoring**
- **Base Points**: 10 points for correct answers
- **Speed Bonus**: Extra points for quick responses
- **High Score Tracking**: Both total points and average per round
- **Round-by-round Statistics**

### 🎨 **Beautiful Interface**
- Modern, responsive Lovelace card
- Mobile-friendly design with QR code for easy device access
- Intuitive splash screen for easy setup
- Real-time game status updates

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

1. **Setup**: Configure teams, difficulty, and timer in the splash screen *(settings automatically saved)*
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
- **Correct Answer**: 10 base points
- **Speed Bonus**: Time remaining on timer (e.g., 20 seconds left = +20 points)
- **High Scores**: Tracked by average points per round

### Team Features
- Custom team names
- Real-time answer tracking
- Visual indication of answered teams
- Points history and statistics

## 🔧 Configuration

The integration supports configuration through the UI with **automatic persistent storage**:

### 🔄 Persistent Settings (New in v1.0.0!)
All game setup parameters are **automatically saved** and restored across Home Assistant restarts:
- **Difficulty Level**: Choose question complexity - *setting is remembered*
- **Team Count**: 1-5 participating teams - *setting is remembered*  
- **Timer Length**: 10-120 seconds per question - *setting is remembered*
- **Team Names**: Custom names for each team - *names are remembered*

**No manual configuration required!** Simply set your preferences once on the splash screen, and they'll be automatically restored every time you use Home Trivia, even after Home Assistant restarts or reloads.

### Configuration Options
- **Difficulty Levels**: Kids, Easy, Medium, Hard
- **Team Count**: 1 to 5 teams maximum
- **Timer Range**: 10 to 120 seconds per question
- **Team Customization**: Custom names and participation status

## 🎮 Services

Home Trivia exposes several services for automation:
- `home_trivia.start_game` - Start a new game
- `home_trivia.stop_game` - Stop current game  
- `home_trivia.next_question` - Move to next question
- `home_trivia.update_team_answer` - Submit team answer
- `home_trivia.update_difficulty_level` - Change difficulty

## 📊 Entity Overview

### Main Sensors
- `sensor.home_trivia_game_status` - Current game state
- `sensor.home_trivia_current_question` - Active question details
- `sensor.home_trivia_countdown_current` - Timer countdown

### Team Sensors (1-5)
- `sensor.home_trivia_team_X` - Team information and stats
- Attributes: points, answer, answered status, participation

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
