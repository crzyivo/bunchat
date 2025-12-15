import Html from "@kitajs/html";

export default function Layout(props: { children: Html.Children; title?: string }) {
  return (
    <html lang="en">
      <head>
        <title>{props.title || "BunChat"} - IRC Style Chat</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="description" content="IRC-style chat application powered by Bun and Elysia" />
        <link rel="stylesheet" href="/css/style.css" />
      </head>
      <body>
        {props.children}
      </body>
    </html>
  );
}