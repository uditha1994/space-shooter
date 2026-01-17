// Audio Manager
class AudioManager {
    constructor() {
        this.sounds = {
            shoot: new Howl({
                src: ['assets/sounds/shoot.wav'],
                volume: 0.5
            }),
            explosion: new Howl({
                src: ['assets/sounds/explosion.wav'],
                volume: 0.3
            }),
            powerup: new Howl({
                src: ['assets/sounds/powerup.wav'],
                volume: 0.6
            }),
            levelUp: new Howl({
                src: ['assets/sounds/levelup.wav'],
                volume: 0.7
            }),
            gameOver: new Howl({
                src: ['assets/sounds/gameover.wav'],
                volume: 0.8
            }),
            background: new Howl({
                src: ['assets/sounds/background.mp3'],
                volume: 0.4,
                loop: true
            })
        };
        
        this.masterVolume = 0.7;
        this.updateVolume();
        
        // Setup volume control
        document.getElementById('volume').addEventListener('input', (e) => {
            this.masterVolume = parseFloat(e.target.value);
            this.updateVolume();
        });
    }
    
    updateVolume() {
        for (const key in this.sounds) {
            this.sounds[key].volume(this.masterVolume);
        }
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].play();
        }
    }
    
    stop(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].stop();
        }
    }
}

const audioManager = new AudioManager();