import { NotFoundError } from "../errors";

export class HomeService {
  index() {
    throw new NotFoundError("nope, not here");

    return {
      today: new Date(),
    };
  }
}
