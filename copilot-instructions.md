# GitHub Copilot Instructions for Home Trivia Home Assistant Integration

Welcome to the **Home Trivia** Home Assistant party game! This repository contains a custom integration designed to provide a seamless, plug-and-play experience for Home Assistant users, along with a Lovelace card for easy UI interaction. Please follow these instructions to ensure all development aligns with project goals and user expectations.

---

## General Principles

- **Zero-Setup Philosophy**: All features, dependencies, and UI components must be automatically included and configured by the integration. Users should not need to perform manual setup steps beyond installing the integration.
- **Bundled Lovelace Card**: The integration must provide a Lovelace UI card out of the box, so users can add and use the game directly from the Home Assistant dashboard.
- **Cross-Language Support**: Code is a mix of JavaScript (for the frontend) and Python (for the backend integration). Maintain clear interfaces and documentation between these components.
- **User Experience**: Prioritize a fun, intuitive experience. All configuration should be possible via the Home Assistant UI, not YAML or code edits.

---

## Development Guidelines

### 1. Directory Structure

- `custom_components/home_trivia/`: Python backend for Home Assistant integration.
- `home_trivia_lovelace/` or `www/community/home_trivia/`: JavaScript frontend for the Lovelace card.
- `README.md`: Always update documentation with each release.
- `copilot-instructions.md`: (this file) Reference for Copilot and contributors.

### 2. Integration Packaging

- All frontend assets (JS, CSS, images) must be served by the integration or included in the repository.
- Use Home Assistant's `resources:` to register the Lovelace card automatically if possible.
- Provide manifest and version files as required by Home Assistant custom integrations.

### 3. Lovelace Card

- The card should be pre-configured and discoverable after installation.
- No manual editing of `ui-lovelace.yaml` should be required.
- Support all major themes and mobile responsiveness. The usage will be predominantly on mobile. 

### 4. Setup & Configuration

- Use config flows (`config_flow.py`) for any setup—never require YAML.
- All settings (game options, UI preferences) must be adjustable from Home Assistant's web UI.
- Use a splash screen to capture all critical input data for the game with appropriate error messages an explanantions

### 5. Testing

- Provide thorough unit and integration tests for both backend and frontend code.
- Use Home Assistant's test tools for Python and appropriate frameworks for JS.

---

## Pull Request Checklist

- [ ] All new features are plug-and-play and require no manual setup.
- [ ] Lovelace card is bundled and auto-registered.
- [ ] `README.md` is updated with major changes to the design or functionality. Please make it salesy and not too long..
- [ ] Integration and UI are fully documented.
- [ ] No manual configuration (YAML or file edits) is required for users.
- [ ] Tests are updated and passing.

---

## Additional Notes

- Reference Home Assistant developer docs for best practices.
- If adding dependencies, ensure they are handled automatically by the integration.
- Keep code and instructions beginner-friendly where possible.

---

Thank you for contributing to Home Trivia and helping make Home Assistant even more fun!
