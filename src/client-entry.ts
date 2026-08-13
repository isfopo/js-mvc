/**
 * Project-side client entry point.
 *
 * Registers project handler classes with the hydration runtime and
 * re-exports hydrate() for the inline scripts emitted by useHandler.
 */

import { register } from "js-mvc/client/main";
import { AddOptionHandler } from "./views/handlers/AddOptionHandler";
import { ConfirmHandler } from "./views/handlers/ConfirmHandler";
import { DismissHandler } from "./views/handlers/DismissHandler";
import { StatusHandler } from "./views/handlers/StatusHandler";
import { VoteHandler } from "./views/handlers/VoteHandler";

register(AddOptionHandler);
register(ConfirmHandler);
register(DismissHandler);
register(StatusHandler);
register(VoteHandler);

export { hydrate } from "js-mvc/client/main";
