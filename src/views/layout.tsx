export default function Layout(props: { children: JSX.Element }) {
  return (
    <html>
      <head>
        <title>Chat</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />

        <meta
          name="description"
          content="Find Spotify content on YouTube, Deezer, Apple Music, Tidal, SoundCloud and more."
        />
        <meta
          name="keywords"
          content="Spotify,YouTube,Deezer,Apple Music,Tidal,SoundCloud,converter,search,listen"
        />
        <meta name="htmx-config" content='{"defaultSwapStyle":"outerHTML"}' />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css"/>
        <link rel="stylesheet" href="/loading.css"/>
        <script src="https://unpkg.com/htmx.org@1.9.11" integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0" crossorigin="anonymous"></script>
        <script src="https://unpkg.com/htmx.org@1.9.11/dist/ext/ws.js"></script>
      </head>

      <body>{props.children}</body>

      <script
        defer
        src="https://kit.fontawesome.com/f559975e2f.js"
        crossorigin="anonymous"
      />
    </html>
  );
}