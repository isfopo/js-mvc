export class NotFoundError extends Error {
  override name: string = "Not Found";
  override message: string = "Could not be found.";
}
