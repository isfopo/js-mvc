/**
 * ViewModel for the Home page.
 *
 * A ViewModel holds the typed data contract between a ViewBuilder and its
 * view component. Each page view has a corresponding ViewModel interface
 * that the ViewBuilder's method returns and the view FC receives as props.
 */

export interface HomeViewModel {
  today: Date;
}
