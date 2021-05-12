import io from "socket.io-client"
import Phaser from "phaser"

import avroraAtlasPng from '../assets/avrora-atlas.png'
import avroraAtlasJson from '../assets/avrora-atlas.json'
import tilemapPng from '../assets/tileset/Dungeon_Tileset.png'
import dungeonRoomJson from '../assets/dungeon_room.json'

class MainScene extends Phaser.Scene {
  constructor() {
    super()

    this.players = new Map()
    this.previousPlayers = new Map()
    this.cursors

    this.socket = io(window.location.href)
    this.socket.on('connect', () => {
      console.log('id:', this.socket.id)
    })
  }

  preload() {
    this.load.image("tiles", tilemapPng)
    this.load.tilemapTiledJSON("map", dungeonRoomJson)

    this.load.atlas(
      "avrora-atlas",
      avroraAtlasPng,
      avroraAtlasJson,
    )
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys()

    this.socket.on('snapshot', snapshot => {
      this.snapshot = snapshot
    })

    const map = this.make.tilemap({key: "map"});
    const tileset = map.addTilesetImage("Dungeon_Tileset", "tiles");

    const belowLayer = map.createStaticLayer("Floor", tileset, 0, 0);
    const worldLayer = map.createStaticLayer("Walls", tileset, 0, 0);
    const aboveLayer = map.createStaticLayer("Upper", tileset, 0, 0);

    aboveLayer.setDepth(10);

    const anims = this.anims
    anims.create({
      key: "left-walk",
      frames: anims.generateFrameNames("avrora-atlas", { prefix: "left-walk-", start: 0, end: 3, zeroPad: 3 }),
      frameRate: 10,
      repeat: -1
    });
    anims.create({
      key: "right-walk",
      frames: anims.generateFrameNames("avrora-atlas", { prefix: "right-walk-", start: 0, end: 3, zeroPad: 3 }),
      frameRate: 10,
      repeat: -1
    });
    anims.create({
      key: "front-walk",
      frames: anims.generateFrameNames("avrora-atlas", { prefix: "front-walk-", start: 0, end: 3, zeroPad: 3 }),
      frameRate: 10,
      repeat: -1
    });
    anims.create({
      key: "back-walk",
      frames: anims.generateFrameNames("avrora-atlas", { prefix: "back-walk-", start: 0, end: 3, zeroPad: 3 }),
      frameRate: 10,
      repeat: -1
    });
  }

  update() {
    if (!this.snapshot) return

    const { state } = this.snapshot
    if (!state) return

    // TODO: handle client disconnect
    state.forEach(player => {
      const exists = this.players.has(player.id)

      if (!exists) {
        const _player = this.add.sprite(player.x, player.y, "avrora-atlas", "left-walk-003")
        this.players.set(player.id, { player: _player })
      } else {
        const previousPlayerExists = this.previousPlayers.has(player.id)
        let previousPlayer
        if (previousPlayerExists) {
          previousPlayer = this.previousPlayers.get(player.id)
        } else {
          previousPlayer = player
        }

        const _player = this.players.get(player.id).player

        _player.setX(player.x)
        _player.setY(player.y)

        const debouncedStop = debounce(() => _player.anims.stop() , 200)
        if (isLeftDirection(player, previousPlayer)) {
          _player.anims.play("left-walk", true)
          debouncedStop()
        } else if (isRightDirection(player, previousPlayer)) {
          _player.anims.play("right-walk", true)
          debouncedStop()
        } else if (isUpDirection(player, previousPlayer)) {
          _player.anims.play("back-walk", true)
          debouncedStop()
        } else if (isDownDirection(player, previousPlayer)) {
          _player.anims.play("front-walk", true)
          debouncedStop()
        } else {
          // do nothing
        }
      }

      this.previousPlayers.set(player.id, player)
    })

    const movement = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown
    }

    this.socket.emit('movement', movement)
  }
}

const config = {
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 768,
    height: 576
  },
  scene: [MainScene]
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})

function isUpDirection({x, y}, {x:prevX, y:prevY}) {
  return y < prevY
}

function isDownDirection({x, y}, {x:prevX, y:prevY}) {
  return y > prevY
}

function isLeftDirection({x, y}, {x:prevX, y:prevY}) {
  return x < prevX
}

function isRightDirection({x, y}, {x:prevX, y:prevY}) {
  return x > prevX
}

function debounce(func, wait, immediate) {
  let timeout;

  return function executedFunction() {
    const context = this;
    const args = arguments;

    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
};


