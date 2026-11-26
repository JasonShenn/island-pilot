// Deterministic screenshot states, driven by ?shot=start|play|end&seed=N.
// Each preset parks the plane, camera and HUD in a composed moment so the
// screenshots are real renders of the game, not staged pictures.
export function shotPreset(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot) return null;
  // start: lifting off the home strip, first ring dead ahead, HUD lit.
  if (shot === 'start') {
    return {
      name: 'start',
      plane: { x: 0, y: 26, z: 60, yaw: 0, pitch: 0.14, bank: 0, speed: 46, throttle: 0.85, fuel: 96, onGround: false },
      camera: { distance: 16, height: 5, lookAhead: 30 },
      toast: 'Harbor Island — throttle up and fly the rings!',
      mission: 'Ring 1/6 — 390 m ▲ ahead',
    };
  }
  // play: banking through the second ring with Palm Cay below.
  if (shot === 'play') {
    return {
      name: 'play',
      plane: { x: 640, y: 128, z: 620, yaw: 0.72, pitch: 0.02, bank: 0.42, speed: 68, throttle: 0.7, fuel: 71, onGround: false },
      camera: { distance: 17, height: 6, lookAhead: 34 },
      toast: 'Ring 1 cleared! +100',
      mission: 'Ring 2/6 — 180 m ▲ ahead',
    };
  }
  // end: flaring over Palm Cay's strip, stamp toast showing.
  if (shot === 'end') {
    return {
      name: 'end',
      plane: { x: 1150, y: 30, z: 800, yaw: Math.PI / 2, pitch: -0.05, bank: 0, speed: 42, throttle: 0.25, fuel: 58, onGround: false },
      camera: { distance: 15, height: 4, lookAhead: 26 },
      toast: 'On final — Palm Cay strip ahead, flare and touch down!',
      mission: 'Ring 3/6 — 210 m ▶ turn right',
    };
  }
  return null;
}
