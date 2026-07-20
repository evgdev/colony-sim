import Phaser from 'phaser';
import { COLORS } from '../config';
import { getLayout } from './LayoutConfig';

export class QuestModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const L = getLayout();
    this.container = this.scene.add.container(0, 0).setDepth(90).setVisible(false);

    // Overlay
    const overlay = this.scene.add.rectangle(
      L.canvasW / 2, L.canvasH / 2,
      L.canvasW, L.canvasH,
      0x000000, 0.6
    ).setInteractive().on('pointerdown', () => this.hide());
    this.container.add(overlay);

    // Modal box
    const boxW = Math.min(520, L.canvasW - 40);
    const boxH = Math.min(420, L.canvasH - 40);
    const boxX = (L.canvasW - boxW) / 2;
    const boxY = (L.canvasH - boxH) / 2;

    const bg = this.scene.add.rectangle(boxX, boxY, boxW, boxH, 0x0d1117, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x30363d);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(boxX + boxW / 2, boxY + 16, 'ТЕКУЩИЙ КВЕСТ', {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Divider
    const divider = this.scene.add.rectangle(boxX + 16, boxY + 44, boxW - 32, 1, 0x30363d);
    this.container.add(divider);

    // Quest title
    const questTitle = this.scene.add.text(boxX + 20, boxY + 56, '', {
      fontSize: '16px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: boxW - 40 },
    });
    this.container.add(questTitle);

    // Quest description
    const questDesc = this.scene.add.text(boxX + 20, boxY + 80, '', {
      fontSize: '13px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: boxW - 40 }, lineSpacing: 4,
    });
    this.container.add(questDesc);

    // Objectives header
    const objHeader = this.scene.add.text(boxX + 20, boxY + 150, 'ЦЕЛИ:', {
      fontSize: '13px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    });
    this.container.add(objHeader);

    // Objectives list
    const objText = this.scene.add.text(boxX + 20, boxY + 172, '', {
      fontSize: '13px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: boxW - 40 }, lineSpacing: 5,
    });
    this.container.add(objText);

    // Rewards header
    const rewardHeader = this.scene.add.text(boxX + 20, boxY + 280, 'НАГРАДЫ:', {
      fontSize: '13px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    });
    this.container.add(rewardHeader);

    // Rewards list
    const rewardText = this.scene.add.text(boxX + 20, boxY + 302, '', {
      fontSize: '13px', color: '#44ff44', fontFamily: 'monospace',
      wordWrap: { width: boxW - 40 }, lineSpacing: 4,
    });
    this.container.add(rewardText);

    // Close button
    const closeBtn = this.scene.add.text(boxX + boxW - 16, boxY + boxH - 12, 'ЗАКРЫТЬ', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 16, y: 6 },
    }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => closeBtn.setColor('#ffffff'))
      .on('pointerout', () => closeBtn.setColor('#c9d1d9'))
      .on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // Store refs for update
    (this as any).questTitle = questTitle;
    (this as any).questDesc = questDesc;
    (this as any).objText = objText;
    (this as any).rewardText = rewardText;
  }

  show(questManager: any): void {
    if (!questManager) return;

    const active = questManager.getActiveQuests();
    const available = questManager.getAvailableQuests();

    const questTitle = (this as any).questTitle as Phaser.GameObjects.Text;
    const questDesc = (this as any).questDesc as Phaser.GameObjects.Text;
    const objText = (this as any).objText as Phaser.GameObjects.Text;
    const rewardText = (this as any).rewardText as Phaser.GameObjects.Text;

    if (active.length > 0) {
      const { quest, state } = active[0];
      questTitle.setText(quest.title);
      questDesc.setText(quest.description);

      // Objectives
      const objLines: string[] = [];
      for (const obj of state.objectives) {
        if (obj.type === 'resource' && obj.resource && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Собрать ${obj.resource}: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'building' && obj.building && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Построить ${obj.building}: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'kill' && obj.species && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Убить ${obj.species}: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'kill_melee' && obj.species && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Убить ${obj.species} вручную: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'survive_ticks' && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Продержаться: ${obj.current || 0} / ${obj.amount} тиков`);
        } else if (obj.type === 'artifact' && obj.name && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const mark = done ? '✓' : '○';
          objLines.push(`${mark} Найти ${obj.name}: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'reach_tile') {
          const mark = obj.found ? '✓' : '○';
          objLines.push(`${mark} Исследовать точку: ${obj.pointName || '?'}`);
        } else if (obj.type === 'reach_dino') {
          const mark = obj.found ? '✓' : '○';
          objLines.push(`${mark} Подойти к ${obj.species}`);
        } else if (obj.type === 'research' && obj.amount !== undefined) {
          const done = (obj.current || 0) >= obj.amount;
          const rmark = done ? '✓' : '○';
          objLines.push(`${rmark} Исследовать растения: ${obj.current || 0} / ${obj.amount}`);
        } else if (obj.type === 'activate_radio') {
          objLines.push('○ Активировать радио');
        }
      }
      if (state.ticksRemaining !== undefined && state.ticksRemaining !== null) {
        objLines.push(`⏱ Осталось: ${state.ticksRemaining} тиков`);
      }
      objText.setText(objLines.join('\n'));

      // Rewards
      const rewardLines: string[] = [];
      for (const r of quest.rewards) {
        if (r.type === 'resource' && r.resource && r.amount) {
          rewardLines.push(`+ ${r.amount} ${r.resource}`);
        } else if (r.type === 'unlock' && r.building) {
          rewardLines.push(`+ Разблокировка: ${r.building}`);
        } else if (r.type === 'effect' && r.effect) {
          rewardLines.push(`+ Бафф: ${r.effect} ${r.value || ''}`);
        } else if (r.type === 'heal_all') {
          rewardLines.push(`+ Полное лечение всех`);
        } else if (r.type === 'artifact_loot' && r.name) {
          rewardLines.push(`+ Трофей: ${r.name}`);
        } else if (r.type === 'victory') {
          rewardLines.push(`★ ПОБЕДА!`);
        }
      }
      rewardText.setText(rewardLines.join('\n') || 'Нет наград');
    } else if (available.length > 0) {
      const { quest } = available[0];
      questTitle.setText(quest.title);
      questDesc.setText(quest.description);
      objText.setText('Квест доступен. Начни его!');
      rewardText.setText('');
    } else {
      questTitle.setText('Нет активных квестов');
      questDesc.setText('');
      objText.setText('');
      rewardText.setText('');
    }

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
    });
    this.visible = true;
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
      },
    });
  }

  get isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container?.destroy();
  }
}
