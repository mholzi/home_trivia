"""The Home Trivia integration."""
import json
import logging
import os
import random

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Home Trivia integration from YAML (if needed)."""
    _LOGGER.info("Setting up Home Trivia integration from YAML")
    hass.data.setdefault(DOMAIN, {})

    # Register frontend resources (card JS)
    await _register_frontend_resources(hass)

    # If user placed "home_trivia:" in configuration.yaml, import it into a config entry
    if DOMAIN in config:
        if not hass.config_entries.async_entries(DOMAIN):
            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN, context={"source": "import"}
                )
            )
    return True

async def _register_frontend_resources(hass: HomeAssistant) -> None:
    """Register the JS so that "/home_trivia_frontend_assets/home-trivia-card.js" is served."""
    www_dir = os.path.join(os.path.dirname(__file__), "www")
    card_file = os.path.join(www_dir, "home-trivia-card.js")

    if not os.path.isfile(card_file):
        _LOGGER.warning("Home Trivia card file not found at %s", card_file)
        return

    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path="/home_trivia_frontend_assets",
            path=www_dir,
            cache_headers=False
        )
    ])
    _LOGGER.info("Registered Home Trivia static path → %s", www_dir)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Home Trivia from a config entry."""
    _LOGGER.info("Setting up Home Trivia config entry %s", entry.entry_id)
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {}

    # Register frontend resources (card JS)
    await _register_frontend_resources(hass)

    # Forward to sensor platform (so sensor.py is loaded)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Create and store GameManager instance
    game_manager = GameManager(hass)
    hass.data[DOMAIN]["game_manager"] = game_manager

    # Register all game services (after entities are created)
    await _register_services(hass)
    
    # Sync persistent settings to other sensors after a short delay
    async def _sync_persistent_settings():
        """Sync persistent settings from main sensor to other sensors."""
        try:
            entities = hass.data.get(DOMAIN, {}).get("entities", {})
            main_sensor = entities.get("main_sensor")
            timer_sensor = entities.get("countdown_sensor")
            
            if main_sensor and timer_sensor:
                # Sync timer length from main sensor to timer sensor
                if hasattr(main_sensor, '_timer_length') and hasattr(timer_sensor, 'update_timer_length'):
                    timer_sensor.update_timer_length(main_sensor._timer_length)
                    _LOGGER.debug("Synced timer length from main sensor: %d", main_sensor._timer_length)
        except Exception as e:
            _LOGGER.warning("Could not sync persistent settings: %s", e)
    
    # Schedule settings sync after entities are fully loaded
    hass.async_create_task(_sync_persistent_settings())
    
    return True

async def _process_round_scoring(entities: dict) -> None:
    """Process scoring for the current round before moving to next question."""
    
    # Get the current question to check if we have a round to score
    current_question_sensor = entities.get("current_question_sensor")
    if not current_question_sensor or not hasattr(current_question_sensor, '_current_question'):
        _LOGGER.debug("No current question found, skipping round scoring")
        return
    
    current_question = current_question_sensor._current_question
    if not current_question:
        _LOGGER.debug("No current question data, skipping round scoring")
        return
    
    correct_answer = current_question.get("correct_answer")
    category = current_question.get("category")
    if not correct_answer:
        _LOGGER.warning("No correct answer found for current question, skipping scoring")
        return
    
    _LOGGER.info("Processing round scoring for question: %s", current_question.get("question", "Unknown"))
    
    # Get team sensors and main sensor for team count
    team_sensors = entities.get("team_sensors", {})
    main_sensor = entities.get("main_sensor")
    
    # Determine participating teams
    team_count = 5  # Default to all teams
    if main_sensor and hasattr(main_sensor, '_team_count'):
        team_count = main_sensor._team_count
    
    # Process scoring for each participating team
    for i in range(1, team_count + 1):
        team_key = f"home_trivia_team_{i}"
        team_sensor = team_sensors.get(team_key)
        
        if not team_sensor:
            _LOGGER.warning("Team sensor %s not found, skipping", team_key)
            continue
            
        # Check if team is participating
        if not getattr(team_sensor, '_participating', True):
            _LOGGER.debug("Team %d not participating, skipping", i)
            continue
        
        # Get team's answer and time when they answered
        team_answer = getattr(team_sensor, '_answer', None)
        answer_time_remaining = getattr(team_sensor, '_answer_time_remaining', 0)
        _LOGGER.debug("Team %d answer: %s, correct: %s, answered with %d seconds remaining", 
                     i, team_answer, correct_answer, answer_time_remaining)
        
        # Calculate points
        points_earned = 0
        is_correct = False
        
        if team_answer and team_answer.upper() == correct_answer.upper():
            is_correct = True
            points_earned = 10 + answer_time_remaining  # 10 base points + speed bonus from when they answered
            
            # Streak bonus logic
            if hasattr(team_sensor, 'increment_streak'):
                new_streak = team_sensor.increment_streak()
                # Check if the streak is a multiple of 3 (and not zero)
                if new_streak > 0 and new_streak % 3 == 0:
                    streak_bonus = 25
                    points_earned += streak_bonus
                    _LOGGER.info("Team %d hit a %dx streak! Awarding %d bonus points.", i, new_streak, streak_bonus)
            
            _LOGGER.info("Team %d answered correctly! Earned %d points (10 base + %d speed bonus)", 
                        i, points_earned, answer_time_remaining)
            
            # Update user stats for MVP calculation
            user_id = getattr(team_sensor, '_user_id', None)
            if user_id and main_sensor and hasattr(main_sensor, 'update_user_correct_answer'):
                main_sensor.update_user_correct_answer(user_id)
        else:
            _LOGGER.info("Team %d answered incorrectly or didn't answer (answer: %s)", i, team_answer)
            # Reset streak on incorrect answer
            if hasattr(team_sensor, 'reset_streak'):
                team_sensor.reset_streak()
        
        # Update category stats for each team
        if category and hasattr(team_sensor, 'update_category_stats'):
            team_sensor.update_category_stats(category, is_correct)
        
        # Update team with round results
        if hasattr(team_sensor, 'add_points') and points_earned > 0:
            team_sensor.add_points(points_earned)
        
        if hasattr(team_sensor, 'set_last_round_result'):
            team_sensor.set_last_round_result(
                answer=team_answer or "No Answer",
                correct=is_correct, 
                points=points_earned
            )
        
        # Reset team answer and answered status for next round
        if hasattr(team_sensor, 'update_team_answer'):
            team_sensor.update_team_answer(None)
        if hasattr(team_sensor, 'update_team_answered'):
            team_sensor.update_team_answered(False)
        # Reset answer time for next round
        if hasattr(team_sensor, '_answer_time_remaining'):
            team_sensor._answer_time_remaining = 0
            team_sensor.async_write_ha_state()
    
    # Increment round counter
    round_counter_sensor = entities.get("round_counter_sensor")
    if round_counter_sensor and hasattr(round_counter_sensor, 'increment_round'):
        round_counter_sensor.increment_round()
        _LOGGER.debug("Incremented round counter")
    
    # Update high scores
    await _update_high_scores(entities)


async def _update_high_scores(entities: dict) -> None:
    """Update high scores based on current team performance."""
    
    team_sensors = entities.get("team_sensors", {})
    highscore_sensor = entities.get("highscore_sensor")
    round_counter_sensor = entities.get("round_counter_sensor")
    main_sensor = entities.get("main_sensor")
    
    if not highscore_sensor or not round_counter_sensor:
        _LOGGER.debug("Missing highscore or round counter sensor, skipping high score update")
        return
    
    # Get current round count
    rounds_played = getattr(round_counter_sensor, '_round_count', 0)
    if rounds_played <= 0:
        return
    
    # Determine participating teams
    team_count = 5  # Default to all teams
    if main_sensor and hasattr(main_sensor, '_team_count'):
        team_count = main_sensor._team_count
    
    # Check each team for new high scores
    for i in range(1, team_count + 1):
        team_key = f"home_trivia_team_{i}"
        team_sensor = team_sensors.get(team_key)
        
        if not team_sensor:
            continue
            
        # Check if team is participating
        if not getattr(team_sensor, '_participating', True):
            continue
        
        team_name = getattr(team_sensor, '_team_name', f"Team {i}")
        team_points = getattr(team_sensor, '_points', 0)
        
        # Update high score if this is a new record
        if hasattr(highscore_sensor, 'update_highscore'):
            highscore_sensor.update_highscore(team_name, team_points, rounds_played)


async def _register_services(hass: HomeAssistant) -> None:
    """Register all `home_trivia.*` services (start_game, stop_game, etc.)."""

    def _get_entities():
        """Get entity references from hass data."""
        return hass.data.get(DOMAIN, {}).get("entities", {})

    def team_service_handler(method_name: str, required_params: list[str] = None, fallback_handler=None):
        """Decorator to handle team-related services with common entity lookup."""
        if required_params is None:
            required_params = ["team_id"]
            
        def decorator(func):
            async def wrapper(call):
                # Validate required parameters
                for param in required_params:
                    if not call.data.get(param):
                        _LOGGER.error(f"Missing required parameter: {param}")
                        return
                
                team_id = call.data.get("team_id")
                team_number = team_id.split('_')[-1]
                unique_id = f"home_trivia_team_{team_number}"
                
                # Get team sensor entity
                entities = _get_entities()
                team_sensors = entities.get("team_sensors", {})
                team_sensor = team_sensors.get(unique_id)
                
                if team_sensor and hasattr(team_sensor, method_name):
                    _LOGGER.debug(f"Updating team {team_number} via {method_name}")
                    await func(call, team_sensor)
                else:
                    # Use fallback handler if provided
                    if fallback_handler:
                        _LOGGER.warning(f"Could not find team sensor entity {unique_id}, using fallback")
                        await fallback_handler(call, team_number, hass)
                    else:
                        _LOGGER.warning(f"Could not find team sensor entity {unique_id}")
            return wrapper
        return decorator
    
    # Fallback handlers for team services
    async def _fallback_team_name(call, team_number: str, hass: HomeAssistant):
        """Fallback handler for team name updates."""
        entity_id = f"sensor.home_trivia_team_{team_number}"
        state_obj = hass.states.get(entity_id)
        if state_obj:
            name = call.data.get("name")
            attrs = dict(state_obj.attributes) if state_obj.attributes else {}
            hass.states.async_set(entity_id, name, attrs)

    async def _fallback_team_points(call, team_number: str, hass: HomeAssistant):
        """Fallback handler for team points updates."""
        entity_id = f"sensor.home_trivia_team_{team_number}"
        state_obj = hass.states.get(entity_id)
        if state_obj:
            points = call.data.get("points")
            attrs = dict(state_obj.attributes) if state_obj.attributes else {}
            attrs["points"] = int(points)
            hass.states.async_set(entity_id, state_obj.state, attrs)

    async def _fallback_team_participating(call, team_number: str, hass: HomeAssistant):
        """Fallback handler for team participating updates."""
        entity_id = f"sensor.home_trivia_team_{team_number}"
        state_obj = hass.states.get(entity_id)
        if state_obj:
            participating = call.data.get("participating")
            attrs = dict(state_obj.attributes) if state_obj.attributes else {}
            attrs["participating"] = bool(participating)
            hass.states.async_set(entity_id, state_obj.state, attrs)

    async def _fallback_team_answer(call, team_number: str, hass: HomeAssistant):
        """Fallback handler for team answer updates."""
        entity_id = f"sensor.home_trivia_team_{team_number}"
        state_obj = hass.states.get(entity_id)
        if state_obj:
            answer = call.data.get("answer")
            attrs = dict(state_obj.attributes) if state_obj.attributes else {}
            attrs["answer"] = answer
            attrs["answered"] = True
            hass.states.async_set(entity_id, state_obj.state, attrs)

    async def _fallback_team_user_id(call, team_number: str, hass: HomeAssistant):
        """Fallback handler for team user_id updates."""
        entity_id = f"sensor.home_trivia_team_{team_number}"
        state_obj = hass.states.get(entity_id)
        if state_obj:
            user_id = call.data.get("user_id")
            attrs = dict(state_obj.attributes) if state_obj.attributes else {}
            attrs["user_id"] = user_id
            hass.states.async_set(entity_id, state_obj.state, attrs)

    def _get_game_manager():
        """Get GameManager instance from hass data."""
        return hass.data.get(DOMAIN, {}).get("game_manager")

    async def start_game(call):
        game_manager = _get_game_manager()
        if game_manager:
            await game_manager.start_game()
        else:
            _LOGGER.error("GameManager not found")

    async def stop_game(call):
        game_manager = _get_game_manager()
        if game_manager:
            await game_manager.stop_game()
        else:
            _LOGGER.error("GameManager not found")

    async def reset_game(call):
        game_manager = _get_game_manager()
        if game_manager:
            await game_manager.reset_game()
        else:
            _LOGGER.error("GameManager not found")

    async def next_question(call):
        game_manager = _get_game_manager()
        if game_manager:
            await game_manager.next_question()
        else:
            _LOGGER.error("GameManager not found")

    @team_service_handler("update_team_name", ["team_id", "name"], _fallback_team_name)
    async def update_team_name(call, team_sensor):
        """Handle the update_team_name service call."""
        name = call.data.get("name")
        team_sensor.update_team_name(name)

    @team_service_handler("update_team_points", ["team_id", "points"], _fallback_team_points)
    async def update_team_points(call, team_sensor):
        """Handle the update_team_points service call."""
        points = call.data.get("points")
        team_sensor.update_team_points(int(points))

    @team_service_handler("update_team_participating", ["team_id", "participating"], _fallback_team_participating)
    async def update_team_participating(call, team_sensor):
        """Handle the update_team_participating service call."""
        participating = call.data.get("participating")
        team_sensor.update_team_participating(bool(participating))

    @team_service_handler("update_team_answer_with_time", ["team_id", "answer"], _fallback_team_answer)
    async def update_team_answer(call, team_sensor):
        """Handle the update_team_answer service call."""
        answer = call.data.get("answer")
        
        # Get current timer state to capture speed bonus time
        entities = _get_entities()
        countdown_current_sensor = entities.get("countdown_current_sensor")
        time_remaining = 0
        if countdown_current_sensor and hasattr(countdown_current_sensor, '_current_time'):
            time_remaining = max(0, countdown_current_sensor._current_time)
        
        # Update team answer with time remaining when answered
        if hasattr(team_sensor, 'update_team_answer_with_time'):
            team_sensor.update_team_answer_with_time(answer, time_remaining)
        else:
            # Fallback to regular answer update
            team_sensor.update_team_answer(answer)
        
        team_sensor.update_team_answered(True)
        
        _LOGGER.debug("Team answered %s with %d seconds remaining", answer, time_remaining)

    @team_service_handler("update_team_user_id", ["team_id"], _fallback_team_user_id)
    async def update_team_user_id(call, team_sensor):
        """Handle the update_team_user_id service call."""
        user_id = call.data.get("user_id")
        team_sensor.update_team_user_id(user_id)

    async def update_countdown_timer_length(call):
        length = call.data.get("timer_length")
        if length is None:
            _LOGGER.error("Missing timer_length")
            return
        
        entities = _get_entities()
        timer_sensor = entities.get("countdown_sensor")
        if timer_sensor and hasattr(timer_sensor, 'update_timer_length'):
            timer_sensor.update_timer_length(int(length))
        else:
            hass.states.async_set("sensor.home_trivia_countdown_timer", int(length))
        
        # Also persist timer length in main sensor for settings persistence
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_timer_length'):
            main_sensor.set_timer_length(int(length))
        else:
            # Update the game status entity with timer_length attribute
            state_obj = hass.states.get("sensor.home_trivia_game_status")
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["timer_length"] = int(length)
                hass.states.async_set("sensor.home_trivia_game_status", state_obj.state, attrs)
            else:
                # Create the entity if it doesn't exist
                hass.states.async_set("sensor.home_trivia_game_status", "ready", {"timer_length": int(length)})

    async def update_team_count(call):
        team_count = call.data.get("team_count")
        if team_count is None:
            _LOGGER.error("Missing team_count")
            return
        
        # Validate team count is between 1 and 5
        team_count = int(team_count)
        if team_count < 1 or team_count > 5:
            _LOGGER.error("Invalid team_count: %s (must be 1-5)", team_count)
            return
            
        entities = _get_entities()
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_team_count'):
            main_sensor.set_team_count(team_count)
        else:
            # Update the game status entity with team_count attribute
            state_obj = hass.states.get("sensor.home_trivia_game_status")
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["team_count"] = team_count
                hass.states.async_set("sensor.home_trivia_game_status", state_obj.state, attrs)
            else:
                # Create the entity if it doesn't exist
                hass.states.async_set("sensor.home_trivia_game_status", "ready", {"team_count": team_count})

    async def update_difficulty_level(call):
        difficulty = call.data.get("difficulty_level")
        if not difficulty:
            _LOGGER.error("Missing difficulty_level")
            return
        
        entities = _get_entities()
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_difficulty_level'):
            main_sensor.set_difficulty_level(difficulty)
        else:
            # Update the game status entity with difficulty_level attribute
            state_obj = hass.states.get("sensor.home_trivia_game_status")
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["difficulty_level"] = difficulty
                hass.states.async_set("sensor.home_trivia_game_status", state_obj.state, attrs)
            else:
                # Create the entity if it doesn't exist
                hass.states.async_set("sensor.home_trivia_game_status", "ready", {"difficulty_level": difficulty})

    # Register all services under the "home_trivia" domain
    hass.services.async_register(DOMAIN, "start_game", start_game)
    hass.services.async_register(DOMAIN, "stop_game", stop_game)
    hass.services.async_register(DOMAIN, "reset_game", reset_game)
    hass.services.async_register(DOMAIN, "next_question", next_question)
    hass.services.async_register(DOMAIN, "update_team_name", update_team_name)
    hass.services.async_register(DOMAIN, "update_team_points", update_team_points)
    hass.services.async_register(DOMAIN, "update_team_participating", update_team_participating)
    hass.services.async_register(DOMAIN, "update_team_answer", update_team_answer)
    hass.services.async_register(DOMAIN, "update_difficulty_level", update_difficulty_level)
    hass.services.async_register(DOMAIN, "update_team_user_id", update_team_user_id)
    hass.services.async_register(DOMAIN, "update_countdown_timer_length", update_countdown_timer_length)
    hass.services.async_register(DOMAIN, "update_team_count", update_team_count)


class GameManager:
    """Central manager for Home Trivia game logic and state."""
    
    def __init__(self, hass: HomeAssistant):
        """Initialize the game manager."""
        self.hass = hass
        
    def _get_entities(self):
        """Get entity references from hass data."""
        return self.hass.data.get(DOMAIN, {}).get("entities", {})
    
    async def start_game(self):
        """Start a new trivia game."""
        _LOGGER.info("Starting Home Trivia game")
        entities = self._get_entities()
        
        # Reset game stats at the start of each game
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'reset_game_stats'):
            main_sensor.reset_game_stats()
        
        # Set game status to playing
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("playing")
        else:
            self.hass.states.async_set("sensor.home_trivia_game_status", "playing")
        
        # Stop any countdown timer
        countdown_current_sensor = entities.get("countdown_current_sensor")
        if countdown_current_sensor and hasattr(countdown_current_sensor, 'stop_countdown'):
            countdown_current_sensor.stop_countdown()
        else:
            self.hass.states.async_set("sensor.home_trivia_countdown_current", 0)
        
        # Reset game state
        await self._reset_game_state(entities, reset_teams=True)
    
    async def stop_game(self):
        """Stop the current trivia game."""
        _LOGGER.info("Stopping Home Trivia game")
        entities = self._get_entities()
        
        # Stop any countdown timer
        countdown_current_sensor = entities.get("countdown_current_sensor")
        if countdown_current_sensor and hasattr(countdown_current_sensor, 'stop_countdown'):
            countdown_current_sensor.stop_countdown()
        
        # Calculate and set summary before stopping
        await self._calculate_and_set_summary(entities)
        
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("stopped")
        else:
            self.hass.states.async_set("sensor.home_trivia_game_status", "stopped")
    
    async def reset_game(self):
        """Reset game progress while preserving setup."""
        _LOGGER.info("Resetting Home Trivia game - preserving user setup")
        entities = self._get_entities()
        
        # Stop any countdown timer
        countdown_current_sensor = entities.get("countdown_current_sensor")
        if countdown_current_sensor and hasattr(countdown_current_sensor, 'stop_countdown'):
            countdown_current_sensor.stop_countdown()
        
        # Reset game status to ready
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("ready")
        else:
            self.hass.states.async_set("sensor.home_trivia_game_status", "ready")
        
        # Reset game state but preserve team setup
        await self._reset_game_state(entities, reset_teams=False)
    
    async def next_question(self):
        """Move to the next trivia question."""
        _LOGGER.info("Moving to next trivia question")
        
        entities = self._get_entities()
        
        # Process scoring from the previous round (if there was one)
        await _process_round_scoring(entities)
        
        # Reset team answers
        await self._reset_team_answers(entities)
        
        # Load and select next question
        await self._load_next_question(entities)
        
        # Start countdown timer
        await self._start_countdown(entities)
        
        # Trigger state update
        state_obj = self.hass.states.get("sensor.home_trivia_game_status")
        if state_obj:
            self.hass.states.async_set("sensor.home_trivia_game_status", state_obj.state, state_obj.attributes)
    
    async def _reset_game_state(self, entities: dict, reset_teams: bool = True):
        """Reset core game state (rounds, questions, etc.)."""
        # Reset round counter to 0
        round_counter_sensor = entities.get("round_counter_sensor")
        if round_counter_sensor and hasattr(round_counter_sensor, 'reset_round_counter'):
            round_counter_sensor.reset_round_counter()
        else:
            self.hass.states.async_set("sensor.home_trivia_round_counter", 0)
        
        # Reset played questions list
        played_questions_sensor = entities.get("played_questions_sensor")
        if played_questions_sensor and hasattr(played_questions_sensor, 'reset_played_questions'):
            played_questions_sensor.reset_played_questions()
        else:
            self.hass.states.async_set("sensor.home_trivia_played_questions", 0, {"played_question_ids": []})
        
        if reset_teams:
            await self._reset_teams_for_new_game(entities)
        else:
            await self._reset_teams_preserve_setup(entities)
    
    async def _reset_teams_for_new_game(self, entities: dict):
        """Reset teams to default state for new game."""
        team_sensors = entities.get("team_sensors", {})
        main_sensor = entities.get("main_sensor")
        team_count = 5  # Default to all teams if we can't get the setting
        
        # Try to get current team count from main sensor
        if main_sensor and hasattr(main_sensor, '_team_count'):
            team_count = main_sensor._team_count
        else:
            # Fallback: check state attributes
            state_obj = self.hass.states.get("sensor.home_trivia_game_status")
            if state_obj and state_obj.attributes and 'team_count' in state_obj.attributes:
                team_count = int(state_obj.attributes['team_count'])
        
        # Reset active teams to default names and 0 points
        for i in range(1, team_count + 1):
            team_key = f"home_trivia_team_{i}"
            team_sensor = team_sensors.get(team_key)
            if team_sensor:
                team_sensor.update_team_name(f"Team {i}")
                team_sensor.update_team_points(0)
                team_sensor.update_team_participating(True)
                # Reset trivia-specific attributes
                if hasattr(team_sensor, 'update_team_answer'):
                    team_sensor.update_team_answer(None)
                if hasattr(team_sensor, 'update_team_answered'):
                    team_sensor.update_team_answered(False)
                if hasattr(team_sensor, '_answer_time_remaining'):
                    team_sensor._answer_time_remaining = 0
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, '_last_round_answer'):
                    team_sensor._last_round_answer = None
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, 'update_team_user_id'):
                    team_sensor.update_team_user_id(None)
                if hasattr(team_sensor, 'reset_streak'):
                    team_sensor.reset_streak()
        
        # Disable any teams beyond the current team count
        for i in range(team_count + 1, 6):
            team_key = f"home_trivia_team_{i}"
            team_sensor = team_sensors.get(team_key)
            if team_sensor:
                team_sensor.update_team_participating(False)
    
    async def _reset_teams_preserve_setup(self, entities: dict):
        """Reset team game progress while preserving setup."""
        team_sensors = entities.get("team_sensors", {})
        for i in range(1, 6):
            team_key = f"home_trivia_team_{i}"
            team_sensor = team_sensors.get(team_key)
            if team_sensor:
                # Only reset gameplay-related attributes, preserve team setup
                team_sensor.update_team_points(0)
                if hasattr(team_sensor, 'update_team_answer'):
                    team_sensor.update_team_answer(None)
                if hasattr(team_sensor, 'update_team_answered'):
                    team_sensor.update_team_answered(False)
                if hasattr(team_sensor, '_answer_time_remaining'):
                    team_sensor._answer_time_remaining = 0
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, '_last_round_answer'):
                    team_sensor._last_round_answer = None
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, 'reset_streak'):
                    team_sensor.reset_streak()
    
    async def _reset_team_answers(self, entities: dict):
        """Reset team answers for the next question."""
        team_sensors = entities.get("team_sensors", {})
        
        # Reset answer and answered status for all teams
        for team_key, team_sensor in team_sensors.items():
            if team_sensor and hasattr(team_sensor, 'update_team_answer') and hasattr(team_sensor, 'update_team_answered'):
                team_sensor.update_team_answer(None)
                team_sensor.update_team_answered(False)
                # Reset answer time for next question
                if hasattr(team_sensor, '_answer_time_remaining'):
                    team_sensor._answer_time_remaining = 0
                    team_sensor.async_write_ha_state()
                _LOGGER.debug("Reset answer for %s", team_key)
    
    async def _load_next_question(self, entities: dict):
        """Load and set the next trivia question."""
        current_question_sensor = entities.get("current_question_sensor")
        
        try:
            questions_file = os.path.join(os.path.dirname(__file__), "questions.json")
            
            def _load_questions_file():
                with open(questions_file, 'r') as f:
                    return json.load(f)
            
            questions = await self.hass.async_add_executor_job(_load_questions_file)
            
            if questions:
                # Get played questions sensor to check which questions have been asked
                played_questions_sensor = entities.get("played_questions_sensor")
                played_question_ids = []
                
                if played_questions_sensor and hasattr(played_questions_sensor, 'extra_state_attributes'):
                    played_question_ids = played_questions_sensor.extra_state_attributes.get("played_question_ids", [])
                
                # Get difficulty level from main sensor or use default
                difficulty_level = "Easy"  # Default
                main_sensor = entities.get("main_sensor")
                if main_sensor and hasattr(main_sensor, '_difficulty_level'):
                    difficulty_level = main_sensor._difficulty_level
                
                # Filter questions by difficulty level
                available_questions = [q for q in questions if q.get("difficulty_level") == difficulty_level]
                
                # Filter out already played questions
                unplayed_questions = [q for q in available_questions if q.get("id") not in played_question_ids]
                
                if unplayed_questions:
                    # Select random question from unplayed questions
                    selected_question = random.choice(unplayed_questions)
                    question_id = selected_question.get("id")
                    
                    _LOGGER.info("Selected unplayed question with ID %s (%d unplayed questions remaining)", 
                                question_id, len(unplayed_questions) - 1)
                    
                    # Add question to played list
                    if played_questions_sensor and hasattr(played_questions_sensor, 'add_played_question'):
                        played_questions_sensor.add_played_question(question_id)
                    
                    # Update the current question sensor with the question details
                    if current_question_sensor and hasattr(current_question_sensor, 'update_current_question'):
                        current_question_sensor.update_current_question({
                            "question_id": selected_question.get("id"),
                            "category": selected_question.get("category"),
                            "question": selected_question.get("question"),
                            "answer_a": selected_question.get("answer_a"),
                            "answer_b": selected_question.get("answer_b"),
                            "answer_c": selected_question.get("answer_c"),
                            "correct_answer": selected_question.get("correct_answer"),
                            "fun_fact": selected_question.get("fun_fact"),
                            "difficulty_level": selected_question.get("difficulty_level")
                        })
                else:
                    # All questions have been asked
                    _LOGGER.warning("All questions have been asked! Total questions: %d", len(available_questions))
                    
                    # Clear the current question sensor to trigger warning display
                    if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                        current_question_sensor.clear_current_question()
                    
                    return
            else:
                _LOGGER.warning("No questions found in questions.json")
                if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                    current_question_sensor.clear_current_question()
        except Exception as e:
            _LOGGER.error("Failed to select random question: %s", e)
            if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                current_question_sensor.clear_current_question()
    
    async def _start_countdown(self, entities: dict):
        """Start the countdown timer for the current question."""
        countdown_sensor = entities.get("countdown_sensor")
        countdown_current_sensor = entities.get("countdown_current_sensor")
        
        if countdown_sensor and countdown_current_sensor:
            # Get the configured timer length
            timer_length = int(countdown_sensor.state) if (hasattr(countdown_sensor, 'state') and countdown_sensor.state is not None) else 30
            
            # Start the countdown
            if hasattr(countdown_current_sensor, 'start_countdown'):
                countdown_current_sensor.start_countdown(timer_length)
            else:
                # Fallback to direct state setting
                self.hass.states.async_set("sensor.home_trivia_countdown_current", timer_length)
        else:
            # Fallback: get timer length from sensor state and start countdown
            timer_entity = self.hass.states.get("sensor.home_trivia_countdown_timer")
            timer_length = int(timer_entity.state) if (timer_entity and timer_entity.state is not None) else 30
            
            # Try to find the countdown current sensor entity and start countdown
            countdown_current_sensor = None
            
            # Check all config entries for the entity
            for config_entry_data in self.hass.data.get(DOMAIN, {}).values():
                if isinstance(config_entry_data, dict) and "entities" in config_entry_data:
                    countdown_current_sensor = config_entry_data["entities"].get("countdown_current_sensor")
                    if countdown_current_sensor:
                        break
            
            # If not found in config entries, check the global entities dict
            if not countdown_current_sensor:
                entities = self.hass.data.get(DOMAIN, {}).get("entities", {})
                countdown_current_sensor = entities.get("countdown_current_sensor")
            
            if countdown_current_sensor and hasattr(countdown_current_sensor, 'start_countdown'):
                countdown_current_sensor.start_countdown(timer_length)
            else:
                # Final fallback: just set the state (countdown won't auto-decrement)
                self.hass.states.async_set("sensor.home_trivia_countdown_current", timer_length)

    async def _calculate_and_set_summary(self, entities: dict):
        """Calculate final game stats and store them."""
        main_sensor = entities.get("main_sensor")
        team_sensors = entities.get("team_sensors", {})
        
        # Calculate Best Category for each team
        team_stats = {}
        for team_id, team_sensor in team_sensors.items():
            if not getattr(team_sensor, '_participating', False):
                continue
            
            best_category = "N/A"
            best_rate = -1
            category_stats = getattr(team_sensor, '_category_stats', {})
            for cat, stats in category_stats.items():
                if stats['total'] > 0:
                    rate = stats['correct'] / stats['total']
                    if rate > best_rate:
                        best_rate = rate
                        best_category = cat
            team_stats[team_id] = {"best_category": best_category}

        # Calculate MVP
        mvp_data = {"name": "N/A", "score": 0}
        user_stats = getattr(main_sensor, '_user_stats', {})
        if user_stats:
            # Find user_id with the most correct answers
            mvp_user_id = max(user_stats, key=lambda u: user_stats[u]['correct_answers'])
            mvp_score = user_stats[mvp_user_id]['correct_answers']
            
            # Find the HA user's name from their ID (requires hass object)
            try:
                user_info = await self.hass.auth.async_get_user(mvp_user_id)
                mvp_name = user_info.name if user_info else mvp_user_id
                mvp_data = {"name": mvp_name, "score": mvp_score}
            except Exception as e:
                _LOGGER.warning("Could not get user info for MVP: %s", e)
                mvp_data = {"name": mvp_user_id, "score": mvp_score}
            
        # Assemble and set summary
        summary = {
            "team_stats": team_stats,
            "mvp": mvp_data,
        }
        if main_sensor and hasattr(main_sensor, 'set_game_summary'):
            main_sensor.set_game_summary(summary)
            _LOGGER.info("Game summary calculated and set")


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and remove services if no entries remain."""
    _LOGGER.info("Unloading Home Trivia entry %s", entry.entry_id)
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
        if not hass.data[DOMAIN]:
            # No more config entries—remove all services
            for svc in [
                "start_game",
                "stop_game",
                "reset_game",
                "next_question",
                "update_team_name",
                "update_team_points",
                "update_team_participating",
                "update_team_answer",
                "update_difficulty_level",
                "update_team_user_id",
                "update_countdown_timer_length",
                "update_team_count",
            ]:
                hass.services.async_remove(DOMAIN, svc)
    return unload_ok