"""Home Trivia sensor platform."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity, RestoreEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class HomeTriviaBaseSensor(SensorEntity, RestoreEntity):
    """Base class for Home Trivia sensors that handles state restoration."""

    async def async_added_to_hass(self) -> None:
        """Handle entity which provides state restoration."""
        await super().async_added_to_hass()
        if (last_state := await self.async_get_last_state()) is not None:
            await self._restore_state(last_state)
            _LOGGER.debug(f"Restored state for {self.name}: {getattr(self, '_state', 'N/A')}")

    async def _restore_state(self, last_state) -> None:
        """Override this method in subclasses to handle specific state restoration."""
        # Default implementation - subclasses should override this
        pass


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Home Trivia sensor based on a config entry."""
    _LOGGER.info("Setting up Home Trivia sensors")
    
    # Create all sensor entities
    entities = []
    
    # Main game status sensor
    main_sensor = HomeTriviaGameStatusSensor(config_entry)
    entities.append(main_sensor)
    
    # Individual team sensors
    team_sensors = {}
    for i in range(1, 6):
        team_sensor = HomeTriviaTeamSensor(i)
        team_sensors[f"home_trivia_team_{i}"] = team_sensor
        entities.append(team_sensor)
    
    # Individual game settings sensors
    countdown_sensor = HomeTriviaCountdownTimerSensor()
    countdown_current_sensor = HomeTriviaCountdownCurrentSensor()
    current_question_sensor = HomeTriviaCurrentQuestionSensor()
    round_counter_sensor = HomeTriviaRoundCounterSensor()
    played_questions_sensor = HomeTriviaPlayedQuestionsSensor()
    highscore_sensor = HomeTriviaHighscoreSensor()
    
    entities.extend([
        countdown_sensor, 
        countdown_current_sensor, 
        current_question_sensor, 
        round_counter_sensor, 
        played_questions_sensor, 
        highscore_sensor
    ])
    
    # Store entity references in hass data for service access
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["entities"] = {
        "main_sensor": main_sensor,
        "team_sensors": team_sensors,
        "countdown_sensor": countdown_sensor,
        "countdown_current_sensor": countdown_current_sensor,
        "current_question_sensor": current_question_sensor,
        "round_counter_sensor": round_counter_sensor,
        "played_questions_sensor": played_questions_sensor,
        "highscore_sensor": highscore_sensor,
    }
    
    async_add_entities(entities, True)


class HomeTriviaGameStatusSensor(HomeTriviaBaseSensor):
    """Representation of a Home Trivia main game status sensor."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        self._attr_name = "Home Trivia Game Status"
        self._attr_unique_id = "home_trivia_game_status"
        self._attr_icon = "mdi:help-circle"
        self._state = "ready"
        
        # Set default values - these will be overridden by restored state if available
        self._team_count = 2
        self._difficulty_level = "Easy"
        self._timer_length = 30

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            # Restore the game state
            self._state = last_state.state
            _LOGGER.debug("Restored game state: %s", self._state)
            
            # Restore attributes if available
            if last_state.attributes:
                self._team_count = int(last_state.attributes.get("team_count", 2))
                self._difficulty_level = last_state.attributes.get("difficulty_level", "Easy")
                self._timer_length = int(last_state.attributes.get("timer_length", 30))
                
                _LOGGER.info("Restored game settings - Team Count: %d, Difficulty: %s, Timer: %d", 
                           self._team_count, self._difficulty_level, self._timer_length)
                
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore game status state: %s", e)

    @property
    def state(self) -> str:
        """Return the state of the sensor."""
        return self._state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Home Trivia Game Status",
            "description": "Current status of the Home Trivia party game",
            "team_count": self._team_count,
            "difficulty_level": self._difficulty_level,
            "timer_length": self._timer_length,
        }

    def set_state(self, new_state: str) -> None:
        """Set the game state."""
        self._state = new_state
        self.async_write_ha_state()

    def set_team_count(self, team_count: int) -> None:
        """Set the number of teams."""
        self._team_count = team_count
        self.async_write_ha_state()

    def set_difficulty_level(self, difficulty: str) -> None:
        """Set the difficulty level."""
        self._difficulty_level = difficulty
        self.async_write_ha_state()

    def set_timer_length(self, timer_length: int) -> None:
        """Set the timer length."""
        self._timer_length = timer_length
        self.async_write_ha_state()

    async def async_update(self) -> None:
        """Update the sensor."""
        _LOGGER.debug("Updating Home Trivia main sensor")


class HomeTriviaTeamSensor(HomeTriviaBaseSensor):
    """Representation of a Home Trivia team sensor."""

    def __init__(self, team_number: int) -> None:
        """Initialize the team sensor."""
        self._team_number = team_number
        self._attr_name = f"Home Trivia Team {team_number}"
        self._attr_unique_id = f"home_trivia_team_{team_number}"
        self._attr_icon = "mdi:account-group"
        self._team_name = f"Team {team_number}"
        self._points = 0
        self._participating = True
        self._answer = None  # A, B, or C
        self._answered = False
        self._last_round_answer = None
        self._last_round_correct = False
        self._last_round_points = 0
        self._user_id = None

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            # Restore team name from the state
            self._team_name = last_state.state
            _LOGGER.debug("Restored team %d name: %s", self._team_number, self._team_name)
            
            # Restore attributes if available
            if last_state.attributes:
                self._points = int(last_state.attributes.get("points", 0))
                self._participating = bool(last_state.attributes.get("participating", True))
                self._answer = last_state.attributes.get("answer")
                self._answered = bool(last_state.attributes.get("answered", False))
                self._last_round_answer = last_state.attributes.get("last_round_answer")
                self._last_round_correct = bool(last_state.attributes.get("last_round_correct", False))
                self._last_round_points = int(last_state.attributes.get("last_round_points", 0))
                self._user_id = last_state.attributes.get("user_id")
                
                _LOGGER.debug("Restored team %d attributes", self._team_number)
                
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore team %d state: %s", self._team_number, e)

    @property
    def state(self) -> str:
        """Return the state of the sensor."""
        return self._team_name

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": f"Team {self._team_number}",
            "team_number": self._team_number,
            "points": self._points,
            "participating": self._participating,
            "answer": self._answer,
            "answered": self._answered,
            "last_round_answer": self._last_round_answer,
            "last_round_correct": self._last_round_correct,
            "last_round_points": self._last_round_points,
            "user_id": self._user_id,
        }

    def update_team_name(self, name: str) -> None:
        """Update the team name."""
        self._team_name = name
        self.async_write_ha_state()

    def update_team_points(self, points: int) -> None:
        """Update the team points."""
        self._points = points
        self.async_write_ha_state()

    def update_team_participating(self, participating: bool) -> None:
        """Update team participation status."""
        self._participating = participating
        self.async_write_ha_state()

    def update_team_answer(self, answer: str | None) -> None:
        """Update the team's answer choice."""
        self._answer = answer
        self.async_write_ha_state()

    def update_team_answered(self, answered: bool) -> None:
        """Update whether the team has answered."""
        self._answered = answered
        self.async_write_ha_state()

    def update_team_user_id(self, user_id: str | None) -> None:
        """Update the team's assigned user ID."""
        self._user_id = user_id
        self.async_write_ha_state()

    def add_points(self, points: int) -> None:
        """Add points to the team."""
        self._points += points
        self._last_round_points = points
        self.async_write_ha_state()

    def set_last_round_result(self, answer: str, correct: bool, points: int) -> None:
        """Set the results from the last round."""
        self._last_round_answer = answer
        self._last_round_correct = correct
        self._last_round_points = points
        self.async_write_ha_state()

    async def async_update(self) -> None:
        """Update the sensor."""
        _LOGGER.debug("Updating team %d sensor", self._team_number)


class HomeTriviaCountdownTimerSensor(HomeTriviaBaseSensor):
    """Sensor for the countdown timer length setting."""

    def __init__(self) -> None:
        """Initialize the countdown timer sensor."""
        self._attr_name = "Home Trivia Countdown Timer"
        self._attr_unique_id = "home_trivia_countdown_timer"
        self._attr_icon = "mdi:timer"
        self._timer_length = 30  # Default timer length in seconds

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            self._timer_length = int(last_state.state)
            _LOGGER.debug("Restored timer length: %d", self._timer_length)
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore timer length: %s", e)

    @property
    def state(self) -> int:
        """Return the state of the sensor."""
        return self._timer_length

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Countdown Timer Length",
            "unit_of_measurement": "seconds",
        }

    def update_timer_length(self, length: int) -> None:
        """Update the timer length."""
        self._timer_length = length
        self.async_write_ha_state()


class HomeTriviaCountdownCurrentSensor(SensorEntity):
    """Sensor for the current countdown timer value."""

    def __init__(self) -> None:
        """Initialize the countdown current sensor."""
        self._attr_name = "Home Trivia Countdown Current"
        self._attr_unique_id = "home_trivia_countdown_current"
        self._attr_icon = "mdi:timer-sand"
        self._current_time = 0
        self._is_running = False
        self._countdown_task = None
        self._initial_time = 0  # Store initial time for progress calculation

    @property
    def state(self) -> int:
        """Return the state of the sensor."""
        return self._current_time

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Current Countdown",
            "unit_of_measurement": "seconds",
            "is_running": self._is_running,
            "initial_time": self._initial_time,
        }

    async def _countdown_worker(self) -> None:
        """Worker coroutine that decrements the timer every second."""
        try:
            while self._is_running and self._current_time > 0:
                await asyncio.sleep(1)
                if self._is_running and self._current_time > 0:
                    self._current_time -= 1
                    self.async_write_ha_state()
                    _LOGGER.debug("Countdown timer: %d seconds remaining", self._current_time)
            
            # Timer reached zero
            if self._is_running and self._current_time <= 0:
                self._is_running = False
                self.async_write_ha_state()
                _LOGGER.info("Countdown timer reached zero")
                
                # Trigger round scoring when timer expires
                await self._trigger_round_scoring_on_timeout()
        except asyncio.CancelledError:
            _LOGGER.debug("Countdown timer task was cancelled")
        except Exception as e:
            _LOGGER.error("Error in countdown timer: %s", e)
            self._is_running = False
            self.async_write_ha_state()

    async def _trigger_round_scoring_on_timeout(self) -> None:
        """Trigger round scoring when timer expires."""
        try:
            # Get entities from hass data to trigger scoring
            entities = self.hass.data.get(DOMAIN, {}).get("entities", {})
            if entities:
                # Import the scoring function from __init__.py
                from . import _process_round_scoring
                await _process_round_scoring(entities)
                _LOGGER.info("Round scoring processed due to timer expiration")
            else:
                _LOGGER.warning("Could not find entities for round scoring on timeout")
        except Exception as e:
            _LOGGER.error("Error processing round scoring on timeout: %s", e)

    def start_countdown(self, initial_time: int) -> None:
        """Start the countdown timer."""
        # Stop any existing countdown
        self.stop_countdown()
        
        self._current_time = initial_time
        self._initial_time = initial_time  # Store initial time for progress calculation
        self._is_running = True
        self.async_write_ha_state()
        
        # Start the countdown task using Home Assistant's async framework
        if self.hass:
            self._countdown_task = self.hass.async_create_task(self._countdown_worker())
            _LOGGER.info("Started countdown timer for %d seconds", initial_time)

    def stop_countdown(self) -> None:
        """Stop the countdown timer."""
        self._is_running = False
        
        # Cancel the countdown task if it's running
        if self._countdown_task and not self._countdown_task.done():
            self._countdown_task.cancel()
            self._countdown_task = None
        
        self._current_time = 0
        self._initial_time = 0  # Reset initial time as well
        self.async_write_ha_state()
        _LOGGER.debug("Countdown timer stopped")

    def update_current_time(self, time: int) -> None:
        """Update the current countdown time."""
        self._current_time = time
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Called when entity will be removed from hass."""
        # Ensure we clean up the countdown task when the entity is removed
        self.stop_countdown()


class HomeTriviaCurrentQuestionSensor(SensorEntity):
    """Sensor for the currently active question."""

    def __init__(self) -> None:
        """Initialize the current question sensor."""
        self._attr_name = "Home Trivia Current Question"
        self._attr_unique_id = "home_trivia_current_question"
        self._attr_icon = "mdi:help-circle-outline"
        self._current_question = None

    @property
    def state(self) -> str:
        """Return the state of the sensor."""
        if self._current_question:
            return f"Question {self._current_question.get('question_id', 'Unknown')}"
        return "No Question"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        if self._current_question:
            return {
                "friendly_name": "Current Question",
                "question_id": self._current_question.get("question_id"),
                "category": self._current_question.get("category"),
                "question": self._current_question.get("question"),
                "answer_a": self._current_question.get("answer_a"),
                "answer_b": self._current_question.get("answer_b"),
                "answer_c": self._current_question.get("answer_c"),
                "correct_answer": self._current_question.get("correct_answer"),
                "fun_fact": self._current_question.get("fun_fact"),
                "difficulty_level": self._current_question.get("difficulty_level"),
            }
        return {
            "friendly_name": "Current Question",
            "question": None,
        }

    def update_current_question(self, question_data: dict) -> None:
        """Update the current question."""
        self._current_question = question_data
        self.async_write_ha_state()

    def clear_current_question(self) -> None:
        """Clear the current question."""
        self._current_question = None
        self.async_write_ha_state()


class HomeTriviaRoundCounterSensor(HomeTriviaBaseSensor):
    """Sensor for tracking the current round number."""

    def __init__(self) -> None:
        """Initialize the round counter sensor."""
        self._attr_name = "Home Trivia Round Counter"
        self._attr_unique_id = "home_trivia_round_counter"
        self._attr_icon = "mdi:counter"
        self._round_count = 0

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            self._round_count = int(last_state.state)
            _LOGGER.debug("Restored round count: %d", self._round_count)
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore round count: %s", e)

    @property
    def state(self) -> int:
        """Return the state of the sensor."""
        return self._round_count

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Round Counter",
        }

    def increment_round(self) -> None:
        """Increment the round counter."""
        self._round_count += 1
        self.async_write_ha_state()

    def reset_round_counter(self) -> None:
        """Reset the round counter."""
        self._round_count = 0
        self.async_write_ha_state()


class HomeTriviaPlayedQuestionsSensor(HomeTriviaBaseSensor):
    """Sensor for tracking played questions."""

    def __init__(self) -> None:
        """Initialize the played questions sensor."""
        self._attr_name = "Home Trivia Played Questions"
        self._attr_unique_id = "home_trivia_played_questions"
        self._attr_icon = "mdi:playlist-check"
        self._played_questions = 0
        self._played_question_ids = []

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            self._played_questions = int(last_state.state)
            if last_state.attributes and "played_question_ids" in last_state.attributes:
                self._played_question_ids = last_state.attributes["played_question_ids"]
            _LOGGER.debug("Restored played questions: %d", self._played_questions)
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore played questions: %s", e)

    @property
    def state(self) -> int:
        """Return the state of the sensor."""
        return self._played_questions

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Played Questions",
            "played_question_ids": self._played_question_ids,
        }

    def add_played_question(self, question_id: int) -> None:
        """Add a question to the played list."""
        if question_id not in self._played_question_ids:
            self._played_question_ids.append(question_id)
            self._played_questions = len(self._played_question_ids)
            self.async_write_ha_state()

    def reset_played_questions(self) -> None:
        """Reset the played questions list."""
        self._played_questions = 0
        self._played_question_ids = []
        self.async_write_ha_state()


class HomeTriviaHighscoreSensor(HomeTriviaBaseSensor):
    """Sensor for tracking high scores."""

    def __init__(self) -> None:
        """Initialize the highscore sensor."""
        self._attr_name = "Home Trivia Highscore"
        self._attr_unique_id = "home_trivia_highscore"
        self._attr_icon = "mdi:trophy"
        self._highscore_total = 0
        self._highscore_average = 0.0
        self._highscore_team = "No Team"
        self._total_rounds = 0

    async def _restore_state(self, last_state) -> None:
        """Restore state from last known state."""
        try:
            self._highscore_total = int(last_state.state)
            if last_state.attributes:
                self._highscore_average = float(last_state.attributes.get("average_points", 0.0))
                self._highscore_team = last_state.attributes.get("team_name", "No Team")
                self._total_rounds = int(last_state.attributes.get("total_rounds", 0))
            _LOGGER.debug("Restored highscore: %d", self._highscore_total)
        except (ValueError, TypeError) as e:
            _LOGGER.warning("Could not restore highscore: %s", e)

    @property
    def state(self) -> int:
        """Return the state of the sensor."""
        return self._highscore_total

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes."""
        return {
            "friendly_name": "Highscore",
            "total_points": self._highscore_total,
            "average_points": self._highscore_average,
            "team_name": self._highscore_team,
            "total_rounds": self._total_rounds,
        }

    def update_highscore(self, team_name: str, total_points: int, rounds_played: int) -> None:
        """Update the highscore if this is a new record."""
        if rounds_played > 0:
            average_points = total_points / rounds_played
            
            # Check if this beats the current high score (by average)
            if average_points > self._highscore_average:
                self._highscore_total = total_points
                self._highscore_average = average_points
                self._highscore_team = team_name
                self._total_rounds = rounds_played
                self.async_write_ha_state()
                _LOGGER.info("New highscore! %s: %d total, %.1f average", 
                           team_name, total_points, average_points)

    def reset_highscore(self) -> None:
        """Reset the highscore."""
        self._highscore_total = 0
        self._highscore_average = 0.0
        self._highscore_team = "No Team"
        self._total_rounds = 0
        self.async_write_ha_state()