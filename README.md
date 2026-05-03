```bash
npm install
npm run dev
```

```bash
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```


This is roughly following a MVC pattern, although some key terminology has been changed to fit in with the Javascript ecosystem. "Controllers", as they are typically called, are called "Handlers". "ViewModel" maps to "Props",  which are defined in the same files as their views for easy access.
