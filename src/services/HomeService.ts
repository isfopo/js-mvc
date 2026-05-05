import { NotFoundError } from "../errors/NotFoundError";

export class HomeService {
  index() {
    throw new NotFoundError("nope, not here");

    return {
      today: new Date(),
    };
  }
}
