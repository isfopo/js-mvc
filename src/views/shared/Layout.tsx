import type { FC } from "hono/jsx";

export const Layout: FC = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="JS-MVC" />
        <title>JS-MVC</title>
        {/*<link rel="stylesheet" href="/styles.css" />*/}
      </head>
      <header>
        <h1>js-mvc</h1>
      </header>
      <body>{children}</body>
    </html>
  );
};
