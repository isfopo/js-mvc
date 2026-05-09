/**
 * ViewModel for the Home page.
 *
 * A ViewModel holds the typed data contract between a ViewBuilder and its
 * view component. Each page view has a corresponding ViewModel interface
 * that the ViewBuilder's method returns and the view FC receives as props.
 *
 * ┌──────────────┐    returns     ┌──────────────┐   props of    ┌──────────┐
 * │  ViewBuilder  │ ─────────────→ │  ViewModel   │ ────────────→ │  View    │
 * │  (data prep)  │               │  (interface) │               │  (JSX)   │
 * └──────────────┘               └──────────────┘               └──────────┘
 *
 * ViewModels live in src/view-models/ alongside their corresponding
 * view component in src/views/pages/.
 */

export interface HomeViewModel {
  today: Date;
}
