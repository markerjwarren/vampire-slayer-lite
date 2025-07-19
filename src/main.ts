import Phaser from 'phaser';

type Upgrade = {
  name: string;
  level: number;
  apply: () => void;
  getDescription: () => string;
};

class MainScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Rectangle;
  keys!: { [key: string]: Phaser.Input.Keyboard.Key };
  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  xpCrystals!: Phaser.Physics.Arcade.Group;

  spawnTimer = 0;
  fireTimer = 0;
  fireCooldown = 1000;
  bulletSpeed = 400;
  projectileCount = 1;

  enemySpeed = 100;
  enemySpawnInterval = 1500;

  score = 0;
  scoreText!: Phaser.GameObjects.Text;

  health = 3;
  invincible = false;
  hearts: Phaser.GameObjects.Rectangle[] = [];

  xp = 0;
  level = 1;
  xpToNext = 5;
  xpText!: Phaser.GameObjects.Text;

  upgrades: Upgrade[] = [];
  levelingUp = false;

  constructor() {
    super('main');
  }

  preload() {}

  create() {
    this.player = this.add.rectangle(400, 300, 40, 40, 0x00ff00);
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.keys = this.input.keyboard.addKeys('W,A,S,D') as {
      [key: string]: Phaser.Input.Keyboard.Key;
    };

    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.xpCrystals = this.physics.add.group();

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff'
    });

    this.xpText = this.add.text(16, 40, 'XP: 0 / 5', {
      fontSize: '16px',
      color: '#00ffff'
    });

    for (let i = 0; i < 3; i++) {
      const heart = this.add.rectangle(750 - i * 30, 20, 20, 20, 0xff0000);
      this.hearts.push(heart);
    }

    this.physics.add.overlap(this.player, this.enemies, () => {
      if (!this.invincible) this.takeDamage();
    });

    this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
      proj.destroy();
      enemy.destroy();
      this.score += 1;
      this.scoreText.setText(`Score: ${this.score}`);
      this.spawnXP(enemy.x, enemy.y);
    });

    this.physics.add.overlap(this.player, this.xpCrystals, (player, crystal) => {
      crystal.destroy();
      this.xp += 1;
      if (this.xp >= this.xpToNext) {
        this.level++;
        this.xp = 0;
        this.xpToNext += 3;
        this.levelingUp = true;

        this.enemySpeed += 10;
        this.enemySpawnInterval = Math.max(500, this.enemySpawnInterval - 100);

        this.showUpgradeChoices();
      }
      this.xpText.setText(`XP: ${this.xp} / ${this.xpToNext}`);
    });

    this.upgrades = [
      {
        name: 'Rapid Fire',
        level: 0,
        apply: () => {
          this.fireCooldown = Math.max(200, this.fireCooldown - 150);
        },
        getDescription: () => `Shoot faster (Lv. ${this.getUpgradeLevel('Rapid Fire') + 1})`
      },
      {
        name: 'Fast Bullets',
        level: 0,
        apply: () => {
          this.bulletSpeed += 200;
        },
        getDescription: () => `Increase bullet speed (Lv. ${this.getUpgradeLevel('Fast Bullets') + 1})`
      },
      {
        name: 'Multi-Shot',
        level: 0,
        apply: () => {
          this.projectileCount += 1;
        },
        getDescription: () => `Shoot ${this.projectileCount + 1} projectiles`
      }
    ];
  }

  update() {
    if (this.levelingUp) return;

    const speed = 200;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    if (this.keys.A.isDown) body.setVelocityX(-speed);
    if (this.keys.D.isDown) body.setVelocityX(speed);
    if (this.keys.W.isDown) body.setVelocityY(-speed);
    if (this.keys.S.isDown) body.setVelocityY(speed);

    this.spawnTimer += this.game.loop.delta;
    if (this.spawnTimer > this.enemySpawnInterval) {
      this.spawnEnemy();
      this.spawnTimer = 0;
    }

    this.fireTimer += this.game.loop.delta;
    if (this.fireTimer > this.fireCooldown) {
      this.fireProjectile();
      this.fireTimer = 0;
    }

    // Smart enemy movement
    this.enemies.getChildren().forEach(enemy => {
      const e = enemy as Phaser.GameObjects.Rectangle;
      const body = e.body as Phaser.Physics.Arcade.Body;

      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const angle = Math.atan2(dy, dx);
      const offset = Phaser.Math.FloatBetween(-0.1, 0.1);

      const vx = Math.cos(angle + offset) * this.enemySpeed;
      const vy = Math.sin(angle + offset) * this.enemySpeed;

      body.setVelocity(vx, vy);
    });
  }

  takeDamage() {
    this.health--;
    this.player.setFillStyle(0xffffff);
    this.invincible = true;

    const heart = this.hearts[this.health];
    if (heart) heart.setVisible(false);

    if (this.health <= 0) {
      this.scene.pause();
      this.add.text(400, 300, 'GAME OVER', {
        fontSize: '48px',
        color: '#ff0000'
      }).setOrigin(0.5);
      return;
    }

    this.time.delayedCall(1000, () => {
      this.invincible = false;
      this.player.setFillStyle(0x00ff00);
    });
  }

  spawnXP(x: number, y: number) {
    const crystal = this.add.rectangle(x, y, 10, 10, 0x00ffff);
    this.physics.add.existing(crystal);
    this.xpCrystals.add(crystal);
  }

  fireProjectile() {
    const { x: px, y: py } = this.player;
    const { x: mx, y: my } = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(px, py, mx, my);

    const fire = (offsetAngle = 0) => {
      const bullet = this.add.rectangle(px, py, 10, 10, 0xffff00);
      this.physics.add.existing(bullet);
      this.projectiles.add(bullet);

      const speed = this.bulletSpeed;
      const vx = Math.cos(angle + offsetAngle) * speed;
      const vy = Math.sin(angle + offsetAngle) * speed;
      (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);

      this.time.delayedCall(2000, () => bullet.destroy());
    };

    const spread = 15;
    const mid = Math.floor(this.projectileCount / 2);

    for (let i = 0; i < this.projectileCount; i++) {
      const offset = (i - mid) * Phaser.Math.DegToRad(spread);
      fire(offset);
    }
  }

  spawnEnemy() {
    const margin = 50;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0, y = 0;

    switch (edge) {
      case 0: x = -margin; y = Phaser.Math.Between(0, 600); break;
      case 1: x = 800 + margin; y = Phaser.Math.Between(0, 600); break;
      case 2: x = Phaser.Math.Between(0, 800); y = -margin; break;
      case 3: x = Phaser.Math.Between(0, 800); y = 600 + margin; break;
    }

    const enemy = this.add.rectangle(x, y, 30, 30, 0xff0000);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
  }

  showUpgradeChoices() {
    const choices = Phaser.Utils.Array.Shuffle(this.upgrades).slice(0, 3);
    const width = 800;
    const centerY = 300;
    const textObjects: Phaser.GameObjects.Text[] = [];

    const overlay = this.add.rectangle(width / 2, centerY, width, 600, 0x000000, 0.7);

    this.enemies.getChildren().forEach(enemy => {
      (enemy.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    });
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    choices.forEach((upgrade, i) => {
      const y = centerY - 60 + i * 60;

      const text = this.add.text(width / 2, y, `${upgrade.name}: ${upgrade.getDescription()}`, {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#444',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5);

      text.setInteractive();
      text.on('pointerdown', () => {
        upgrade.level++;
        upgrade.apply();
        overlay.destroy();
        textObjects.forEach(t => t.destroy());
        this.levelingUp = false;
        this.input.keyboard.resetKeys();
      });

      textObjects.push(text);
    });
  }

  getUpgradeLevel(name: string) {
    return this.upgrades.find(up => up.name === name)?.level ?? 0;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#222222',
  physics: { default: 'arcade' },
  scene: MainScene
});
