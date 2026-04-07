import { Scene } from 'phaser';

export class InfoScene extends Scene {
    constructor() {
        super('Info');
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const margin = 60;
        
        // 1. Audio & Background
        this.sound.stopAll();
        const bgm = this.sound.add('creepy_piano', { volume: 0.4, loop: true });
        bgm.play();

        
        // 2. Header
        this.add.text(centerX, 45, "CLASSIFIED ARCHIVE: THE ZOUHRI PHENOMENON", {
            fontSize: '28px', fill: '#800000', fontFamily: 'serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        // --- SECTION 1: ORIGINS (Image Left) ---
        const pic1 = this.add.image(margin + 110, 160, 'info_pic1').setDisplaySize(200, 140).setAngle(-2);
        const text1 = "In the remote regions of North Africa, the 'Zouhri' are not mere legends. They are children believed to be born under the star of Zohra (Venus), bridging the gap between our world and the unseen. Sorcerers believe their blood possesses a 'spiritual sweetness' that can appease the ancient Djinn who guard the treasures of the earth. For centuries, this belief has fueled a clandestine market where children are valued more for their genetic 'keys' than their lives.";
        this.add.text(pic1.x + 120, 100, text1, {
            fontSize: '18px', fill: '#666', fontFamily: 'serif', fontStyle: 'italic',
            wordWrap: { width: width - (pic1.x + 160) }, lineSpacing: 5, align: 'justify'
        });

        // --- SECTION 2: THE MARKERS (Image Right) ---
        const pic2 = this.add.image(width - margin - 110, 340, 'info_pic2').setDisplaySize(200, 140).setAngle(2);
        const text2 = "Identification is precise and cruel. Sorcerers seek the 'Line of Destiny', a single horizontal crease across the palm known as a Simian line. Other markers include mismatched eye colors (heterochromia) or a specific hair whorl pattern on the crown. To the Sahar (sorcerer), these are not medical anomalies, they are divine stamps of ownership. A child possessing multiple markers is considered a 'Great Key,' capable of opening vaults that have been sealed for millennia.";
        this.add.text(margin, 280, text2, {
            fontSize: '18px', fill: '#666', fontFamily: 'serif', fontStyle: 'italic',
            wordWrap: { width: pic2.x - 180 }, lineSpacing: 5, align: 'justify'
        });

        // --- SECTION 3: THE HUNT (Image Left) ---
        const pic3 = this.add.image(margin + 110, 520, 'info_pic3').setDisplaySize(200, 140).setAngle(-2);
        const text3 = "The mountains of the Tunisian Northwest, specifically the dense oak forests of the Kroumirie, serve as the primary theater for these rituals. Treasure hunters known as 'Kounouzia' traverse these peaks, using ancient maps and dark incantations. They believe the earth will not yield its gold without the blood or presence of a Zouhri. This archive stands as a grim reminder of those who were led into the mist and never returned to the valleys below.";
        this.add.text(pic3.x + 120, 460, text3, {
            fontSize: '18px', fill: '#666', fontFamily: 'serif', fontStyle: 'italic',
            wordWrap: { width: width - (pic3.x + 160) }, lineSpacing: 5, align: 'justify'
        });

        // 3. Image Effects
        [pic1, pic2, pic3].forEach(pic => {
            const border = this.add.graphics();
            border.lineStyle(2, 0x330000, 1);
            border.strokeRect(pic.x - (pic.displayWidth/2), pic.y - (pic.displayHeight/2), pic.displayWidth, pic.displayHeight);
        });

        // 4. Back Button
        const backBtn = this.add.text(centerX, height - 100, "← BACK TO MENU", {
            fontSize: '24px', fill: '#666', fontFamily: 'serif'
        })
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerover', () => backBtn.setStyle({ fill: '#800000' }))
        .on('pointerout', () => backBtn.setStyle({ fill: '#666' }))
        .on('pointerdown', () => {
            this.sound.play('click');
            this.cameras.main.shake(50, 0.005);
            this.time.delayedCall(300, () => this.scene.start('MainMenu'));
        });
        
        // 5. Scanlines (Fixed)
        const scanlines = this.add.graphics().setDepth(10).setScrollFactor(0);
        scanlines.lineStyle(1, 0x000000, 0.2);
        for (let i = 0; i < height; i += 4) {
            scanlines.lineBetween(0, i, width, i);
        }
    }
}