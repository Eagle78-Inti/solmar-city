// Solmar City — the money: taxi fares, courier deliveries, the Ammu-Nation
// gun shop and the Sunset Garage property.
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var taxi = { active: false, stage: 0, px: 0, pz: 0, dx: 0, dz: 0, fare: 0, timer: 0 };
  SOL.taxi = taxi;
  var courier = { active: false, stage: 0, x: 0, z: 0, timer: 0 };
  SOL.courier = courier;

  function randSpotNear(px, pz, minD, maxD) {
    var a = Math.random() * Math.PI * 2;
    var d = minD + Math.random() * (maxD - minD);
    var x = Math.max(-180, Math.min(180, px + Math.sin(a) * d));
    var z = Math.max(-180, Math.min(180, pz + Math.cos(a) * d));
    // snap to the nearest road for a reachable spot
    var roads = [-168, -112, -56, 0, 56, 112, 168];
    var best = roads[0], bd = 9999;
    roads.forEach(function (r) { var dd = Math.abs(r - x); if (dd < bd) { bd = dd; best = r; } });
    return { x: best + 4, z: z };
  }

  function startTaxi() {
    var p = SOL.player;
    if (p.mode !== 'car') { SOL.hudToast('Taxi job', 'You need to be in a car to drive a fare.'); return; }
    if (taxi.active) { taxi.active = false; SOL.hideBeacon(); SOL.hudToast('Taxi job', 'Job cancelled.'); return; }
    var s = randSpotNear(p.x, p.z, 40, 90);
    taxi.active = true; taxi.stage = 0; taxi.px = s.x; taxi.pz = s.z; taxi.timer = 150;
    SOL.showBeacon(s.x, s.z);
    SOL.setObjective('Taxi', 'Pick up the passenger at the marker');
    SOL.hudToast('Taxi job', 'Pick up the passenger — $60–$150 a fare.');
  }
  SOL.startTaxi = startTaxi;

  function updateTaxi(dt) {
    if (!taxi.active) return;
    var p = SOL.player;
    taxi.timer -= dt;
    if (taxi.timer <= 0) { taxi.active = false; SOL.hideBeacon(); SOL.hudToast('Taxi job', 'The passenger gave up waiting.'); return; }
    if (taxi.stage === 0) {
      if (Math.hypot(p.x - taxi.px, p.z - taxi.pz) < 7) {
        taxi.stage = 1;
        var d = randSpotNear(p.x, p.z, 60, 140);
        taxi.dx = d.x; taxi.dz = d.z;
        taxi.fare = 60 + Math.floor(Math.hypot(taxi.dx - p.x, taxi.dz - p.z) / 2);
        taxi.fare = Math.min(150, taxi.fare);
        SOL.showBeacon(taxi.dx, taxi.dz);
        SOL.setObjective('Taxi', 'Take the passenger to the marker — $' + taxi.fare);
      }
    } else {
      if (Math.hypot(p.x - taxi.dx, p.z - taxi.dz) < 8) {
        SOL.state.cash += taxi.fare;
        SOL.hudToast('Fare paid', '+$' + taxi.fare + ' — nice driving.');
        taxi.active = false; SOL.hideBeacon();
        SOL.setObjective('Solmar City', 'Free roam — press M for your next mission.');
        SOL.saveGame();
      }
    }
  }
  SOL.updateTaxi = updateTaxi;

  function startCourier() {
    var p = SOL.player;
    if (courier.active) { courier.active = false; SOL.hideBeacon(); SOL.hudToast('Courier', 'Delivery cancelled.'); return; }
    var s = randSpotNear(p.x, p.z, 30, 70);
    courier.active = true; courier.stage = 0; courier.x = s.x; courier.z = s.z; courier.timer = 0;
    SOL.showBeacon(s.x, s.z);
    SOL.setObjective('Courier', 'Pick up the package at the marker');
    SOL.hudToast('Courier job', 'Pick up the package — $60, plus $30 if you are fast.');
  }
  SOL.startCourier = startCourier;

  function updateCourier(dt) {
    if (!courier.active) return;
    var p = SOL.player;
    if (courier.stage === 0) {
      if (Math.hypot(p.x - courier.x, p.z - courier.z) < 5) {
        courier.stage = 1; courier.timer = 0;
        var d = randSpotNear(p.x, p.z, 50, 120);
        courier.x = d.x; courier.z = d.z;
        SOL.showBeacon(courier.x, courier.z);
        SOL.setObjective('Courier', 'Deliver the package — fast pays $30 extra');
      }
    } else {
      courier.timer += dt;
      if (Math.hypot(p.x - courier.x, p.z - courier.z) < 5) {
        var pay = 60 + (courier.timer < 60 ? 30 : 0);
        SOL.state.cash += pay;
        SOL.hudToast('Delivered', '+$' + pay + (courier.timer < 60 ? ' (fast bonus!)' : ''));
        courier.active = false; SOL.hideBeacon();
        SOL.setObjective('Solmar City', 'Free roam — press M for your next mission.');
        SOL.saveGame();
      }
    }
  }
  SOL.updateCourier = updateCourier;

  // ---- Ammu-Nation ---------------------------------------------------------
  var SHOP_ITEMS = [
    { key: 'smg', label: 'SMG', price: 800, desc: 'Rapid fire, 32-round mag' },
    { key: 'shotgun', label: 'Shotgun', price: 1200, desc: 'Close range, 5 pellets' },
    { key: 'ammo_pistol', label: 'Pistol ammo ×48', price: 100, desc: 'Reserve rounds' },
    { key: 'ammo_smg', label: 'SMG ammo ×64', price: 150, desc: 'Reserve rounds' },
    { key: 'ammo_shotgun', label: 'Shotgun shells ×16', price: 120, desc: 'Reserve rounds' },
    { key: 'armor', label: 'Body armor +50', price: 300, desc: 'Absorbs damage first' },
  ];
  var shopOpen = false;
  SOL.isShopOpen = function () { return shopOpen; };

  function openShop() {
    shopOpen = true;
    SOL.state.paused = true;
    document.getElementById('shopCash').textContent = '$' + SOL.state.cash;
    var box = document.getElementById('shopItems');
    box.innerHTML = '';
    SHOP_ITEMS.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'item';
      var owned = it.key === 'smg' || it.key === 'shotgun' ? SOL.weapons[it.key].owned : false;
      row.innerHTML = '<span>' + it.label + ' <small style="color:#9fb0c3">' + it.desc + '</small></span>';
      var btn = document.createElement('button');
      btn.textContent = owned ? 'OWNED' : '$' + it.price;
      btn.disabled = owned || SOL.state.cash < it.price;
      btn.onclick = function () { shopBuy(it.key); };
      row.appendChild(btn);
      box.appendChild(row);
    });
    document.getElementById('shop').style.display = 'flex';
  }
  SOL.openShop = openShop;

  function closeShop() {
    shopOpen = false;
    SOL.state.paused = false;
    document.getElementById('shop').style.display = 'none';
  }
  SOL.closeShop = closeShop;

  function shopBuy(key) {
    var st = SOL.state;
    var it = SHOP_ITEMS.filter(function (i) { return i.key === key; })[0];
    if (!it || st.cash < it.price) return;
    st.cash -= it.price;
    if (key === 'smg' || key === 'shotgun') { SOL.weapons[key].owned = true; SOL.weapons[key].ammo = SOL.weapons[key].mag; }
    else if (key === 'ammo_pistol') st.reserve.pistol += 48;
    else if (key === 'ammo_smg') st.reserve.smg += 64;
    else if (key === 'ammo_shotgun') st.reserve.shotgun += 16;
    else if (key === 'armor') SOL.player.armor = Math.min(100, SOL.player.armor + 50);
    SOL.saveGame();
    openShop(); // refresh prices / owned state
  }
  SOL.shopBuy = shopBuy;

  // One E press checks, in order: the gun shop, the garage, then vehicles.
  // The shop and garage win when the player is standing at their doors.
  function tryInteract() {
    var p = SOL.player;
    var ammu = SOL.world.spots.ammu;
    if (Math.hypot(p.x - ammu.x, p.z - ammu.z) < 9 && p.mode === 'foot') {
      openShop();
      return 'shop';
    }
    if (garageInteract()) return 'garage';
    if (p.mode !== 'foot') { SOL.exitVehicle(); return 'exit'; }
    var found = SOL.nearestEnterable(6);
    if (found) { SOL.enterVehicle(found); return 'enter'; }
    return null;
  }
  SOL.tryInteract = tryInteract;

  // ---- Sunset Garage (property) --------------------------------------------
  var GARAGE_PRICE = 4000;
  SOL.garage = { owned: false, cars: [] };

  function garageInteract() {
    var st = SOL.state;
    var p = SOL.player;
    var spot = SOL.world.spots.garage;
    if (Math.hypot(p.x - spot.x, p.z - spot.z) > 12) return false;
    if (!SOL.garage.owned) {
      if (st.cash >= GARAGE_PRICE) {
        st.cash -= GARAGE_PRICE;
        SOL.garage.owned = true;
        SOL.hudToast('Sunset Garage — yours', 'Park cars here with E. Room for 3.');
        SOL.saveGame();
      } else {
        SOL.hudToast('Sunset Garage', 'For sale: $4,000. You have $' + st.cash + '.');
      }
      return true;
    }
    if (p.mode === 'car' && p.vehicle) {
      if (SOL.garage.cars.length >= 3) { SOL.hudToast('Garage full', '3 cars is all she holds.'); return true; }
      SOL.garage.cars.push({ kind: p.vehicle.kind, color: p.vehicle.color });
      SOL.scene.remove(p.vehicle.group);
      var vi = SOL.vehicles.indexOf(p.vehicle);
      if (vi >= 0) SOL.vehicles.splice(vi, 1);
      SOL.exitVehicle();
      SOL.hudToast('Car stored', SOL.garage.cars.length + '/3 in the garage.');
      SOL.saveGame();
      return true;
    }
    if (SOL.garage.cars.length > 0) {
      var saved = SOL.garage.cars.pop();
      var car = SOL.createCar(saved.kind, saved.color);
      SOL.placeCar(car, p.x + 4, p.z + 4, 0);
      SOL.scene.add(car.group);
      SOL.vehicles.push(car);
      SOL.hudToast('Car retrieved', 'Your ' + saved.kind + ' is parked outside.');
      SOL.saveGame();
    } else {
      SOL.hudToast('Sunset Garage', 'Empty. Bring a car here and press E to store it.');
    }
    return true;
  }
  SOL.garageInteract = garageInteract;
})();
