# Epicyon — Simulation only

Includes the current STL assembly, unchanged three-DOF leg motion and IK,
forward/backward travel, turning, sit, tail motion, sliders, joint axes,
servo guides, live estimated joint loads, obstacle sensing, and sliding
object-to-object collisions. No portfolio, shopping list or wiring pages.

## Run locally
1. Extract the complete ZIP.
2. On macOS, double-click `Start Epicyon.command`. If macOS blocks it,
   right-click it once and choose **Open**.
3. Keep the Terminal window open while using the preview. Control-C stops it.

Manual start: open a terminal in this folder and run `python3 serve.py 8080`
(Windows: `py serve.py 8080`), then open http://localhost:8080.
For another port, replace 8080 with an unused port such as 8081.

Do not double-click index.html: browsers restrict loading local STL files
and JavaScript modules over file://. Python 3 and a WebGL-capable browser
are required. Internet access loads Three.js 0.180.0 from jsDelivr; all
model assets are included locally.

To use static website hosting, upload this folder's contents with index.html
at the site root. No compilation or package installation is needed.

## Notes
Motion/loads/travel/obstacle modules and STL assets match the latest portfolio.
The HTML and entry script have been isolated to render only one simulation.
Torque uses assumed mass and quasi-static geometry, not measured forces;
pushing forces and impacts are excluded from displayed torque. Props slide
upright with equal effective masses and simplified collision footprints.
See assets/obstacles/CREDITS.md for the traffic-cone attribution.
