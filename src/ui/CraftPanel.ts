import Phaser from 'phaser';
import { COLORS } from '../config';
import { Simulation } from '../core/Simulation';
import { Building } from '../entities/Building';
import { Settler } from '../entities/Settler';

export interface CraftRecipe {
  id: string;
  name: string;
  description: string;
  cost: Record<string, number>;
  effect: { type: string; value: number };
  craftTime: number;
}

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 520;
const ITEM_HEIGHT = 80;

const RECIPE_ICONS: Record<string, string> = {
  medkit: '💊',
  herbal_poultice: '🌿',
  signal_flare: '🔥',
  reinforced_wall: '🧱',
  bone_armor: '🦴',
  rope: '🪢',
  bio_scanner: '📡',
  stone_axe: '🪓',
};

export class CraftPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private visible: boolean = false;
  private recipeButtons: Phaser.GameObjects.Container[] = [];
  private onCraft: ((recipeId: string, workshop: Building) => void) | null = null;
  private onUse: ((recipeId: string, workshop: Building) => void) | null = null;
  private workshop: Building | null = null;
  private simulation: Simulation | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    workshop: Building,
    recipes: CraftRecipe[],
    simulation: Simulation,
    onCraft: (recipeId: string, workshop: Building) => void,
    onUse?: (recipeId: string, workshop: Building) => void
  ): void {
    this.hide();
    this.workshop = workshop;
    this.simulation = simulation;
    this.onCraft = onCraft;
    this.onUse = onUse ?? null;
    this.visible = true;

    const cx = 750;
    const cy = 450;

    this.container = this.scene.add.container(0, 0).setDepth(100);

    // Add mask to clip items within panel bounds
    this.maskGraphics = this.scene.add.graphics();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(cx - PANEL_WIDTH / 2, cy - PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT);
    this.maskGraphics.setVisible(false);
    const mask = this.maskGraphics.createGeometryMask();
    this.container.setMask(mask);

    const bg = this.scene.add.rectangle(cx, cy, PANEL_WIDTH, PANEL_HEIGHT, 0x0d1117, 0.97)
      .setOrigin(0.5).setStrokeStyle(2, COLORS.panelBorder);
    this.container.add(bg);

    const title = this.scene.add.text(cx, cy - PANEL_HEIGHT / 2 + 16, '── Workshop Crafting ──', {
      fontSize: '15px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const closeBtn = this.scene.add.text(cx + PANEL_WIDTH / 2 - 20, cy - PANEL_HEIGHT / 2 + 8, '[X]', {
      fontSize: '14px', color: '#ff4444', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    let y = cy - PANEL_HEIGHT / 2 + 44;

    if (recipes.length === 0) {
      const emptyText = this.scene.add.text(cx, y + 40, 'No recipes available', {
        fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.container.add(emptyText);
    }

    for (const recipe of recipes) {
      const itemContainer = this.scene.add.container(cx - PANEL_WIDTH / 2 + 12, y);

      const itemBg = this.scene.add.rectangle(PANEL_WIDTH / 2 - 12, ITEM_HEIGHT / 2, PANEL_WIDTH - 24, ITEM_HEIGHT - 4, 0x161b22, 0.9)
        .setOrigin(0.5).setStrokeStyle(1, COLORS.panelBorder);
      itemContainer.add(itemBg);

      // Icon
      const icon = RECIPE_ICONS[recipe.id] || '📦';
      const iconText = this.scene.add.text(14, ITEM_HEIGHT / 2, icon, {
        fontSize: '22px',
      }).setOrigin(0, 0.5);
      itemContainer.add(iconText);

      const nameText = this.scene.add.text(42, 6, recipe.name, {
        fontSize: '13px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
      });
      itemContainer.add(nameText);

      const descText = this.scene.add.text(42, 24, recipe.description, {
        fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
        wordWrap: { width: PANEL_WIDTH - 140 },
      });
      itemContainer.add(descText);

      const costStr = Object.entries(recipe.cost)
        .map(([r, q]) => `${r}:${q}`)
        .join('  ');
      const costText = this.scene.add.text(42, 48, costStr, {
        fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
      });
      itemContainer.add(costText);

      const canAfford = this.checkAfford(recipe);
      const craftBtn = this.scene.add.text(PANEL_WIDTH - 80, 28, '[Craft]', {
        fontSize: '12px', color: canAfford ? '#44ff44' : '#484f58', fontFamily: 'monospace',
        backgroundColor: canAfford ? '#16213e' : '#0d1117',
        padding: { x: 6, y: 3 },
      });

      if (canAfford) {
        craftBtn.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            if (this.onCraft && this.workshop) {
              this.onCraft(recipe.id, this.workshop);
              this.hide();
            }
          })
          .on('pointerover', () => craftBtn.setColor('#ffffff'))
          .on('pointerout', () => craftBtn.setColor('#44ff44'));
      }
      itemContainer.add(craftBtn);

      const timeText = this.scene.add.text(PANEL_WIDTH - 80, 50, `${recipe.craftTime} ticks`, {
        fontSize: '10px', color: '#8b949e', fontFamily: 'monospace',
      });
      itemContainer.add(timeText);

      this.container.add(itemContainer);
      this.recipeButtons.push(itemContainer);
      y += ITEM_HEIGHT;
    }

    if (this.workshop && this.workshop.craftedItems.length > 0) {
      y += 8;
      const storageTitle = this.scene.add.text(cx - PANEL_WIDTH / 2 + 12, y, '── Storage ──', {
        fontSize: '13px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
      });
      this.container.add(storageTitle);
      y += 20;

      for (const item of this.workshop.craftedItems) {
        if (item.quantity <= 0) continue;

        const itemIcon = RECIPE_ICONS[item.resourceType] || '📦';
        const iconText = this.scene.add.text(cx - PANEL_WIDTH / 2 + 14, y + 10, itemIcon, {
          fontSize: '16px',
        });
        this.container.add(iconText);

        const itemText = this.scene.add.text(cx - PANEL_WIDTH / 2 + 36, y, `${item.resourceType} x${item.quantity}`, {
          fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
        });
        this.container.add(itemText);

        if (this.onUse && this.workshop) {
          const useBtn = this.scene.add.text(cx + PANEL_WIDTH / 2 - 60, y - 2, '[Use]', {
            fontSize: '11px', color: '#44ff44', fontFamily: 'monospace',
            backgroundColor: '#16213e', padding: { x: 4, y: 2 },
          }).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
              if (this.onUse && this.workshop) {
                this.onUse(item.resourceType, this.workshop);
                this.hide();
              }
            })
            .on('pointerover', () => useBtn.setColor('#ffffff'))
            .on('pointerout', () => useBtn.setColor('#44ff44'));
          this.container.add(useBtn);
        }

        y += 22;
      }
    }
  }

  private checkAfford(recipe: CraftRecipe): boolean {
    if (!this.simulation) return false;
    return Object.entries(recipe.cost).every(([res, qty]) =>
      this.simulation!.hasResource(res, qty)
    );
  }

  hide(): void {
    if (this.container) {
      this.container.destroy();
    }
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }
    this.visible = false;
    this.recipeButtons = [];
    this.workshop = null;
    this.onCraft = null;
    this.onUse = null;
  }

  isVisible(): boolean {
    return this.visible;
  }
}
