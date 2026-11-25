# Vici, copied into this prototype

These files come unchanged from Vici, Victor Pflüger's design system
(<https://victorpflueger.github.io/ViciDesign/index.html>): version **v1.0.0** as it stands on main at commit **`20e47d7`**
(24 November 2026). That main already carries much of Vici 2.0: the How it works guide (`vc-guide`), the
2.0 byline, the key-figure rules (answer first, `vc-stat__was`), Presenting step by step with Play, Your turn,
`vc-attention`, the AI notice, short forms with their tooltip, the theme script for a strict security policy
(`vici-theme.js`), the rule that nothing is kept, the framework view with its item and block states, the risk matrix, the ring, the
horizon strip, the drop zone, the live-run dialog and the report with its running footer (`vc-report`), and the
prototype brief this prototype follows.
The version number stays 1.0.0 until 2.0 is released. The prototype loads these files from here rather than
from a CDN, so every page is served from this site alone.

| File here | What it is |
|---|---|
| `dist/vici.min.css` | Vici's stylesheet, which the page loads: tokens, light and dark theme, components, icons |
| `dist/vici.css` | The same stylesheet, not minified, for reading |
| `dist/vici-tokens.css` | The tokens alone, as custom properties |
| `dist/vici-icons.svg` | Vici's icons as one sprite |
| `dist/vici.js` | Vici's small script: theme toggle, tooltips, the How it works guide and the behaviours of its components |
| `dist/vici-theme.js` | Applies the remembered theme before the first paint, without an inline script; the page loads it in the head |
| `dist/tokens.json` | Vici's token values, light and dark, for scripts and tests (the colour checks read it) |
| `assets/fonts/*.woff2` | Bricolage Grotesque, Inter, JetBrains Mono and Vici Mask, as the stylesheet expects them |
| `assets/fonts/OFL-*.txt` | The SIL Open Font License of each font family |
| `assets/marks/*.png` | LinkedIn's [in] logo in black, white and LinkedIn blue, as LinkedIn publishes it |
| `assets/marks/github.svg` | GitHub's mark, from Octicons |
| `assets/marks/OCTICONS-LICENSE` | The licence of GitHub's mark |
| `assets/marks/README.md` | Where the marks come from and how they may be used |
| `assets/brand/portrait-96.jpg` | Victor's portrait, 96 × 96 px, for the byline |
| `LICENSE` | Vici's licence |

Keep the folder structure: the stylesheet finds the fonts at `../assets/fonts/`. Never edit these
files; a fix belongs in Vici and comes here with its next copy. `tests/vici-files.mjs` and
`tests/vici.mjs` compare every file with ViciDesign at the commit above.

**Licence.** `LICENSE` covers all of it: Vici's code and its Vici Mask font are MIT-licensed;
Bricolage Grotesque, Inter and JetBrains Mono are under the SIL Open Font License; Victor Pflüger's
name, portrait and logo are reserved for his own use; LinkedIn's and GitHub's marks belong to them.

**Updating.** Copy the same files from ViciDesign's main (its `dist/` folder, `assets/fonts/`,
`assets/marks/`, `assets/brand/portrait-96.jpg` and `LICENSE`) over these, change the commit above and
in the GitHub Actions workflow, then run the tests and look at the page in light and dark: a new copy may
rename a class or change a token.
