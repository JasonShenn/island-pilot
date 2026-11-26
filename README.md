# Island Pilot — a bush-plane island hop

Take off from Harbor Island, thread all 6 golden rings, and land on Palm Cay,
Turtle Bay and Volcano Rock to collect their stamps — then bring her home.
Fuel is real: land on a strip to refuel. Wind pushes you east; mind it on
final approach.

## Controls

- **↑ / ↓** pitch · **← / →** bank & turn · **W / S** throttle
- **Drag** look around · **P** pause · **M** sound · **R** restart

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built for the make.fun best-flight-game bounty with Three.js (vendored under
`game/vendor/`) and no other library. All game code is original, written for
this entry.
