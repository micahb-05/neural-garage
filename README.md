# Neural Garage

A 2D pixel-art idle/tycoon game. Your great-aunt Wren Calloway left you her repair garage in Halden
Falls, a battered helper robot named Pip, one tiny AI model, and a mystery: an unfinished project
called **LANTERN**. Hire AI models, put them to work on paid contracts, train them, grow the garage,
keep Obsidian Dynamics from buying you out, and finish what Wren started.

New players get a guided tutorial from Pip. The **? HELP** button has the full manual, and the
**STORY** tab replays any chapter you've unlocked.

## Play it

**In your browser:** play at **<https://micahb-05.github.io/neural-garage/>**

**Download it:** [download the ZIP](https://github.com/micahb-05/neural-garage/archive/refs/heads/main.zip), or click the
green **Code** button on this page and choose **Download ZIP**. Unzip it
and double-click `index.html`. There's nothing to install, and it works in Chrome, Edge, Firefox and Safari.

**From a terminal (optional):**

```bash
python -m http.server 8765
```

Run that inside the folder, then visit <http://localhost:8765>.

### Saving

The game autosaves to your browser every 5 seconds. **SAVE / LOAD** (top bar) can also download a
save file, or load one. Use that to back up your garage, move it to another computer or browser, or share
it with a friend. The garage keeps earning while you're away: the first hour is simulated exactly, and after that it
earns at half rate, up to 8 hours.

## How to play

| Loop | What you do |
| --- | --- |
| **Hire** | Buy models in MODELS. Each has speed, quality, skill affinities (CODE / DESIGN / WRITE / DATA / MEDIA), a compute footprint and a running cost per second. |
| **Use** | Put a model in a workbay and pick a contract. Pay depends on quality and skill fit, minus running cost. Output below the contract's quality bar gets rejected. |
| **Train** | Training pods add +1 level (speed and quality) and +0.12 to a chosen skill. The model leaves its bay and comes back when it's done. |
| **Upgrade** | Server racks (compute), GPUs (speed), client network (pay), cooling (running cost), more pods, the training lab, and more workbays. |

Every model you hire gets a little robot body that works at its desk and wanders off on errands:
checking server racks, hauling crates, poking the plasma orb. Hover a robot to see what it's doing,
and click Pip to chat. Reputation unlocks bigger contracts, better models and new story chapters. Market events double (or cut) demand for a
contract type, and GPU surges speed up everything. Click a working bay to push it along.

## Code map

| File | Role |
| --- | --- |
| `js/data.js` | All balance data: models, contracts, upgrades, titles, goals. **Tune the game here.** |
| `js/story.js` | The campaign: 10 chapters with unlock conditions and dialogue, plus Pip's quips |
| `js/tutorial.js` | Pip's 8-step guided tutorial (UI highlights and in-garage arrows) |
| `js/state.js` | State shape, derived stats (`calcJob` is the core economy formula), player actions, save/load |
| `js/sim.js` | Fixed-step tick: job completion, training, market events, offline catch-up |
| `js/world.js` | Canvas renderer for the 512×288 garage, drawn entirely from rects. It also runs the walking robots (one per hired model, plus Pip) on a lane graph with errands. Handles hit-testing |
| `js/pixel.js` | 3×5 bitmap font, string-art robot sprites, color helpers |
| `js/ui.js` | HUD, side-panel tabs, toasts, tooltip, modals |
| `js/main.js` | Boot, loop, canvas scaling, input, autosave |

## Credits

The concept is inspired by [StarNet](https://github.com/androoAGI/starnet)'s "rooms are teams, the layout
is the workflow" idea. No StarNet code, name, sprites or artwork is used. StarNet's MIT
license covers its code only, not its brand or art. All art here is original and drawn procedurally.
