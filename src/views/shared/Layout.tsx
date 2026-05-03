import type { FC, JSXNode, PropsWithChildren } from "hono/jsx";
import styles from "../../../public/styles/home.css?raw";

interface LayoutProps extends PropsWithChildren {
  route?: string;
  head?: JSXNode;
}

const cssCache: Record<string, string> = {
  home: styles,
};

export const Layout: FC<LayoutProps> = ({ children, route = "home", head }) => {
  const css = cssCache[route] || cssCache["home"] || "/* CSS not loaded */";

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="JS-MVC" />
        <title>JS-MVC</title>
        <style>{css}</style>
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
