/**
 * ViewBuilders build the typed props objects that are passed to page views.
 *
 * Each method on a ViewBuilder corresponds to a controller action and
 * returns a props object matching the view's Props interface. This keeps
 * data preparation (queries, calculations, formatting) out of controllers
 * and views.
 *
 * ┌──────────────┐     calls      ┌──────────────┐    returns    ┌──────────┐
 * │  Controller   │ ─────────────→ │  ViewBuilder  │ ────────────→ │  View    │
 * │  (routing)    │                │  (data prep)  │               │  (JSX)   │
 * └──────────────┘                └──────────────┘               └──────────┘
 *
 * Usage in a controller:
 *
 *   class HomeController extends ControllerBase {
 *     viewBuilder = new HomeViewBuilder();
 *
 *     @Get("/")
 *     index({ render }: Context) {
 *       return render(<Home {...this.viewBuilder.index()} />);
 *     }
 *   }
 *
 * ViewBuilder methods are synchronous or async — the controller awaits
 * the result before passing it as JSX props:
 *
 *   async dashboard({ render }: Context) {
 *     return render(<Dashboard {...await this.viewBuilder.dashboard()} />);
 *   }
 */

export class HomeViewBuilder {
  /** Props for the Home page index action. */
  index() {
    return {
      today: new Date(),
    };
  }
}
