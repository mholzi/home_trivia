"""Config flow for Home Trivia integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

DIFFICULTY_LEVELS = {
    "Kids": "🧒 Kids Level - Perfect for curious minds around 10 years old! Fun, colorful questions about animals, colors, and basic facts that will make learning exciting.",
    "Easy": "🎓 Easy Level - A-level knowledge! Great for testing what you learned in school with questions about geography, basic science, and history.",
    "Medium": "🏛️ Medium Level - University-level challenges! Dive deeper into literature, advanced science, and complex historical facts.",
    "Hard": "🧠 Hard Level - University-level knowledge! Mind-bending questions about advanced topics, philosophy, and specialized knowledge."
}


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Home Trivia."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        errors = {}

        if user_input is not None:
            # Store the configuration
            data = {
                "difficulty_level": user_input.get("difficulty_level", "Easy"),
                "team_count": user_input.get("team_count", 2),
                "timer_length": user_input.get("timer_length", 30),
            }
            
            return self.async_create_entry(title="Home Trivia", data=data)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("difficulty_level", default="Easy"): vol.In(list(DIFFICULTY_LEVELS.keys())),
                vol.Required("team_count", default=2): vol.All(vol.Coerce(int), vol.Range(min=1, max=5)),
                vol.Required("timer_length", default=30): vol.All(vol.Coerce(int), vol.Range(min=10, max=120)),
            }),
            description_placeholders={
                "difficulty_descriptions": "\n\n".join([f"**{level}**: {desc}" for level, desc in DIFFICULTY_LEVELS.items()])
            },
            errors=errors,
        )

    async def async_step_import(self, import_config: dict[str, Any]) -> FlowResult:
        """Handle import from YAML configuration."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title="Home Trivia", data={})