// Game Constants
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 650;
const PLAYER_SPEED = 7;  // Increased from 5
const BULLET_SPEED = 10; // Increased from 7
const ENEMY_SPEED = 3;   // Increased from 2
const POWERUP_SPAWN_RATE = 0.008; // Reduced from 0.02
const LEVEL_SCORE_INCREMENT = 1500; // Increased from 1000
const PLAYER_INVULNERABILITY_TIME = 2000; // 2 seconds after hit (new)

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
let enemySpawnRate = 60;
let frameCount = 0;
let activePowerups = {};
let isPlayerInvulnerable = false;
let invulnerabilityTimer = 0;
let lastHitTime = 0;
let isPauseEnabled = false;

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

// Load game images
function loadImages() {
    return new Promise((resolve) => {
        let imagesLoaded = 0;
        const totalImages = 7; // player + 3 enemies + bullet + 3 powerups

        // Load player image
        images.player = new Image();
        images.player.src = 'assets/images/player.png';
        images.player.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        // Load enemy images
        for (let i = 0; i < 3; i++) {
            images.enemies[i] = new Image();
            images.enemies[i].src = `assets/images/enemy${i + 1}.png`;
            images.enemies[i].onload = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) resolve();
            };
        }

        // Load bullet image
        images.bullet = new Image();
        images.bullet.src = 'assets/images/bullet.png';
        images.bullet.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        // Load powerup images
        images.powerups.rapid = new Image();
        images.powerups.rapid.src = 'assets/images/rapid-powerup.png';
        images.powerups.rapid.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        images.powerups.shield = new Image();
        images.powerups.shield.src = 'assets/images/shield-powerup.png';
        images.powerups.shield.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };

        images.powerups.speed = new Image();
        images.powerups.speed.src = 'assets/images/speed-powerup.png';
        images.powerups.speed.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) resolve();
        };
    });
}

// Player Object
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 100,
    width: 60,
    height: 80,
    speed: PLAYER_SPEED,
    lastShot: 0,
    shootDelay: 300,

    draw() {
        if (images.player) {
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
            ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
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

        // Fixed boundary checks - spaceship can now reach right edge
        this.x = Math.max(this.width / 2, Math.min(GAME_WIDTH - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(GAME_HEIGHT - this.height / 2 - 20, this.y));

        if (gameRunning && !gamePaused && Math.random() < 0.3) {
            particleSystem.createTrail(
                this.x + (Math.random() * 10 - 5),
                this.y + this.height / 2,
                '#0fa'
            );
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
            width: 8,
            height: 20,
            speed: BULLET_SPEED
        });

        this.lastShot = now;
        audioManager.play('shoot');
    },

    takeDamage(amount) {
        if (!activePowerups['shield'] && !isPlayerInvulnerable) {
            playerHealth -= amount;
            updateHealthBar();

            isPlayerInvulnerable = true;
            lastHitTime = Date.now();

            particleSystem.createExplosion(this.x, this.y, '#ff0000', 15);

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

        // Larger collection radius
        if (distance < (player.width / 2 + powerup.radius + 10)) {
            player.addPowerup(powerup.type, powerup.duration);
            powerups.splice(i, 1);
            audioManager.play('powerup');

            // Collection effect
            particleSystem.createExplosion(powerup.x, powerup.y, powerup.color, 20);
        }
    }
}

// Handle key presses
function handleKeyDown(e) {
    keys[e.key] = true;

    // Prevent arrow keys from scrolling the page
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    keys[e.key] = false;
}

// Start a new game
function startGame() {
    // Prevent starting if already running
    if (gameRunning && !gamePaused) {
        // If game is running, restart it
        gameRunning = false;
        setTimeout(() => {
            startGame();
        }, 100);
        return;
    }

    // Reset game state
    score = 0;
    level = 1;
    playerHealth = 100;
    playerPower = 0;
    enemies = [];
    bullets = [];
    powerups = [];
    activePowerups = {};
    enemySpawnRate = 60;
    isPlayerInvulnerable = false;
    invulnerabilityTimer = 0;
    frameCount = 0;

    // Reset player position
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 100;
    player.speed = PLAYER_SPEED;
    player.shootDelay = 300;

    // Update UI
    updateScore();
    updateLevel();
    updateHealthBar();
    updatePowerBar();
    updatePowerupsList();

    // Hide game over panel if visible
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('level-up').style.display = 'none';

    // Start game
    gameRunning = true;
    gamePaused = false;
    isPauseEnabled = true;

    // Update button states and text
    const startBtn = document.getElementById('start-btn');
    startBtn.querySelector('.btn-text').textContent = 'RESTART GAME';
    startBtn.disabled = false;

    document.getElementById('pause-btn').disabled = false;
    document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'PAUSE';

    // Play background music
    audioManager.play('background');
}

// Toggle pause
function togglePause() {
    // Only allow pause if game is running
    if (!gameRunning || !isPauseEnabled) {
        return;
    }

    gamePaused = !gamePaused;

    if (gamePaused) {
        audioManager.stop('background');
        document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'RESUME';
    } else {
        audioManager.play('background');
        document.getElementById('pause-btn').querySelector('.btn-text').textContent = 'PAUSE';
    }
}

// Game over
function gameOver() {
    gameRunning = false;
    isPauseEnabled = false;

    // Big explosion effect
    particleSystem.createExplosion(player.x, player.y, '#ff0000', 50);

    // Update button states and text
    const startBtn = document.getElementById('start-btn');
    startBtn.querySelector('.btn-text').textContent = 'START GAME';
    startBtn.disabled = false;

    document.getElementById('pause-btn').disabled = true;

    // Delayed game over display
    setTimeout(() => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').style.display = 'block';
    }, 1000);

    audioManager.stop('background');
    audioManager.play('gameOver');
}

// Level up
function levelUp() {
    level++;
    enemySpawnRate = Math.max(20, enemySpawnRate - 5);

    // Show level up panel
    document.getElementById('next-level').textContent = level;
    document.getElementById('level-up').style.display = 'block';

    // Play level up sound
    audioManager.play('levelUp');

    // Hide after 2 seconds
    setTimeout(() => {
        document.getElementById('level-up').style.display = 'none';
    }, 2000);

    // Update UI
    updateLevel();
}

// Update UI elements
function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateLevel() {
    document.getElementById('level').textContent = level;
}

function updateHealthBar() {
    const healthBar = document.getElementById('health');
    healthBar.style.width = `${playerHealth}%`;
    healthBar.style.backgroundColor = playerHealth > 50 ?
        `hsl(${(playerHealth - 50) * 1.2}, 100%, 50%)` :
        `hsl(0, 100%, ${playerHealth}%)`;
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

        switch (type) {
            case 'rapid':
                div.textContent = 'RAPID FIRE';
                break;
            case 'shield':
                div.textContent = 'SHIELD';
                break;
            case 'speed':
                div.textContent = 'SPEED BOOST';
                break;
        }

        // Add time remaining indicator
        const timeLeft = Math.ceil((activePowerups[type].endTime - Date.now()) / 1000);
        const timeSpan = document.createElement('span');
        timeSpan.textContent = ` (${timeLeft}s)`;
        timeSpan.style.fontSize = '0.8em';
        timeSpan.style.opacity = '0.7';
        div.appendChild(timeSpan);

        powerupsList.appendChild(div);
    }
}

// Resize canvas to fit container
function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Reposition player if game is running
    if (gameRunning) {
        player.x = canvas.width / 2;
        player.y = canvas.height - 100;
    }
}

// Game Loop
function gameLoop(timestamp) {
    if (!gamePaused) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        update(deltaTime);
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update(deltaTime) {
    if (!gameRunning) return;

    // Update player
    player.update();

    // Auto-shoot when space is held
    if (keys[' '] || keys['Spacebar']) {
        player.shoot();
    }

    // Spawn enemies
    frameCount++;
    if (frameCount % enemySpawnRate === 0) {
        spawnEnemy();
    }

    // Spawn powerups randomly
    if (Math.random() < POWERUP_SPAWN_RATE) {
        spawnPowerup();
    }

    checkPowerupCollision();

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;

        // Remove bullets that are off screen
        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
            continue;
        }

        // Check for bullet-enemy collisions
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], enemies[j])) {
                // Create explosion
                particleSystem.createExplosion(
                    enemies[j].x,
                    enemies[j].y,
                    enemies[j].color,
                    30
                );

                // Remove enemy and bullet
                enemies.splice(j, 1);
                bullets.splice(i, 1);

                // Increase score
                score += 100;
                updateScore();

                // Play sound
                audioManager.play('explosion');

                // Increase player power
                playerPower = Math.min(100, playerPower + 5);
                updatePowerBar();

                break;
            }
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;

        // Remove enemies that are off screen
        if (enemies[i].y > GAME_HEIGHT) {
            enemies.splice(i, 1);
            continue;
        }

        // Check for enemy-player collisions
        if (checkCollision(player, enemies[i])) {
            player.takeDamage(10);

            // Create explosion
            particleSystem.createExplosion(
                enemies[i].x,
                enemies[i].y,
                enemies[i].color,
                20
            );

            enemies.splice(i, 1);
            audioManager.play('explosion');
        }
    }

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].y += powerups[i].speed;

        // Remove powerups that are off screen
        if (powerups[i].y > GAME_HEIGHT) {
            powerups.splice(i, 1);
            continue;
        }

        // Check for powerup-player collisions
        if (checkCollision(player, powerups[i])) {
            const type = powerups[i].type;
            player.addPowerup(type, 10000); // 10 seconds

            powerups.splice(i, 1);
            audioManager.play('powerup');
        }
    }

    // Update particles
    particleSystem.update();

    // Check for level up
    if (score >= level * LEVEL_SCORE_INCREMENT) {
        levelUp();
    }
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw particles
    particleSystem.draw(ctx);

    // Draw player
    if (gameRunning) {
        player.draw();
    }

    // Draw bullets
    bullets.forEach(bullet => {
        if (images.bullet) {
            ctx.drawImage(
                images.bullet,
                bullet.x - bullet.width / 2,
                bullet.y,
                bullet.width,
                bullet.height
            );

            // Add glow to bullets
            ctx.shadowColor = '#0fa';
            ctx.shadowBlur = 10;
            ctx.drawImage(
                images.bullet,
                bullet.x - bullet.width / 2,
                bullet.y,
                bullet.width,
                bullet.height
            );
            ctx.shadowBlur = 0;
        } else {
            // Fallback if image fails to load
            ctx.fillStyle = '#0fa';
            ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        }
    });

    // Draw enemies
    enemies.forEach(enemy => {
        if (images.enemies[enemy.type]) {
            ctx.save();

            // Add glow to enemies
            ctx.shadowColor = enemy.color;
            ctx.shadowBlur = 5;

            ctx.drawImage(
                images.enemies[enemy.type],
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );

            ctx.restore();
        } else {
            // Fallback if image fails to load
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y + enemy.height / 2);
            ctx.lineTo(enemy.x + enemy.width / 2, enemy.y - enemy.height / 2);
            ctx.lineTo(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Draw powerups
    powerups.forEach(powerup => {
        const img = images.powerups[powerup.type];
        if (img) {
            ctx.save();

            // Add pulsing effect
            const pulseScale = 1 + 0.1 * Math.sin(Date.now() / 200);
            ctx.shadowColor = powerup.color;
            ctx.shadowBlur = 15;

            ctx.drawImage(
                img,
                powerup.x - powerup.radius,
                powerup.y - powerup.radius,
                powerup.radius * 2,
                powerup.radius * 2
            );

            ctx.restore();
        } else {
            // Fallback if image fails to load
            ctx.fillStyle = powerup.color;
            ctx.beginPath();
            ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw powerup symbol
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(powerup.symbol, powerup.x, powerup.y);
        }
    });
}

// Collision detection
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width / 2 &&
        obj1.x > obj2.x - obj2.width / 2 &&
        obj1.y < obj2.y + obj2.height / 2 &&
        obj1.y > obj2.y - obj2.height / 2;
}

// Spawn a new enemy
function spawnEnemy() {
    const enemyTypes = [
        { type: 0, width: 50, height: 50, color: '#ff5555' }, // Red enemy
        { type: 1, width: 60, height: 60, color: '#ffaa00' }, // Yellow enemy
        { type: 2, width: 70, height: 70, color: '#ff00aa' }  // Pink enemy
    ];

    const enemyType = Math.floor(Math.random() * enemyTypes.length);
    const enemy = enemyTypes[enemyType];

    enemies.push({
        x: Math.random() * (canvas.width - enemy.width) + enemy.width / 2,
        y: -enemy.height,
        width: enemy.width,
        height: enemy.height,
        speed: ENEMY_SPEED + Math.random() * level * 0.2,
        color: enemy.color,
        type: enemy.type
    });
}

// Spawn a powerup
function spawnPowerup() {
    const powerupTypes = [
        { type: 'rapid', color: '#00ffaa', radius: 20, duration: 8000 },
        { type: 'shield', color: '#00aaff', radius: 20, duration: 10000 },
        { type: 'speed', color: '#aa00ff', radius: 20, duration: 6000 }
    ];

    const powerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

    // Only spawn in upper 70% of screen
    const spawnY = -40;
    const spawnX = Math.random() * (canvas.width - 40) + 20;

    powerups.push({
        x: spawnX,
        y: spawnY,
        radius: powerup.radius,
        speed: 2.5, // Slightly faster
        color: powerup.color,
        type: powerup.type,
        duration: powerup.duration
    });
}

function gameOver() {
    gameRunning = false;
    isPauseEnabled = false;

    // Big explosion effect
    particleSystem.createExplosion(player.x, player.y, '#ff0000', 50);

    // Update button states
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;

    // Delayed game over display
    setTimeout(() => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').style.display = 'block';
    }, 1000);

    audioManager.stop('background');
    audioManager.play('gameOver');
}

// Initialize Game
async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Load game images
    await loadImages();

    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Button listeners
    document.getElementById('start-btn').addEventListener('click', () => {
        if (gameRunning && !gamePaused) {
            // Restart confirmation could be added here
            if (confirm('Restart the game? Current progress will be lost.')) {
                startGame();
            }
        } else {
            startGame();
        }
    });

    document.getElementById('pause-btn').addEventListener('click', togglePause);

    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        startGame();
    });

    // Set initial button states
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;

    // Volume control
    document.getElementById('volume').addEventListener('input', (e) => {
        audioManager.setVolume(parseFloat(e.target.value));
    });

    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Initialize the game when the page loads
window.addEventListener('load', init);