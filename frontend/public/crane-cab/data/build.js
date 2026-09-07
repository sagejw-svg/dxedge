// Build stamp. Data only, no logic beyond formatting.
//
// The committed value is always 'dev'. `.github/workflows/deploy.yml` rewrites
// this file IN THE PUBLISHED MIRROR ONLY (frontend/public/crane-cab/data/), just
// before the frontend build, so what ships carries the commit it was built from
// and the repo copy never churns. Running crane-cab-dev/ straight off
// `python3 -m http.server` therefore reads "dev build", which is correct: it is.
//
// The two placeholder strings below are matched literally by that workflow step,
// which fails the deploy if it cannot find them. test/regress.mjs guards the same
// pair, so renaming a field here breaks a check rather than silently shipping an
// unstamped build.
export const BUILD = { sha: 'dev', date: '' };

export function buildLabel() {
  if (!BUILD.sha || BUILD.sha === 'dev') return 'dev build';
  return BUILD.date ? `build ${BUILD.sha}, ${BUILD.date}` : `build ${BUILD.sha}`;
}
