require("@geckos.io/phaser-on-nodejs")
const Phaser = require("phaser")

const path = require("path")

const Bundler = require("parcel-bundler")
const express = require("express")
const app = express()
const server = require("http").createServer(app)
const io = require("socket.io")(server)

const tilemapPng = path.resolve("./assets/tileset/Dungeon_Tileset.png")
const dungeonRoomJson = path.resolve("./assets/dungeon_room.json")

class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "")

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body.setSize(32, 32)
    this.setCollideWorldBounds(true)
  }
}

class ServerScene extends Phaser.Scene {
  constructor() {
    super()
    this.tick = 0
    this.clients = new Map()

    this.effectsFrameConfig = {frameWidth: 32, frameHeight: 32}
  }

  preload() {
    this.load.image("tiles", tilemapPng)
    this.load.tilemapTiledJSON("map", dungeonRoomJson)
  }

  create() {
    const map = this.make.tilemap({key: "map"})
    const tileset = map.addTilesetImage("Dungeon_Tileset", "tiles")
    const worldLayer = map.createStaticLayer("Walls", tileset, 0, 0)

    worldLayer.setCollisionBetween(1, 500)

    this.physics.world.bounds.width = map.widthInPixels
    this.physics.world.bounds.height = map.heightInPixels

    console.log('🎮 Phaser server started, map size', `${map.widthInPixels}px x`,`${map.heightInPixels}px`);

    io.on("connection", socket => {
      const x = Math.random() * (map.widthInPixels - 64) + 32 + 32
      const y = Math.random() * (map.heightInPixels - 64) + 32 + 32
      const player = new Player(this, x, y)

      this.physics.add.existing(player, false)
      this.physics.add.collider(player, worldLayer);

      this.clients.set(socket.id, {
        socket,
        player
      })

      socket.on("movement", movement => {
        const { left, right, up, down } = movement
        const speed = 175

        // Stop any previous movement from the last frame
        player.body.setVelocity(0);

        // Horizontal movement
        if (left) {
          player.body.setVelocityX(-speed);
        } else if (right) {
          player.body.setVelocityX(speed);
        }

        // Vertical movement
        if (up) {
          player.body.setVelocityY(-speed);
        } else if (down) {
          player.body.setVelocityY(speed);
        }

        // Normalize and scale the velocity so that player can"t move faster along a diagonal
        player.body.velocity.normalize().scale(speed);
      })

      socket.on("disconnect", reason => {
        const client = this.clients.get(socket.id)
        client.player.destroy()
        this.clients.delete(socket.id)
      })
    })
  }

  update() {
    this.tick++

    // only send the update to the client at 30 FPS (save bandwidth)
    if (this.tick % 2 !== 0) return

    // get an array of all players
    const players = []
    this.clients.forEach(player => {
      const { socket, player: p } = player
      players.push({ id: socket.id, x: p.x, y: p.y })
    })

    // send all players to all players
    this.clients.forEach(player => {
      const { socket } = player
      socket.emit("snapshot", { state:players })
    })
  }
}

const config = {
  type: Phaser.HEADLESS,
  width: 1280,
  height: 720,
  banner: false,
  audio: false,
  scene: [ServerScene],
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 }
    }
  }
}

new Phaser.Game(config)


const entryFiles = [path.join(__dirname, "../client/index.html")]
const bundler = new Bundler(entryFiles, { logLevel: 1 })
// app.use("/", express.static(path.join(__dirname, "../client")))
app.use("/", bundler.middleware());

server.listen(3000, "0.0.0.0")
