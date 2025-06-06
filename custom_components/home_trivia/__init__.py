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

    # Register all game services (after entities are created)
    await _register_services(hass)
    
    return True

async def _register_services(hass: HomeAssistant) -> None:
    """Register all `home_trivia.*` services (start_game, stop_game, etc.)."""

    def _get_entities():
        """Get entity references from hass data."""
        return hass.data.get(DOMAIN, {}).get("entities", {})

    async def start_game(call):
        _LOGGER.info("Starting Home Trivia game")
        entities = _get_entities()
        
        # Set game status to playing
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("playing")
        else:
            hass.states.async_set("sensor.home_trivia_game_status", "playing")
        
        # Stop any countdown timer
        countdown_current_sensor = entities.get("countdown_current_sensor")
        if countdown_current_sensor and hasattr(countdown_current_sensor, 'stop_countdown'):
            countdown_current_sensor.stop_countdown()
        else:
            hass.states.async_set("sensor.home_trivia_countdown_current", 0)
        
        # Reset round counter to 0
        round_counter_sensor = entities.get("round_counter_sensor")
        if round_counter_sensor and hasattr(round_counter_sensor, 'reset_round_counter'):
            round_counter_sensor.reset_round_counter()
        else:
            hass.states.async_set("sensor.home_trivia_round_counter", 0)
        
        # Reset played questions list
        played_questions_sensor = entities.get("played_questions_sensor")
        if played_questions_sensor and hasattr(played_questions_sensor, 'reset_played_questions'):
            played_questions_sensor.reset_played_questions()
        else:
            hass.states.async_set("sensor.home_trivia_played_questions", 0, {"played_question_ids": []})
        
        # Reset teams based on current team count
        team_sensors = entities.get("team_sensors", {})
        main_sensor = entities.get("main_sensor")
        team_count = 5  # Default to all teams if we can't get the setting
        
        # Try to get current team count from main sensor
        if main_sensor and hasattr(main_sensor, '_team_count'):
            team_count = main_sensor._team_count
        else:
            # Fallback: check state attributes
            state_obj = hass.states.get("sensor.home_trivia_game_status")
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
                if hasattr(team_sensor, '_last_round_answer'):
                    team_sensor._last_round_answer = None
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, 'update_team_user_id'):
                    team_sensor.update_team_user_id(None)
            else:
                # Fallback to direct state setting
                team_entity_id = f"sensor.home_trivia_team_{i}"
                hass.states.async_set(team_entity_id, f"Team {i}", {
                    "points": 0,
                    "participating": True,
                    "team_number": i
                })
        
        # Disable any teams beyond the current team count
        for i in range(team_count + 1, 6):
            team_key = f"home_trivia_team_{i}"
            team_sensor = team_sensors.get(team_key)
            if team_sensor:
                team_sensor.update_team_participating(False)
            else:
                # Fallback to direct state setting
                team_entity_id = f"sensor.home_trivia_team_{i}"
                hass.states.async_set(team_entity_id, f"Team {i}", {
                    "points": 0,
                    "participating": False,
                    "team_number": i
                })

    async def stop_game(call):
        _LOGGER.info("Stopping Home Trivia game")
        entities = _get_entities()
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("stopped")
        else:
            hass.states.async_set("sensor.home_trivia_game_status", "stopped")

    async def reset_game(call):
        _LOGGER.info("Resetting Home Trivia game")
        entities = _get_entities()
        
        # Reset game status
        main_sensor = entities.get("main_sensor")
        if main_sensor and hasattr(main_sensor, 'set_state'):
            main_sensor.set_state("ready")
        else:
            hass.states.async_set("sensor.home_trivia_game_status", "ready")
        
        # Reset all teams
        team_sensors = entities.get("team_sensors", {})
        for i in range(1, 6):
            team_key = f"home_trivia_team_{i}"
            team_sensor = team_sensors.get(team_key)
            if team_sensor:
                team_sensor.update_team_name(f"Team {i}")
                team_sensor.update_team_points(0)
                team_sensor.update_team_participating(True)
                if hasattr(team_sensor, 'update_team_answer'):
                    team_sensor.update_team_answer(None)
                if hasattr(team_sensor, 'update_team_answered'):
                    team_sensor.update_team_answered(False)
                if hasattr(team_sensor, '_last_round_answer'):
                    team_sensor._last_round_answer = None
                    team_sensor.async_write_ha_state()
                if hasattr(team_sensor, 'update_team_user_id'):
                    team_sensor.update_team_user_id(None)
            else:
                # Fallback to direct state setting
                team_entity_id = f"sensor.home_trivia_team_{i}"
                hass.states.async_set(team_entity_id, f"Team {i}", {
                    "points": 0,
                    "participating": True,
                    "team_number": i
                })

    async def next_question(call):
        _LOGGER.info("Moving to next trivia question")
        
        # Start countdown timer from configured timer length
        entities = _get_entities()
        countdown_sensor = entities.get("countdown_sensor")
        countdown_current_sensor = entities.get("countdown_current_sensor")
        current_question_sensor = entities.get("current_question_sensor")
        
        try:
            questions_file = os.path.join(os.path.dirname(__file__), "questions.json")
            
            def _load_questions_file():
                with open(questions_file, 'r') as f:
                    return json.load(f)
            
            questions = await hass.async_add_executor_job(_load_questions_file)
            
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
                    selected_question = None
                    
                    # Clear the current question sensor to trigger warning display
                    if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                        current_question_sensor.clear_current_question()
                    
                    # We'll handle the warning display in the frontend
                    return
            else:
                _LOGGER.warning("No questions found in questions.json")
                if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                    current_question_sensor.clear_current_question()
        except Exception as e:
            _LOGGER.error("Failed to select random question: %s", e)
            if current_question_sensor and hasattr(current_question_sensor, 'clear_current_question'):
                current_question_sensor.clear_current_question()
        
        if countdown_sensor and countdown_current_sensor:
            # Get the configured timer length
            timer_length = int(countdown_sensor.state) if (hasattr(countdown_sensor, 'state') and countdown_sensor.state is not None) else 30
            
            # Start the countdown
            if hasattr(countdown_current_sensor, 'start_countdown'):
                countdown_current_sensor.start_countdown(timer_length)
            else:
                # Fallback to direct state setting
                hass.states.async_set("sensor.home_trivia_countdown_current", timer_length)
        else:
            # Fallback: get timer length from sensor state and start countdown
            timer_entity = hass.states.get("sensor.home_trivia_countdown_timer")
            timer_length = int(timer_entity.state) if (timer_entity and timer_entity.state is not None) else 30
            
            # Try to find the countdown current sensor entity and start countdown
            countdown_current_sensor = None
            
            # Check all config entries for the entity
            for config_entry_data in hass.data.get(DOMAIN, {}).values():
                if isinstance(config_entry_data, dict) and "entities" in config_entry_data:
                    countdown_current_sensor = config_entry_data["entities"].get("countdown_current_sensor")
                    if countdown_current_sensor:
                        break
            
            # If not found in config entries, check the global entities dict
            if not countdown_current_sensor:
                entities = hass.data.get(DOMAIN, {}).get("entities", {})
                countdown_current_sensor = entities.get("countdown_current_sensor")
            
            if countdown_current_sensor and hasattr(countdown_current_sensor, 'start_countdown'):
                countdown_current_sensor.start_countdown(timer_length)
            else:
                # Final fallback: just set the state (countdown won't auto-decrement)
                hass.states.async_set("sensor.home_trivia_countdown_current", timer_length)
        
        # Keep the game status unchanged but trigger an update
        state_obj = hass.states.get("sensor.home_trivia_game_status")
        if state_obj:
            hass.states.async_set("sensor.home_trivia_game_status", state_obj.state, state_obj.attributes)

    async def update_team_name(call):
        team_id = call.data.get("team_id")
        name = call.data.get("name")
        if not team_id or not name:
            _LOGGER.error("Missing team_id or name")
            return
        
        # Extract team number from team_id (e.g., "team_1" -> "1")
        team_number = team_id.split('_')[-1]
        unique_id = f"home_trivia_team_{team_number}"
        
        # Find the team sensor entity and call its update method
        entities = _get_entities()
        team_sensors = entities.get("team_sensors", {})
        team_sensor = team_sensors.get(unique_id)
        
        if team_sensor and hasattr(team_sensor, 'update_team_name'):
            _LOGGER.debug("Updating team %s name to '%s' via entity method", team_number, name)
            team_sensor.update_team_name(name)
        else:
            # Fallback to direct state setting
            _LOGGER.warning("Could not find team sensor entity %s, using fallback", unique_id)
            entity_id = f"sensor.home_trivia_team_{team_number}"
            state_obj = hass.states.get(entity_id)
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                hass.states.async_set(entity_id, name, attrs)

    async def update_team_points(call):
        team_id = call.data.get("team_id")
        points = call.data.get("points")
        if not team_id or points is None:
            _LOGGER.error("Missing team_id or points")
            return
        
        # Extract team number from team_id (e.g., "team_1" -> "1")
        team_number = team_id.split('_')[-1]
        unique_id = f"home_trivia_team_{team_number}"
        
        # Find the team sensor entity and call its update method
        entities = _get_entities()
        team_sensors = entities.get("team_sensors", {})
        team_sensor = team_sensors.get(unique_id)
        
        if team_sensor and hasattr(team_sensor, 'update_team_points'):
            _LOGGER.debug("Updating team %s points to %d via entity method", team_number, points)
            team_sensor.update_team_points(int(points))
        else:
            # Fallback to direct state setting
            _LOGGER.warning("Could not find team sensor entity %s, using fallback", unique_id)
            entity_id = f"sensor.home_trivia_team_{team_number}"
            state_obj = hass.states.get(entity_id)
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["points"] = int(points)
                hass.states.async_set(entity_id, state_obj.state, attrs)

    async def update_team_participating(call):
        team_id = call.data.get("team_id")
        participating = call.data.get("participating")
        if not team_id or participating is None:
            _LOGGER.error("Missing team_id or participating")
            return
        
        # Extract team number from team_id (e.g., "team_1" -> "1")
        team_number = team_id.split('_')[-1]
        unique_id = f"home_trivia_team_{team_number}"
        
        # Find the team sensor entity and call its update method
        entities = _get_entities()
        team_sensors = entities.get("team_sensors", {})
        team_sensor = team_sensors.get(unique_id)
        
        if team_sensor and hasattr(team_sensor, 'update_team_participating'):
            _LOGGER.debug("Updating team %s participating to %s via entity method", team_number, participating)
            team_sensor.update_team_participating(bool(participating))
        else:
            # Fallback to direct state setting
            _LOGGER.warning("Could not find team sensor entity %s, using fallback", unique_id)
            entity_id = f"sensor.home_trivia_team_{team_number}"
            state_obj = hass.states.get(entity_id)
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["participating"] = bool(participating)
                hass.states.async_set(entity_id, state_obj.state, attrs)

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

    async def update_team_answer(call):
        team_id = call.data.get("team_id")
        answer = call.data.get("answer")
        if not team_id or not answer:
            _LOGGER.error("Missing team_id or answer")
            return
        
        # Extract team number from team_id (e.g., "team_1" -> "1")
        team_number = team_id.split('_')[-1]
        unique_id = f"home_trivia_team_{team_number}"
        
        # Find the team sensor entity and call its update method
        entities = _get_entities()
        team_sensors = entities.get("team_sensors", {})
        team_sensor = team_sensors.get(unique_id)
        
        if team_sensor and hasattr(team_sensor, 'update_team_answer'):
            _LOGGER.debug("Updating team %s answer to %s via entity method", team_number, answer)
            team_sensor.update_team_answer(answer)
            team_sensor.update_team_answered(True)
        else:
            # Fallback to direct state setting
            _LOGGER.warning("Could not find team sensor entity %s, using fallback", unique_id)
            entity_id = f"sensor.home_trivia_team_{team_number}"
            state_obj = hass.states.get(entity_id)
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["answer"] = answer
                attrs["answered"] = True
                hass.states.async_set(entity_id, state_obj.state, attrs)

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

    async def update_team_user_id(call):
        team_id = call.data.get("team_id")
        user_id = call.data.get("user_id")
        if not team_id:
            _LOGGER.error("Missing team_id")
            return
        
        # Extract team number from team_id (e.g., "team_1" -> "1")
        team_number = team_id.split('_')[-1]
        unique_id = f"home_trivia_team_{team_number}"
        
        # Find the team sensor entity and call its update method
        entities = _get_entities()
        team_sensors = entities.get("team_sensors", {})
        team_sensor = team_sensors.get(unique_id)
        
        if team_sensor and hasattr(team_sensor, 'update_team_user_id'):
            _LOGGER.debug("Updating team %s user_id to %s via entity method", team_number, user_id)
            team_sensor.update_team_user_id(user_id)
        else:
            # Fallback to direct state setting
            _LOGGER.warning("Could not find team sensor entity %s, using fallback", unique_id)
            entity_id = f"sensor.home_trivia_team_{team_number}"
            state_obj = hass.states.get(entity_id)
            if state_obj:
                attrs = dict(state_obj.attributes) if state_obj.attributes else {}
                attrs["user_id"] = user_id
                hass.states.async_set(entity_id, state_obj.state, attrs)

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