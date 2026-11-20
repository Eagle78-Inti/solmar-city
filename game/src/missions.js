// Solmar City — missions: a seven-job story, from Marta's first wheels to
// the bank heist. Each mission is steps; the runner tracks the current step,
// shows the beacon and the objective, and pays out on the last one.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var MISSIONS = [
    {
      name: 'First Wheels', brief: 'Marta needs wheels. Steal a car and bring it to her drop-off.',
      payout: 1350, respect: 10,
      steps: [
        { type: 'goto', x: -8, z: -8, r: 6, text: 'Go see Marta at the corner' },
        { type: 'enter', kind: 'car', text: 'Steal a car (press E beside one)' },
        { type: 'driveTo', x: 56, z: 84, r: 8, text: 'Drive the car to the drop-off in Neon Mile' },
      ],
    },
    {
      name: 'Neon Nights', brief: 'Lucia is waiting in Neon Mile. Pick her up and take her to the casino.',
      payout: 1800, respect: 15,
      steps: [
        { type: 'goto', x: 84, z: -28, r: 6, text: 'Go to Neon Mile and find Lucia' },
        { type: 'enter', kind: 'car', text: 'Get in a car — Lucia is coming with you' },
        { type: 'driveTo', x: 112, z: 28, r: 8, text: 'Drive Lucia to the casino' },
      ],
    },
    {
      name: 'Harbor Run', brief: 'A package needs to cross the bay. Take a boat out to the far buoy and back.',
      payout: 2200, respect: 15,
      steps: [
        { type: 'goto', x: -168, z: -40, r: 8, text: 'Get to the marina' },
        { type: 'enter', kind: 'boat', text: 'Take a boat (press E beside one)' },
        { type: 'driveTo', x: -300, z: 60, r: 12, text: 'Sail out to the far buoy' },
        { type: 'driveTo', x: -196, z: -40, r: 10, text: 'Bring the package back to the pier' },
      ],
    },
    {
      name: 'The Getaway', brief: 'A sports car is waiting downtown. Take it — then lose the heat and park it at the garage.',
      payout: 3000, respect: 20,
      steps: [
        { type: 'goto', x: 28, z: 28, r: 8, text: 'Find the sports car downtown' },
        { type: 'enter', kind: 'sports', text: 'Steal the sports car' },
        { type: 'survive', stars: 1, text: 'Lose the heat — get your wanted level down to 1 star' },
        { type: 'driveTo', x: -84, z: 130, r: 9, text: 'Park the car at Sunset Garage' },
      ],
    },
    {
      name: 'Set Up', brief: 'It was a trap. The warehouse job was an ambush — survive the night and slip away.',
      payout: 3000, respect: 20,
      steps: [
        { type: 'goto', x: -56, z: -112, r: 8, text: 'Go to the warehouse at nightfall' },
        { type: 'ambush', text: 'It is a setup — run! The police are coming' },
        { type: 'survive', stars: 1, text: 'Lose the heat — get your wanted level down to 1 star' },
      ],
    },
    {
      name: 'Harbor Lights', brief: 'The buyer wants the white yacht. Steal it from the marina and sail it to the far pier — under 4 stars.',
      payout: 3350, respect: 20,
      steps: [
        { type: 'goto', x: -196, z: -40, r: 8, text: 'Get to the marina' },
        { type: 'enter', kind: 'yacht', text: 'Steal the white yacht' },
        { type: 'driveTo', x: -300, z: -120, r: 14, text: 'Sail the yacht to the far pier' },
      ],
    },
    {
      name: 'The Big One', brief: 'Solmar Bank. One vault, one getaway, one legend. Rob it and bring the cash home.',
      payout: 4500, respect: 0,
      steps: [
        { type: 'goto', x: 28, z: -28, r: 8, text: 'Get to Solmar Bank' },
        { type: 'rob', seconds: 10, text: 'Crack the vault — stay inside the bank' },
        { type: 'driveTo', x: -84, z: 130, r: 9, text: 'Escape to Sunset Garage with the cash' },
      ],
    },
  ];
  SOL.MISSIONS = MISSIONS;

  var beacon = null, beaconRing = null, beaconLight = null;
  function makeBeacon() {
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beaconRing = new THREE.Mesh(new THREE.RingGeometry(3, 4.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    beaconRing.rotation.x = -Math.PI / 2;
    beaconLight = SOL.glowSprite(0xffd75e, 12, 0.5);
    SOL.scene.add(beacon); SOL.scene.add(beaconRing); SOL.scene.add(beaconLight);
    hideBeacon();
  }
  function showBeacon(x, z) {
    if (!beacon) makeBeacon();
    beacon.visible = true; beaconRing.visible = true; beaconLight.visible = true;
    beacon.position.set(x, 17, z);
    beaconRing.position.set(x, 0.15, z);
    beaconLight.position.set(x, 4, z);
    SOL.missionTarget = { x: x, z: z };
  }
  function hideBeacon() {
    if (beacon) { beacon.visible = false; beaconRing.visible = false; beaconLight.visible = false; }
    SOL.missionTarget = null;
  }
  SOL.showBeacon = showBeacon; SOL.hideBeacon = hideBeacon;

  var mState = { index: -1, step: 0, active: false, robT: 0, ambushSet: false, nextDelay: 0 };
  SOL.missionState = mState;

  function startMission(i) {
    if (i >= MISSIONS.length) { mState.active = false; hideBeacon(); return false; }
    var m = MISSIONS[i];
    mState.index = i; mState.step = 0; mState.active = true;
    mState.robT = 0; mState.ambushSet = false;
    SOL.hudToast('MISSION — ' + m.name, m.brief);
    SOL.setObjective(m.name, m.steps[0].text);
    updateStepTarget();
    return true;
  }
  SOL.startMission = startMission;

  function updateStepTarget() {
    var m = MISSIONS[mState.index];
    var s = m.steps[mState.step];
    if (!s) return;
    if (s.type === 'goto' || s.type === 'driveTo') showBeacon(s.x, s.z);
    else if (s.type === 'rob') showBeacon(28, -28);
    else hideBeacon();
    SOL.setObjective(m.name, s.text);
  }

  function completeStep() {
    var m = MISSIONS[mState.index];
    mState.step++;
    mState.robT = 0; mState.ambushSet = false;
    if (mState.step >= m.steps.length) completeMission();
    else updateStepTarget();
  }
  SOL.completeStep = completeStep;

  function completeMission() {
    var m = MISSIONS[mState.index];
    var st = SOL.state;
    st.cash += m.payout;
    st.respect = Math.min(100, st.respect + m.respect);
    st.missionsDone = (st.missionsDone || 0) + 1;
    SOL.hudToast('MISSION PASSED — ' + m.name, '+$' + m.payout + '  ·  respect +' + m.respect);
    SOL.saveGame();
    hideBeacon();
    mState.active = false;
    mState.nextDelay = 2.5;
  }

  function updateMissions(dt) {
    if (!mState.active) {
      if (mState.nextDelay > 0) {
        mState.nextDelay -= dt;
        if (mState.nextDelay <= 0) startMission(mState.index + 1);
      }
      return;
    }
    var m = MISSIONS[mState.index];
    var s = m.steps[mState.step];
    var p = SOL.player;
    if (!s) return;
    if (s.type === 'goto' || s.type === 'driveTo') {
      var d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r) completeStep();
    } else if (s.type === 'ambush') {
      if (!mState.ambushSet) {
        mState.ambushSet = true;
        SOL.setTimeOfDay(22.5);
        SOL.addWanted(4, 'ambushed');
        SOL.hudToast('IT\'S A SETUP — RUN!', 'Four stars. Lose the heat.');
      }
      completeStep();
    } else if (s.type === 'survive') {
      if (SOL.state.wanted <= s.stars) completeStep();
    } else if (s.type === 'rob') {
      var d2 = Math.hypot(p.x - 28, p.z - (-28));
      if (d2 < 10) {
        mState.robT += dt;
        SOL.setObjective(m.name, 'Cracking the vault… ' + Math.ceil(s.seconds - mState.robT) + 's — stay inside!');
        if (SOL.state.wanted < 4) SOL.addWanted(1, 'robbing the bank');
        if (mState.robT >= s.seconds) completeStep();
      } else {
        mState.robT = 0;
        SOL.setObjective(m.name, s.text);
      }
    }
    // beacon pulse
    if (beacon && beacon.visible) {
      beacon.rotation.y += dt * 1.2;
      beaconRing.scale.setScalar(1 + Math.sin(SOL.time.hour * 4) * 0.12);
    }
  }
  SOL.updateMissions = updateMissions;

  // The player entering a vehicle can complete an enter step.
  SOL.onEnter = function (kind) {
    if (!mState.active) return;
    var m = MISSIONS[mState.index];
    var s = m.steps[mState.step];
    if (!s || s.type !== 'enter') return;
    if (s.kind === 'car' && (kind === 'car' || kind === 'sports')) completeStep();
    else if (s.kind === 'sports' && kind === 'sports') completeStep();
    else if (s.kind === kind) completeStep();
  };

  // The getaway sports car waits downtown for mission 4 — parked, red, and
  // tagged so entering it counts as stealing the sports car, not any car.
  function spawnMissionSportsCar() {
    var car = SOL.createCar('sports', 0xc23b2e);
    SOL.placeCar(car, 28, 28, Math.PI / 2);
    car.isMissionSports = true;
    SOL.scene.add(car.group);
    SOL.vehicles.push(car);
    SOL.missionSportsCar = car;
    return car;
  }
  SOL.spawnMissionSportsCar = spawnMissionSportsCar;

  // Debug / playtest helpers.
  SOL.missionInfo = function () {
    if (mState.index < 0) return { active: false, index: -1 };
    var m = MISSIONS[mState.index];
    return {
      active: mState.active, index: mState.index, name: m.name,
      step: mState.step, stepText: m.steps[mState.step] ? m.steps[mState.step].text : 'done',
      missionsDone: SOL.state.missionsDone || 0,
    };
  };
})();
