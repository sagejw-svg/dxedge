// Mission data only. No logic. Positions are world meters: x along site east, z along site south,
// y up. Mast is at origin. Deck volumes are AABBs the load must not hit.
// wind.dir is the compass direction the wind blows FROM in degrees, 0 = site north,
// the same convention as the slew heading gauge.
// Adding a mission = adding an object here. missions.js does the rest.
// deck volumes are solid: the load may rest on a volume's top face but may not
// pass through it. An optional hole { min:[x,z], max:[x,z], floor } opens the
// deck over that footprint, which is what makes a below-deck landing possible.

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
    achievements: ['Radio Check']
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
    achievements: ['First Hook']
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
    achievements: ['Scaffold Kiss']
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
    achievements: ['Blind Trust']
  }
];
