/**
 * Light/dark handling.
 *
 * The default is whatever the device is set to — an older person who
 * has already turned their phone to dark should not have to ask for it
 * again here. A choice made inside the app is remembered on the device
 * and applied before the first paint, which is what this script is for:
 * without it the page renders light for a frame and then jumps.
 *
 * It is stored on the device rather than in the database on purpose.
 * Theme is a property of the screen you are looking at, and the same
 * account is used from a phone in a bright kitchen and a tablet at
 * night.
 */

export const THEME_STORAGE_KEY = "cognisaarthi.theme";

export type ThemeChoice = "light" | "dark" | "system";

const SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function ThemeScript() {
  return (
    <script
      // Must run synchronously in <head>; there is no React-side
      // equivalent that beats the first paint.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
