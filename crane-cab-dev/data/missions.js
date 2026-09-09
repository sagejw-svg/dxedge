// Mission data only. No logic. Positions are world meters: x along site east, z along site south,
// y up. Mast is at origin. Deck volumes are AABBs the load must not hit.
// wind.dir is the compass direction the wind blows FROM in degrees, 0 = site north,
// the same convention as the slew heading gauge.
// Adding a mission = adding an object here. missions.js does the rest.
// deck volumes are solid: the load may rest on a volume's top face but may not
// pass through it. An optional hole { min:[x,z], max:[x,z], floor } opens the
// deck over that footprint, which is what makes a below-deck landing possible.

// How far below a volume's top face the load may be and still be standing on it
// rather than buried in it. It has to be one number, not two: missions.js grants
// support inside this band and sensors.js suppresses the collision inside the
// same band, and when the two disagreed there was a strip on top of every volume
// that was neither solid nor supporting, wide enough to trolley a load straight
// through a parapet. Big enough to cover a few ticks of the fastest hoist and
// float noise on a shared face, and wider than the rope slack crane.js allows
// after touchdown (see ropeStop): a load standing on a face sits its slack below
// it, and if that put it outside this band, nudging a landed load off the volume
// and back on turned into a collision it could never recover from.
export const SUPPORT_REACH = 0.25;   // m

export const MISSIONS = [
  {
    id: 0,
    name: 'Radio check',
    tutorial: true,
    load: { mass: 900, size: [1.2, 1.0, 1.2] },
    // PHASE 3: moved from [22, 0, 0] so the guide node has a real correction to
    // call from the starting trolley position (radius 20, slew 0).
    pickup: { pos: [22, 0, 6] },
    landing: { pos: [22, 0, 12], tol: 0.4 },
    wind: { base: 2, gust: 0, dir: 270 },
    hookCam: true,
    script: 'radioCheck',
    deck: [],
    achievements: ['Radio Check'],
    par: 130
  },
  {
    id: 1,
    name: 'Truck unload',
    load: { mass: 1800, size: [2.4, 1.2, 1.2] },
    pickup: { pos: [30, 1.3, -6] },
    landing: { pos: [18, 0, 14], tol: 0.35 },
    wind: { base: 4, gust: 0, dir: 250 },
    hookCam: true,
    script: 'truckUnload',
    deck: [
      { name: 'truck bed', min: [26, 0, -8], max: [34, 1.3, -4] }
    ],
    achievements: ['First Hook'],
    par: 160
  },
  {
    id: 2,
    name: 'Scaffold landing',
    load: { mass: 1400, size: [1.8, 1.0, 1.8] },
    pickup: { pos: [28, 0, 10] },
    landing: { pos: [40, 12, -4], tol: 0.3 },
    wind: { base: 6, gust: 3, dir: 300 },
    hookCam: true,
    script: 'scaffold',
    deck: [
      { name: 'scaffold', min: [37, 0, -7], max: [43, 12, -1] }
    ],
    achievements: ['Scaffold Kiss'],
    par: 190
  },
  {
    id: 3,
    name: 'Blind shaft',
    load: { mass: 1100, size: [1.4, 1.4, 1.4] },
    pickup: { pos: [24, 0, 16] },
    landing: { pos: [36, -9, 4], tol: 0.3 },
    // The deck is open here, so the floor under this footprint is the shaft
    // bottom rather than deck level. Without it the load rests on the deck at
    // y 0, the shaft is unreachable, and because the win only measures
    // horizontal distance the lift could be won by hovering over the hole.
    hole: { min: [33.5, 1.5], max: [38.5, 6.5], floor: -9 },
    wind: { base: 3, gust: 0, dir: 240 },
    hookCam: false,
    script: 'blindShaft',
    deck: [
      { name: 'shaft wall n', min: [33, -10, 1], max: [39, 2, 1.5] },
      { name: 'shaft wall s', min: [33, -10, 6.5], max: [39, 2, 7] },
      { name: 'shaft wall e', min: [38.5, -10, 1], max: [39, 2, 7] },
      { name: 'shaft wall w', min: [33, -10, 1], max: [33.5, 2, 7] }
    ],
    achievements: ['Blind Trust'],
    par: 210
  },
  {
    // Jacob's jobs. Three lifts past the shaft, added after he play-tested the
    // first four. Each one asks for a different thing: the chart, precision, and
    // a route. None of them is a harder version of an earlier one.
    id: 4,
    name: 'Out at range',
    // Light on the ground and heavy at the end of the jib. The whole job is the
    // load chart: 1000 kg is 28 percent of rated where it is picked up and 64
    // percent where it is set down, and a sloppy swing on the way out pushes the
    // dynamic reading past seventy five. Nothing here is close to the 100 percent
    // lockout, on purpose. This is the lift that teaches the operator to watch
    // the gauge, not the lift that fails him for it.
    load: { mass: 1000, size: [1.6, 1.0, 1.6] },
    pickup: { pos: [14, 0.9, -18] },
    landing: { pos: [44, 0, 16], tol: 0.35 },
    wind: { base: 7, gust: 3, dir: 220 },
    hookCam: true,
    script: 'atRange',
    deck: [
      { name: 'pipe rack', min: [11, 0, -21], max: [17, 0.9, -15] }
    ],
    achievements: ['Out At Range'],
    par: 190
  },
  {
    id: 5,
    name: 'Between the stacks',
    // A four metre slot between two six metre stacks of forms, with the load
    // 1.4 m across: 1.3 m of air on each side. The slot runs radially, so an
    // error in the trolley is forgiving and an error in the slew is not, which
    // makes this the slew job. At 34 m of radius, 1.3 m is 2.2 degrees of slew
    // and about the same of swing, so it has to go in dead plumb.
    load: { mass: 1500, size: [1.4, 1.2, 1.4] },
    pickup: { pos: [20, 0, 18] },
    landing: { pos: [34, 0, 0], tol: 0.3 },
    wind: { base: 5, gust: 2, dir: 90 },
    hookCam: true,
    script: 'stacks',
    deck: [
      { name: 'stack north', min: [30, 0, -6], max: [38, 6, -2] },
      { name: 'stack south', min: [30, 0, 2], max: [38, 6, 6] }
    ],
    achievements: ['Threading It'],
    par: 200
  },
  {
    id: 6,
    name: 'Round the core',
    // The lift and shaft core has climbed to 38 m, four metres under the cab and
    // well over anything the block can clear with rope to spare. It sits square
    // across the short arc between the two pads, from 24 m of radius out to 36.
    // There are two honest ways past it and the operator picks one: trolley
    // inside it and slew across close in, or take the whole load the long way
    // round the back of the site. Ground briefs the long way, because that is
    // what a banksman who cannot see the far side of the core would say.
    load: { mass: 1600, size: [2.0, 1.0, 1.4] },
    pickup: { pos: [12, 0, 28] },
    landing: { pos: [14, 0, -26], tol: 0.35 },
    wind: { base: 5, gust: 2, dir: 200 },
    hookCam: true,
    script: 'core',
    deck: [
      { name: 'core', min: [24, 0, -8], max: [36, 38, 8] }
    ],
    achievements: ['Round The Core'],
    par: 240
  }
];
