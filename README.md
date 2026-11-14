# Minecraft: JavaScript Edition

A fan-made, Minecraft-style voxel sandbox that runs entirely in the browser. No Java, no
build step, no bundler, no server-side code — just static files you can drop on GitHub Pages.
Play it solo, or play it with a friend: same-browser rooms and serverless peer-to-peer
invites are built in.

![Gameplay](screenshots/gameplay.jpg)

**▶ Play:** <https://pythonEaterBoi.github.io/Minecraft-javascript-edition/>

If that link is not live yet, enable GitHub Pages once (see
[Deploying to GitHub Pages](#deploying-to-github-pages)); the site is deployed from `main`.
You can also run the game locally with any static file server —
see [Running locally](#running-locally).

## Contents

- [What you can do](#what-you-can-do)
- [Multiplayer](#multiplayer)
- [Controls](#controls)
- [Running locally](#running-locally)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Saved data](#saved-data)
- [Performance tips](#performance-tips)
- [Browser support](#browser-support)
- [Credits](#credits)

## What you can do

- **Explore an endless procedural world** — rolling plains, forests, deserts, snowy tundra,
  mountains, beaches and oceans, generated from a seed you can type in.
- **Dig and build** — break and place 27 block types, with a hotbar, block picker and a
  block highlight on whatever you are looking at.
- **First-person movement** — walk, sprint, jump, swim, dive, and toggle creative flight.
- **Day and night** — a ten-minute cycle with sunsets, sunrises, stars, drifting blocky
  clouds and colour-matched fog.
- **Pick up where you left off** — the world, your inventory and your exact position are
  saved in `localStorage` (autosave every 20 seconds, plus on pause/quit).
- **Play with a friend** — join a room in a second tab, or send a peer-to-peer invite code to
  someone on the other side of the internet. No server, no accounts.
- **Never need a mouse** — the whole game, including the menus, is playable from the keyboard.
- **Play on a phone or tablet** — on-screen joystick, drag-to-look and buttons for jumping,
  mining, placing, flying and the block picker.
- **Zero runtime downloads** — textures are painted procedurally into an atlas at boot, the
  sound effects are synthesized with the Web Audio API, and Three.js is vendored in the repo.

![Multiplayer](screenshots/multiplayer.jpg)

## Multiplayer

Open **Multiplayer** from the title screen or the pause menu. Both players keep their own
name (remembered in `localStorage`) and see a box avatar with a name tag above the head.

![Multiplayer menu](screenshots/multiplayer-menu.jpg)

### Same browser (rooms)

Two tabs or windows of the same browser can play together with no setup at all:

1. In one tab: **Multiplayer** → type a room name → **Join room**.
2. In the second tab: **Multiplayer** → the same room name → **Join room**.
3. The second tab loads the first tab's world — same seed, same block edits, same time of day.

Rooms use `BroadcastChannel`, so they only reach tabs of the same browser on the same
machine. For anything further away, use an invite.

### Across the internet (peer-to-peer)

The invite flow is a direct WebRTC connection — no server relays your world, and nothing is
uploaded anywhere. The "codes" are base64 SDP blobs, so they are long — that is normal.

1. **Host:** *Create invite code* and copy the code it shows.
2. Send that code to your friend however you like (chat, email, carrier pigeon).
3. **Friend:** paste it under *Joining a friend?* and press **Create answer code**.
4. The friend sends the answer code back.
5. **Host:** paste it under *2 · Paste your friend's answer code* and press
   **Finish connection**.
6. Both screens show *Connected* and you are in the same world.

If a connection cannot be established, one of the two networks is probably blocking direct
peer traffic (symmetric NAT); the game tries a public STUN server but there is no TURN relay
to fall back on.

### What is shared

| Shared | Details |
| --- | --- |
| World | The host's seed and every block edit are sent when you join, and edits made by either player afterwards appear for both. |
| Players | Position, look direction and flight state, ten times a second, drawn as interpolated avatars. |
| Time of day | The host owns the clock, so sunsets line up. |
| Names | Each player's chosen name, shown above their avatar and in the session list. |

Sessions are temporary by design: joining someone else's world does not touch your own
save, and your single-player world is exactly as you left it when you leave. The **● n
players** badge in the corner shows the session size; **Leave session** in the multiplayer
menu tears it down.

## Controls

### Desktop

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| `←` `→` `↑` `↓` | Look around (keyboard look) |
| Mouse | Look around (click **Play** to capture the mouse) |
| Left click | Break block (hold to keep breaking) |
| Right click | Place block |
| Middle click | Pick the targeted block into the hotbar |
| `V` | Break block (keyboard) — tap or hold |
| `B` | Place block (keyboard) — tap or hold |
| `Space` | Jump · swim up · fly up |
| `Shift` | Sprint · fly down · dive while swimming |
| `F` | Toggle flight |
| `1` – `9`, mouse wheel | Select a hotbar slot |
| `E` | Open the block picker |
| `T` | Freeze / resume the day–night cycle |
| `F3` | Debug overlay (position, chunk, biome, FPS) |
| `Esc` | Pause (also releases the mouse) |

The arrow keys turn the camera, so the whole game is playable without touching the mouse:
walk with `WASD`, look with the arrows, dig with `V`, build with `B`.

The **Settings** menu has render distance, mouse sensitivity, sound, clouds and the
day/night cycle; settings are remembered between visits.

### Menus from the keyboard

Every screen works without a mouse as well:

| Input | Action |
| --- | --- |
| `↑` `↓` / `←` `→` | Move between buttons and fields |
| `Home` / `End` | Jump to the first / last item |
| `Enter` / `Space` | Press the focused button |
| `Esc` | Close the menu or go back |
| `Enter` / `Space` (nothing focused) | Resume from the pause screen |

Focus is moved for you when a menu opens, so **Esc** then **Enter** resumes a paused game
without clicking, and the pause → **Multiplayer** screen is three arrow presses away.

### Touch

- **Left joystick** — move (push all the way to sprint).
- **Drag anywhere on the right** — look around.
- **Jump**, **Down**, **Mine**, **Place**, **Fly**, **Blocks**, **Menu** buttons on the right.

## Running locally

The game is plain ES modules, so it needs to be served over HTTP (opening `index.html`
from `file://` will be blocked by the browser's module rules). Any static server works:

```bash
# Python 3
python3 -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>. There is nothing to install and nothing to compile:
edit a file, refresh the page.

## Deploying to GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/ (root)`**, then **Save**.
5. Wait for the first deployment and open
   <https://pythonEaterBoi.github.io/Minecraft-javascript-edition/>.

Everything is committed in the form Pages needs:

- **`.nojekyll`** is present so Jekyll does not touch the files.
- All paths are **relative** (`./src/main.js`, `../vendor/three/...`), so the game also works
  from a project sub-path such as `/Minecraft-javascript-edition/`.
- There are **no build artefacts** to publish and no CDN requests to allow — the complete
  game, including Three.js, is in the repository.

## How it works

| Layer | Notes |
| --- | --- |
| Rendering | Three.js **r187** (vendored ESM build) with `MeshBasicMaterial`s; lighting is baked into vertex colours. |
| World | 16 × 128 × 16 chunks in a `Uint8Array`, generated on demand around the player and meshed in the background. |
| Meshing | One buffer per chunk per material class (opaque, water, glass). Faces get directional shading, ambient occlusion and a sky-depth term so caves and cliffs read without a light engine. |
| Terrain | Value-noise height fields with biomes, beaches, caves, ore veins and trees; everything is derived deterministically from the seed. |
| Textures | A 256 × 256 atlas painted at boot with 2D canvas — no image files, no network requests. |
| Player | Axis-aligned bounding box with swept collision, walking/sprinting/jumping, swimming and creative flight. |
| Sky | Gradient dome with sun, moon, stars, clouds on a drifting plane, plus fog that matches the horizon. |
| Audio | Short synthesized effects (dig, place, step, click) built with oscillators and noise buffers. |
| Multiplayer | `BroadcastChannel` rooms for same-browser play and an `RTCDataChannel` for invite-based play. The host is authoritative for the world, edits and the clock; joiners adopt its seed and edit list. |
| Persistence | One save slot in `localStorage`: seed, time, position, rotation, hotbar and block edits. |

## Project layout

```
index.html              page shell, UI screens and touch controls
styles/main.css         all UI styling (responsive, reduced-motion aware)
src/main.js             Game class: renderer, loop, state machine, save/load
  src/core/             noise and hashing helpers
  src/world/            blocks, atlas, chunks, terrain generation, mesher
  src/player/           input, physics, raycasting
  src/render/           sky dome, clouds, fog
  src/ui/               menus, HUD, hotbar, inventory, settings
  src/audio/            Web Audio sound effects
  src/net/              multiplayer session (rooms, WebRTC invites) and remote avatars
vendor/three/           Three.js r187 (MIT) + licence
screenshots/            images used by this README
```

## Saved data

| Key | Contents |
| --- | --- |
| `mje.save.v1` | Seed, time of day, player position/rotation, flight state, hotbar and block edits. |
| `mje.settings.v1` | Render distance, sensitivity and the sound/clouds/day-cycle toggles. |
| `mje.name.v1` | The player name used in multiplayer. |

**New World** replaces the current save; **Save & Quit to Title** writes it immediately.
Clearing site data in the browser starts over with the default seed. Multiplayer worlds are
never written to the save slot.

## Performance tips

- Lower **Render distance** first — it is the single biggest win (10 is the maximum, 7 the
  desktop default, 5 on touch devices).
- Turn off **Clouds** on very old machines; they are a full-screen transparent layer.
- The game renders at up to 2× device pixel ratio (1.5× on touch), so a high-DPI phone is
  doing more work than it looks like.

## Browser support

Any browser with **WebGL 2** and ES modules: current Chrome, Edge, Firefox and Safari
(desktop and mobile). If WebGL is unavailable the page shows a readable explanation instead
of a blank canvas. Pointer lock is used on desktop; touch devices get the on-screen controls.
Multiplayer needs `BroadcastChannel` (rooms) or WebRTC data channels (invites) — both are
available in all of those browsers, but WebRTC invites require the page to be served over
`https://` or `localhost`, which GitHub Pages provides.
`prefers-reduced-motion` is respected by the menus and animations.

## Credits

- Built with [Three.js](https://threejs.org/) r187 — MIT licence, see `vendor/three/LICENSE`.
- All textures, terrain and audio are generated in code; there are no third-party assets.
- Minecraft is a trademark of Mojang Studios / Microsoft. This is a non-commercial fan
  project and is not affiliated with or endorsed by Mojang or Microsoft.
