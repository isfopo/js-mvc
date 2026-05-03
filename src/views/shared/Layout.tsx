import type { FC, JSXNode, PropsWithChildren } from "hono/jsx";

export const Layout: FC<PropsWithChildren<{ head?: JSXNode }>> = ({
  children,
  head,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="JS-MVC" />
        <title>JS-MVC</title>
        <link rel="stylesheet" href="/styles.css" />
        {head}
      </head>
      <body>
        <header>
          <nav>
            <ul>
              <li>
                <strong>js-mvc</strong>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
};
