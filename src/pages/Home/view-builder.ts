import type { HomeViewModel } from "./view-model";

export const viewBuilder = {
  /** Props for the Home page index action. */
  index(): HomeViewModel {
    return {
      today: new Date(),
    };
  },
};
