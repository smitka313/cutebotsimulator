# Cutebot Code Lab

A MakeCode-style block editor for the BBC micro:bit with a virtual ELECFREAKS Cutebot.
Students build programs with blocks, test them in a simulated arena, prove they
completed challenges, and copy the code into MakeCode to run on a real Cutebot.

## Put it on GitHub Pages

The ready-to-host copy is already built in `docs/`.

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the `main` branch and the `/docs` folder, and save.
3. After a minute or two the site is at `https://<your-user>.github.io/<repo>/`.

After you edit the source files, run `python3 tools/build-site.py` to rebuild `docs/`, then commit and push.

Edit the source files in the project root (`index.html`, `js/`, `media/`), not the copies in `docs/`.
The root `index.html` is written for claude.ai artifacts (no `<!doctype>`/`<head>`); the build adds those.

The page loads Blockly 11.2.1 from unpkg.com and fonts from Google Fonts, so students need internet access.
Everything else runs in the browser. There is no server and no student accounts.

## How students turn in work

* **Real-world mode is on by default.** The motors are slightly uneven, they stall below 15 % speed, and the sonar and line
  sensors are a little noisy, so programs that work here are more likely to work on a real Cutebot. Students can switch it off
  for a perfect robot; proofs made that way are marked *ideal* in the teacher panel.
* **Challenges tab:** pick a challenge, write a program, press **Run**. A passing run saves a *proof* in the browser:
  the exact programs for both micro:bits, a random seed, the starting sensor values, and every button press with its time.
  The best time per challenge is kept.
* **Turn in:** the student types their name and class, ticks challenges, and downloads one `.cutebot.json` file
  with their project and the proofs. They hand it in however you like (Google Classroom, email, a shared drive).

Proofs and projects are kept in that browser's storage. If students switch computers or clear browser data, they
should keep their turn-in or project files.

## How the teacher checks work

Open the same site and click **Teacher**, then add the files (many at once, or drag them in).

Each proof is **replayed from scratch** in your browser with the student's own program, seed and button presses.
The simulator is deterministic: it runs in fixed 5 ms steps with seeded randomness and exact geometry, so the
same inputs always give the same result.

* ✓ the replay passed in the same time as the file says.
* ! the replay passed, but the time in the file was changed.
* ✗ the replay did not pass (for example the program was edited after the run, or the file was tampered with).

The only way to get a ✓ is a program that really passes. Click any result to see the code that was used and to
**watch the replay** in the arena. **Same code as …** flags students whose generated code is identical.
**Download results (CSV)** gives one row per student for a gradebook.

Known limits:
* A student could still hand in a classmate's working program. The "Same code as" flag catches straight copies.
* Check work with the same version of the site the students used. If you change the simulator or the blocks later,
  bump `L.VERSION` in `js/data.js`. Older proofs then show a version note, and some may no longer replay.
* Replays are checked in Chrome. Other browsers should match, but tiny maths differences between browser engines
  could in rare cases change a long, borderline run.

## Running the code on a real Cutebot

**Send to real Cutebot** shows MakeCode JavaScript. In makecode.microbit.org, add the **cutebot** extension, switch
to JavaScript, paste, switch back to Blocks, and download. The generated code is type-checked against MakeCode's
micro:bit libraries and the ELECFREAKS Cutebot and NeoPixel extensions.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and styles |
| `js/data.js` | Constants, fonts, icons, notes, version |
| `js/sim.js` | Arena maps, physics, sensors, drawing |
| `js/runtime.js` | Simulated clock, the two virtual micro:bits, MakeCode-named APIs, recording and replay |
| `js/blocks.js` | Block definitions, code generator, toolbox |
| `js/content.js` | Examples, challenges, lessons |
| `js/app.js` | User interface, turn-in, teacher panel |
| `media/` | Icons used by the block editor (trash can, dropdown arrows) |
| `tools/build-site.py` | Builds the GitHub Pages copy in `docs/` |
| `docs/` | The built site that GitHub Pages serves. Don't edit it by hand. |

## Credits

* Block editor: [Blockly](https://github.com/google/blockly) by Google (Apache License 2.0), loaded from unpkg.com.
  The files in `media/` are Blockly's own icons.
* Cutebot block names and behaviour follow the [ELECFREAKS pxt-cutebot extension](https://github.com/elecfreaks/pxt-cutebot).
* micro:bit block names follow [Microsoft MakeCode for micro:bit](https://makecode.microbit.org/).
  This project is not made by or affiliated with Microsoft, the Micro:bit Educational Foundation or ELECFREAKS.
