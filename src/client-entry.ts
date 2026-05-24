/**
 * Project-side client entry point.
 * Imports the framework dispatcher and registers project-specific handlers.
 */

// Start the framework dispatcher
import "js-mvc/client/main";

// Register project handlers
import "./views/handlers/DismissHandler";
import "./views/handlers/ConfirmHandler";
import "./views/handlers/VoteHandler";
import "./views/handlers/StatusTransitionHandler";
import "./views/handlers/AddOptionHandler";
