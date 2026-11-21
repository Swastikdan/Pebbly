# Playback

`play-preview` (Play Preview) embeds Vidy. Enable its global flag in Admin
permissions and grant the Play Preview role to a user. It defaults to off and
follows the same global-flag-and-user-role rules as external redirects.

Play controls select the first available mode:

1. `play-preview`: open the embedded player in a dialog.
2. `external-redirect`: open the configured `VITE_PUBLIC_EXTERNAL_PLAYER_URL`
   using the existing `/watch/movie/...` or `/watch/tv/...` routes.
3. Neither: hide the play control.

Vidy uses TMDB `/movie/{id}` and `/tv/{id}/{season}/{episode}` routes (episode
and season default to 1). The player is an edge-to-edge full-screen dialog with
no header — only a close button floats over the video. The iframe fills the
screen instead of using a fixed 16:9 box, so it fills the current orientation
and rotates with the device. Opening it requests browser fullscreen so mobile
browser chrome is hidden when the browser supports it (iPhone Safari does not
support element fullscreen; the dialog still fills the viewport there). The
iframe delegates encrypted media, autoplay and fullscreen, and unmounts on close
to stop playback. TV embeds include episode selection, next episode, and
automatic next episode playback. Autoplay is requested; browser policy may still
require a click inside the frame.

The app's computed primary color is converted to six-digit RGB hex and sent via
Vidy's `color` query option when opening the player. Vidy documents accent color,
not a separate light/dark theme option. Player messages are not consumed.

Reference: https://www.vidy.st/#docs
