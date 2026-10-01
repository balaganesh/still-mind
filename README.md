# Still Mind

A deliberately minimal, installable meditation timer. Choose a multiple of 15 minutes, listen to an optional flowing-water background, and hear a bell at every 15-minute interval.

**Live app:** https://stillwater-zeta.vercel.app

There is no framework, account, analytics service, database, or build step. The app is plain HTML, CSS, and JavaScript.

## Run locally

Serve this directory over HTTP, for example with `npx serve .`, then open the displayed address. Service workers and installation require localhost or HTTPS.

## Deploy to Vercel

Import this directory as a new Vercel project. No framework preset, build command, or environment variables are required.

## Audio

`public/audio/flowing-water.mp3` is a seamless five-minute encode derived from “Flowing-water-100019.ogg” by Wikimedia Commons user Fg2, released into the public domain: https://commons.wikimedia.org/wiki/File:Flowing-water-100019.ogg

The deployed version uses a separately licensed temple-bell recording that is not redistributed in this repository. Downloaded copies automatically use the built-in synthesized bell unless you provide your own licensed file at `public/audio/temple-bell.mp3`.

## License

The application code is available under the MIT License. The public-domain water recording retains its original public-domain status.
