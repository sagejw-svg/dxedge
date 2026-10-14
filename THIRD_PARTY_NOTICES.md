# Third-party notices

## Freeverb

The master reverb follows the structure of Freeverb by Jezar at Dreampoint (about 2000),
which was placed in the public domain. The design is eight parallel comb filters with a
one-pole damper in the feedback, then four series allpass filters, a second set for the
right channel, and these delay lengths at 44.1 kHz:

- combs: 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 samples
- allpasses: 556, 441, 341, 225 samples
- the right channel is 23 samples longer

A description is at <https://ccrma.stanford.edu/~jos/pasp/Freeverb.html>.

The JavaScript in `frontend/public/synth/master.worklet.js` was written for this project
from that published description. It is not a copy of the Freeverb C++ sources.
Public domain does not require attribution; this notice is here because the design is used.
