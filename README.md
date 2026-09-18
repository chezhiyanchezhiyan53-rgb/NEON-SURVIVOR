# Neon Survivor

Neon Survivor is a browser-based arcade survival shooter built with vanilla HTML, CSS, and JavaScript. Move through the neon arena, defeat enemy waves, build combo multipliers, collect power-ups, and survive boss encounters.

## Features

- Canvas-based arcade gameplay
- Desktop and mobile controls
- Three weapons: Normal, Spread, and Laser
- Power-ups including Shield, Slow Motion, Double Score, Rapid Fire, and Health
- Boss fights every five levels
- Local high-score table saved in the browser
- Sound effects with mute support
- No frameworks, dependencies, or build step

## Run Locally

Because this is a static web project, you can open `index.html` directly in a browser.

For a local development server, run one of these commands from the project folder:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

### Desktop

| Action | Control |
| --- | --- |
| Move | `WASD` or Arrow keys |
| Aim and shoot | Mouse and click |
| Activate shield | `Space` |
| Select weapon | `1`, `2`, or `3` |
| Pause | `P` |
| Mute sound | Speaker button |

### Mobile

Use the on-screen joystick to move and the `SHOOT`, `SHIELD`, and `PAUSE` buttons for actions.

## Gameplay

- Keep moving to avoid enemies and projectiles.
- Defeat enemies to earn points and increase your combo.
- Taking damage resets the combo multiplier.
- Collect glowing power-ups for temporary advantages.
- Every fifth level includes a boss encounter.
- High scores are stored locally in your browser with `localStorage`.

## Project Structure

```text
neon-survivor/
├── index.html   # Game markup and screens
├── style.css    # Visual styling and responsive layout
├── game.js      # Game loop, entities, input, audio, and scoring
└── README.md    # Project documentation
```

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. Open the repository on GitHub and select **Settings**.
3. Select **Pages** in the sidebar.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the `main` branch and the `/ (root)` folder.
6. Select **Save**.

GitHub will provide a public Pages URL after deployment finishes.

## License

No license has been specified for this project yet.
