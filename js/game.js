// Game Constants
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 650;
const PLAYER_SPEED = 7;
const BULLET_SPEED = 10;
const ENEMY_BASE_SPEED = 2;
const POWERUP_SPAWN_RATE = 0.003;
const PLAYER_INVULNERABILITY_TIME = 1500;
const MAX_ENEMIES_ON_SCREEN = 12;

// Leveling System
const LEVEL_CONFIG = {
    1: { requiredKills: 15, enemySpawnRate: 100, maxEnemies: 8 },
    2: { requiredKills: 20, enemySpawnRate: 90, maxEnemies: 10 },
    3: { requiredKills: 25, enemySpawnRate: 80, maxEnemies: 12 },
    4: { requiredKills: 30, enemySpawnRate: 70, maxEnemies: 14 },
    5: { requiredKills: 35, enemySpawnRate: 60, maxEnemies: 15 },
    6: { requiredKills: 40, enemySpawnRate: 55, maxEnemies: 16 },
    7: { requiredKills: 45, enemySpawnRate: 50, maxEnemies: 17 },
    8: { requiredKills: 50, enemySpawnRate: 45, maxEnemies: 18 },
    9: { requiredKills: 55, enemySpawnRate: 40, maxEnemies: 19 },
    10: { requiredKills: 60, enemySpawnRate: 35, maxEnemies: 20 }
};

// Game Variables
let canvas, ctx;
let gameRunning = false;
let gamePaused = false;
let score = 0;
let level = 1;
let playerHealth = 100;
let playerPower = 0;
let enemies = [];
let bullets = [];
let powerups = [];
let keys = {};
let lastTime = 0;
let enemySpawnRate = 100;
let frameCount = 0;
let activePowerups = {};
let isPlayerInvulnerable = false;
let invulnerabilityTimer = 0;
let lastHitTime = 0;
let isPauseEnabled = false;
let difficultyMultiplier = 1;
let enemiesKilledThisLevel = 0;
let totalEnemiesKilled = 0;
let bossSpawned = false;
let isMobileDevice = false;
let scaleFactor = 1;
let isLevelingUp = false;

// Game Images
const images = {
    player: null,
    enemies: [],
    bullet: null,
    powerups: {
        rapid: null,
        shield: null,
        speed: null
    }
};

function detectMobile() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768;

    if (isMobileDevice) {
        scaleFactor = 0.7;
    } else {
        scaleFactor = 1;
    }
}

// Load game images
function loadImages() {
    return new Promise((resolve) => {
        let imagesLoaded = 0;
        const totalImages = 7;

        images.player = new Image();
        images.player.src = 'assets/images/player.png';
        images.player.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };
        images.player.onerror = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        for (let i = 0; i < 3; i++) {
            images.enemies[i] = new Image();
            images.enemies[i].src = `assets/images/enemy${i + 1}.png`;
            images.enemies[i].onload = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) resolve();
            };
            images.enemies[i].onerror = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) resolve();
            };
        }

        images.bullet = new Image();
        images.bullet.src = 'assets/images/bullet.png';
        images.bullet.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };
        images.bullet.onerror = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        ['rapid', 'shield', 'speed'].forEach(type => {
            images.powerups[type] = new Image();
            images.powerups[type].src = `assets/images/${type}-powerup.png`;
            images.powerups[type].onload = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) resolve();
            };
            images.powerups[type].onerror = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) resolve();
            };
        });
    });
}

// Player Object
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 100,
    get width() { return 60 * scaleFactor; },
    get height() { return 80 * scaleFactor; },
    speed: PLAYER_SPEED,
    lastShot: 0,
    shootDelay: 300,

    draw() {
        if (images.player && images.player.complete && images.player.naturalWidth > 0) {
            ctx.save();

            if (isPlayerInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }

            if (activePowerups['shield']) {
                ctx.shadowColor = 'rgba(0, 255, 255, 0.7)';
                ctx.shadowBlur = 20;
            }

            ctx.drawImage(
                images.player,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
            ctx.restore();
        } else {
            // Fallback drawing
            ctx.fillStyle = isPlayerInvulnerable ? 'rgba(0, 255, 170, 0.5)' : '#0fa';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
            ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
            ctx.closePath();
            ctx.fill();
        }

        if (activePowerups['shield']) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    update() {
        let moveX = 0;
        let moveY = 0;

        if (keys['ArrowLeft'] || keys['a']) moveX -= this.speed;
        if (keys['ArrowRight'] || keys['d']) moveX += this.speed;
        if (keys['ArrowUp'] || keys['w']) moveY -= this.speed;
        if (keys['ArrowDown'] || keys['s']) moveY += this.speed;

        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }

        this.x += moveX;
        this.y += moveY;

        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2 - 20, this.y));

        if (gameRunning && !gamePaused && Math.random() < 0.3) {
            if (typeof particleSystem !== 'undefined' && particleSystem.createTrail) {
                particleSystem.createTrail(
                    this.x + (Math.random() * 10 - 5),
                    this.y + this.height / 2,
                    '#0fa'
                );
            }
        }

        if (isPlayerInvulnerable) {
            invulnerabilityTimer = PLAYER_INVULNERABILITY_TIME - (Date.now() - lastHitTime);
            if (invulnerabilityTimer <= 0) {
                isPlayerInvulnerable = false;
            }
        }
    },

    shoot() {
        const now = Date.now();
        if (now - this.lastShot < this.shootDelay) return;

        bullets.push({
            x: this.x,
            y: this.y - 30,
            width: 8 * scaleFactor,
            height: 20 * scaleFactor,
            speed: BULLET_SPEED
        });

        this.lastShot = now;
        if (typeof audioManager !== 'undefined') {
            audioManager.play('shoot');
        }
    },

    takeDamage(amount) {
        if (!activePowerups['shield'] && !isPlayerInvulnerable) {
            const damageMultiplier = 1 + (level - 1) * 0.15;
            const actualDamage = Math.round(amount * damageMultiplier);

            playerHealth = Math.max(0, playerHealth - actualDamage);
            updateHealthBar();

            isPlayerInvulnerable = true;
            lastHitTime = Date.now();

            if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
                particleSystem.createExplosion(this.x, this.y, '#ff0000', 15);
            }

            if (playerHealth <= 0) {
                gameOver();
            }
        }
    },

    addPowerup(type, duration) {
        activePowerups[type] = {
            endTime: Date.now() + duration,
            type: type
        };
        updatePowerupsList();

        switch (type) {
            case 'rapid':
                this.shootDelay = 100;
                break;
            case 'shield':
                playerHealth = Math.min(100, playerHealth + 30);
                updateHealthBar();
                break;
            case 'speed':
                this.speed = PLAYER_SPEED * 1.5;
                break;
        }

        setTimeout(() => {
            this.removePowerup(type);
        }, duration);
    },

    removePowerup(type) {
        delete activePowerups[type];
        updatePowerupsList();

        switch (type) {
            case 'rapid':
                this.shootDelay = 300;
                break;
            case 'speed':
                this.speed = PLAYER_SPEED;
                break;
        }
    }
};

function checkPowerupCollision() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        const dx = player.x - powerup.x;
        const dy = player.y - powerup.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (player.width / 2 + powerup.radius + 10)) {
            player.addPowerup(powerup.type, powerup.duration);
            powerups.splice(i, 1);
            if (typeof audioManager !== 'undefined') {
                audioManager.play('powerup');
            }
            if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
                particleSystem.createExplosion(powerup.x, powerup.y, powerup.color, 20);
            }
        }
    }
}

function handleKeyDown(e) {
    keys[e.key] = true;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    keys[e.key] = false;
}

function getLevelConfig(lvl) {
    if (LEVEL_CONFIG[lvl]) {
        return LEVEL_CONFIG[lvl];
    }
    const baseLevel = 10;
    const extraLevels = lvl - baseLevel;
    return {
        requiredKills: 60 + (extraLevels * 10),
        enemySpawnRate: Math.max(25, 35 - extraLevels * 2),
        maxEnemies: Math.min(25, 20 + extraLevels)
    };
}

function startGame() {
    if (gameRunning && !gamePaused && !isLevelingUp) {
        if (!confirm('Restart the game? Current progress will be lost.')) {
            return;
        }
        gameRunning = false;
        setTimeout(() => {
            startGame();
        }, 100);
        return;
    }

    detectMobile();

    score = 0;
    level = 1;
    playerHealth = 100;
    playerPower = 0;
    enemies = [];
    bullets = [];
    powerups = [];
    activePowerups = {};
    isPlayerInvulnerable = false;
    invulnerabilityTimer = 0;
    frameCount = 0;
    difficultyMultiplier = 1;
    enemiesKilledThisLevel = 0;
    totalEnemiesKilled = 0;
    bossSpawned = false;
    isLevelingUp = false;

    const levelConfig = getLevelConfig(1);
    enemySpawnRate = levelConfig.enemySpawnRate;

    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.speed = PLAYER_SPEED;
    player.shootDelay = 300;

    updateScore();
    updateLevel();
    updateHealthBar();
    updatePowerBar();
    updatePowerupsList();

    document.getElementById('game-over').style.display = 'none';
    document.getElementById('level-up').style.display = 'none';

    gameRunning = true;
    gamePaused = false;
    isPauseEnabled = true;

    const startBtn = document.getElementById('start-btn');
    startBtn.querySelector('.btn-text').textContent = 'RESTART GAME';
    startBtn.disabled = false;

    document.getElementById('pause-btn').disabled = false;
    document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'PAUSE';

    if (typeof audioManager !== 'undefined') {
        audioManager.play('background');
    }
}

function togglePause() {
    if (!gameRunning || !isPauseEnabled || isLevelingUp) {
        return;
    }

    gamePaused = !gamePaused;

    if (gamePaused) {
        if (typeof audioManager !== 'undefined') {
            audioManager.stop('background');
        }
        document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'RESUME';
    } else {
        if (typeof audioManager !== 'undefined') {
            audioManager.play('background');
        }
        document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'PAUSE';
    }
}

function gameOver() {
    gameRunning = false;
    isPauseEnabled = false;

    if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
        particleSystem.createExplosion(player.x, player.y, '#ff0000', 50);
    }

    const startBtn = document.getElementById('start-btn');
    startBtn.querySelector('.btn-text').textContent = 'START GAME';
    startBtn.disabled = false;

    document.getElementById('pause-btn').disabled = true;

    setTimeout(() => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').style.display = 'block';
    }, 1000);

    if (typeof audioManager !== 'undefined') {
        audioManager.stop('background');
        audioManager.play('gameOver');
    }
}

function levelUp() {
    if (isLevelingUp) return;

    isLevelingUp = true;

    level++;

    difficultyMultiplier = 1 + (level - 1) * 0.15;
    const levelConfig = getLevelConfig(level);
    enemySpawnRate = levelConfig.enemySpawnRate;

    enemiesKilledThisLevel = 0;
    bossSpawned = false;

    enemies = [];
    bullets = [];
    powerups = [];

    const healthBonus = 25;
    playerHealth = Math.min(100, playerHealth + healthBonus);
    updateHealthBar();

    const bonusScore = 500 * level;
    score += bonusScore;
    updateScore();

    document.getElementById('next-level').textContent = level;
    document.getElementById('level-bonus').textContent = bonusScore;
    document.getElementById('level-up').style.display = 'block';

    if (typeof audioManager !== 'undefined') {
        audioManager.play('levelUp');
    }

    updateLevel();

    setTimeout(() => {
        document.getElementById('level-up').style.display = 'none';
        isLevelingUp = false;
    }, 2000);
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (document.getElementById('mobile-score')) {
        document.getElementById('mobile-score').textContent = score;
    }
}

function updateLevel() {
    const levelText = `${level}`;
    document.getElementById('level').textContent = levelText;
    if (document.getElementById('mobile-level')) {
        document.getElementById('mobile-level').textContent = levelText;
    }
}

function updateHealthBar() {
    const healthPercent = Math.max(0, Math.min(100, playerHealth));
    const healthBar = document.getElementById('health');
    healthBar.style.width = `${healthPercent}%`;

    if (document.getElementById('mobile-health')) {
        document.getElementById('mobile-health').style.width = `${healthPercent}%`;
    }
}

function updatePowerBar() {
    document.getElementById('power').style.width = `${playerPower}%`;
}

function updatePowerupsList() {
    const powerupsList = document.getElementById('powerups-list');
    powerupsList.innerHTML = '';

    for (const type in activePowerups) {
        const div = document.createElement('div');
        div.className = 'powerup';

        let powerupName = '';
        switch (type) {
            case 'rapid':
                powerupName = 'RAPID FIRE';
                break;
            case 'shield':
                powerupName = 'SHIELD';
                break;
            case 'speed':
                powerupName = 'SPEED BOOST';
                break;
        }

        div.textContent = powerupName;

        const timeLeft = Math.ceil((activePowerups[type].endTime - Date.now()) / 1000);
        if (timeLeft > 0) {
            const timeSpan = document.createElement('span');
            timeSpan.textContent = ` (${timeLeft}s)`;
            timeSpan.style.fontSize = '0.8em';
            timeSpan.style.opacity = '0.7';
            div.appendChild(timeSpan);
        }

        powerupsList.appendChild(div);
    }
}

function resizeCanvas() {
    detectMobile();

    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    if (gameRunning) {
        player.x = Math.min(player.x, canvas.width - player.width / 2);
        player.y = Math.min(player.y, canvas.height - player.height / 2);
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (!gamePaused && !isLevelingUp) {
        update(deltaTime);
    }

    draw();
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    if (!gameRunning) return;

    const currentLevelConfig = getLevelConfig(level);

    player.update();

    if (keys[' '] || keys['Spacebar']) {
        player.shoot();
    }

    frameCount++;
    if (frameCount % enemySpawnRate === 0) {
        if (enemies.length < currentLevelConfig.maxEnemies) {
            spawnEnemy();
        }
    }

    if (Math.random() < POWERUP_SPAWN_RATE) {
        spawnPowerup();
    }

    checkPowerupCollision();

    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;

        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], enemies[j])) {
                enemies[j].health--;

                if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
                    particleSystem.createExplosion(
                        bullets[i].x,
                        bullets[i].y,
                        enemies[j].color,
                        10
                    );
                }

                bullets.splice(i, 1);

                if (enemies[j].health <= 0) {
                    if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
                        particleSystem.createExplosion(
                            enemies[j].x,
                            enemies[j].y,
                            enemies[j].color,
                            enemies[j].isBoss ? 50 : 30
                        );
                    }

                    score += enemies[j].points;
                    updateScore();

                    enemiesKilledThisLevel++;
                    totalEnemiesKilled++;

                    enemies.splice(j, 1);

                    if (typeof audioManager !== 'undefined') {
                        audioManager.play('explosion');
                    }

                    playerPower = Math.min(100, playerPower + 5);
                    updatePowerBar();
                }

                break;
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;

        if (enemies[i].y > canvas.height + 50) {
            enemies.splice(i, 1);
            continue;
        }

        if (checkCollision(player, enemies[i])) {
            player.takeDamage(10);

            if (typeof particleSystem !== 'undefined' && particleSystem.createExplosion) {
                particleSystem.createExplosion(
                    enemies[i].x,
                    enemies[i].y,
                    enemies[i].color,
                    20
                );
            }

            enemies.splice(i, 1);
            if (typeof audioManager !== 'undefined') {
                audioManager.play('explosion');
            }
        }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].y += powerups[i].speed;

        if (powerups[i].y > canvas.height) {
            powerups.splice(i, 1);
        }
    }

    if (typeof particleSystem !== 'undefined' && particleSystem.update) {
        particleSystem.update();
    }

    for (const type in activePowerups) {
        const timeLeft = activePowerups[type].endTime - Date.now();
        if (timeLeft <= 0) {
            player.removePowerup(type);
        }
    }
    updatePowerupsList();

    if (enemiesKilledThisLevel >= currentLevelConfig.requiredKills && !isLevelingUp) {
        levelUp();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (typeof particleSystem !== 'undefined' && particleSystem.draw) {
        particleSystem.draw(ctx);
    }

    if (gameRunning) {
        player.draw();
    }

    bullets.forEach(bullet => {
        if (images.bullet && images.bullet.complete && images.bullet.naturalWidth > 0) {
            ctx.save();
            ctx.shadowColor = '#0fa';
            ctx.shadowBlur = 10;
            ctx.drawImage(
                images.bullet,
                bullet.x - bullet.width / 2,
                bullet.y,
                bullet.width,
                bullet.height
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#0fa';
            ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        }
    });

    enemies.forEach(enemy => {
        if (images.enemies[enemy.type] && images.enemies[enemy.type].complete && images.enemies[enemy.type].naturalWidth > 0) {
            ctx.save();

            ctx.shadowColor = enemy.color;
            ctx.shadowBlur = enemy.isBoss ? 20 : 5;

            ctx.drawImage(
                images.enemies[enemy.type],
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );

            if (enemy.maxHealth > 1) {
                const barWidth = enemy.width;
                const barHeight = 4;
                const healthPercent = enemy.health / enemy.maxHealth;

                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fillRect(
                    enemy.x - barWidth / 2,
                    enemy.y - enemy.height / 2 - 10,
                    barWidth,
                    barHeight
                );

                ctx.fillStyle = enemy.isBoss ? '#ff00ff' : '#00ff00';
                ctx.fillRect(
                    enemy.x - barWidth / 2,
                    enemy.y - enemy.height / 2 - 10,
                    barWidth * healthPercent,
                    barHeight
                );
            }

            if (enemy.isBoss) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ff00ff';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('BOSS', enemy.x, enemy.y - enemy.height / 2 - 18);
            }

            ctx.restore();
        } else {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y + enemy.height / 2);
            ctx.lineTo(enemy.x + enemy.width / 2, enemy.y - enemy.height / 2);
            ctx.lineTo(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2);
            ctx.closePath();
            ctx.fill();
        }
    });

    powerups.forEach(powerup => {
        const img = images.powerups[powerup.type];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.shadowColor = powerup.color;
            ctx.shadowBlur = 15;

            const pulse = 1 + 0.1 * Math.sin(Date.now() / 200);
            const size = powerup.radius * 2 * pulse;

            ctx.drawImage(
                img,
                powerup.x - size / 2,
                powerup.y - size / 2,
                size,
                size
            );

            ctx.restore();
        } else {
            ctx.fillStyle = powerup.color;
            ctx.beginPath();
            ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    if (gameRunning && !isLevelingUp) {
        const config = getLevelConfig(level);
        const progress = enemiesKilledThisLevel / config.requiredKills;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(10, 10, 200, 8);

        ctx.fillStyle = '#0fa';
        ctx.fillRect(10, 10, 200 * progress, 8);

        ctx.fillStyle = 'white';
        ctx.font = '12px Orbitron';
        ctx.fillText(`Progress: ${enemiesKilledThisLevel}/${config.requiredKills}`, 10, 30);
    }
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width / 2 &&
        obj1.x > obj2.x - obj2.width / 2 &&
        obj1.y < obj2.y + obj2.height / 2 &&
        obj1.y > obj2.y - obj2.height / 2;
}

function spawnEnemy() {
    const currentLevelConfig = getLevelConfig(level);

    if (enemies.length >= currentLevelConfig.maxEnemies) {
        return;
    }

    const enemyTypes = [
        { type: 0, width: 50, height: 50, color: '#ff5555', health: 1, points: 100 },
        { type: 1, width: 60, height: 60, color: '#ffaa00', health: 2, points: 200 },
        { type: 2, width: 70, height: 70, color: '#ff00aa', health: 3, points: 300 }
    ];

    let enemyType = 0;
    const rand = Math.random();

    if (level >= 7 && rand < 0.4) {
        enemyType = 2;
    } else if (level >= 5 && rand < 0.35) {
        enemyType = 2;
    } else if (level >= 4 && rand < 0.5) {
        enemyType = 1;
    } else if (level >= 2 && rand < 0.35) {
        enemyType = 1;
    }

    const enemy = enemyTypes[enemyType];

    const shouldSpawnBoss = (level % 5 === 0 && !bossSpawned && enemiesKilledThisLevel >= 5);

    if (shouldSpawnBoss) {
        bossSpawned = true;
        const bossHealth = 15 + (level * 2);
        enemies.push({
            x: canvas.width / 2,
            y: -100,
            width: 120 * scaleFactor,
            height: 120 * scaleFactor,
            speed: (ENEMY_BASE_SPEED * 0.6) * (1 + level * 0.05),
            color: '#ff0000',
            type: 2,
            health: bossHealth,
            maxHealth: bossHealth,
            points: 1500 * level,
            isBoss: true
        });
    } else {
        const speedVariation = 1 + (level * 0.1) + (Math.random() * 0.3);
        enemies.push({
            x: Math.random() * (canvas.width - enemy.width * scaleFactor) + (enemy.width * scaleFactor) / 2,
            y: -(enemy.height * scaleFactor),
            width: enemy.width * scaleFactor,
            height: enemy.height * scaleFactor,
            speed: ENEMY_BASE_SPEED * speedVariation,
            color: enemy.color,
            type: enemy.type,
            health: enemy.health,
            maxHealth: enemy.health,
            points: enemy.points,
            isBoss: false
        });
    }
}

function spawnPowerup() {
    if (powerups.length >= 2) return;

    const powerupTypes = [
        { type: 'rapid', color: '#00ffaa', radius: 18 * scaleFactor, duration: 8000 },
        { type: 'shield', color: '#00aaff', radius: 18 * scaleFactor, duration: 10000 },
        { type: 'speed', color: '#aa00ff', radius: 18 * scaleFactor, duration: 7000 }
    ];

    const powerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

    powerups.push({
        x: Math.random() * (canvas.width - 80) + 40,
        y: -40,
        radius: powerup.radius,
        speed: 2.5,
        color: powerup.color,
        type: powerup.type,
        duration: powerup.duration
    });
}

async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    await loadImages();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        startGame();
    });

    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;

    const volumeControl = document.getElementById('volume');
    if (volumeControl) {
        volumeControl.addEventListener('input', (e) => {
            if (typeof audioManager !== 'undefined') {
                audioManager.setVolume(parseFloat(e.target.value));
            }
        });
    }

    requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);