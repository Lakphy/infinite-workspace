/**
 * SnapEngine — detects alignment between a dragged window and other windows,
 * snaps position when within threshold, and renders alignment guide lines.
 */

export class SnapEngine {
  private viewport: HTMLElement;
  private guides: HTMLDivElement[] = [];
  public threshold: number; // in screen pixels
  public enabled: boolean;

  constructor(viewport: HTMLElement, threshold = 8) {
    this.viewport = viewport;
    this.threshold = threshold;
    this.enabled = true;
  }

  /**
   * Given a dragged window's canvas-space rect, check alignment against
   * other windows and return the snapped position.  Also renders guide lines.
   *
   * @returns snapped { x, y } in canvas coordinates
   */
  snap(
    x: number,
    y: number,
    width: number,
    height: number,
    others: { x: number; y: number; width: number; height: number }[],
    scale: number,
    translate: { x: number; y: number }
  ): { x: number; y: number } {
    // When disabled, return position as-is and clear any leftover guides
    if (!this.enabled) {
      this.clearGuides();
      return { x, y };
    }

    // Convert screen-pixel threshold to canvas-space
    const thresh = this.threshold / scale;

    const dragEdges = {
      left: x,
      right: x + width,
      centerX: x + width / 2,
      top: y,
      bottom: y + height,
      centerY: y + height / 2,
    };

    let bestDx = Infinity;
    let snapX = x;
    let bestDy = Infinity;
    let snapY = y;
    const guideVs: number[] = []; // canvas-X positions for vertical guides
    const guideHs: number[] = []; // canvas-Y positions for horizontal guides

    for (const other of others) {
      const otherEdges = {
        left: other.x,
        right: other.x + other.width,
        centerX: other.x + other.width / 2,
        top: other.y,
        bottom: other.y + other.height,
        centerY: other.y + other.height / 2,
      };

      // --- X axis alignment ---
      const xPairs: [number, number][] = [
        [dragEdges.left, otherEdges.left],
        [dragEdges.left, otherEdges.right],
        [dragEdges.right, otherEdges.left],
        [dragEdges.right, otherEdges.right],
        [dragEdges.centerX, otherEdges.centerX],
      ];

      for (const [dragVal, otherVal] of xPairs) {
        const diff = Math.abs(dragVal - otherVal);
        if (diff < thresh) {
          if (diff < bestDx - 0.01) {
            bestDx = diff;
            snapX = x + (otherVal - dragVal);
            guideVs.length = 0;
            guideVs.push(otherVal);
          } else if (diff < bestDx + 0.01) {
            if (!guideVs.includes(otherVal)) guideVs.push(otherVal);
          }
        }
      }

      // --- Y axis alignment ---
      const yPairs: [number, number][] = [
        [dragEdges.top, otherEdges.top],
        [dragEdges.top, otherEdges.bottom],
        [dragEdges.bottom, otherEdges.top],
        [dragEdges.bottom, otherEdges.bottom],
        [dragEdges.centerY, otherEdges.centerY],
      ];

      for (const [dragVal, otherVal] of yPairs) {
        const diff = Math.abs(dragVal - otherVal);
        if (diff < thresh) {
          if (diff < bestDy - 0.01) {
            bestDy = diff;
            snapY = y + (otherVal - dragVal);
            guideHs.length = 0;
            guideHs.push(otherVal);
          } else if (diff < bestDy + 0.01) {
            if (!guideHs.includes(otherVal)) guideHs.push(otherVal);
          }
        }
      }
    }

    this.renderGuides(guideVs, guideHs, scale, translate);
    return { x: snapX, y: snapY };
  }

  /** Create / update guide line DOM elements */
  private renderGuides(
    verticals: number[],
    horizontals: number[],
    scale: number,
    translate: { x: number; y: number }
  ) {
    this.clearGuides();

    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;

    for (const cx of verticals) {
      const screenX = cx * scale + translate.x;
      const line = document.createElement("div");
      line.className = "snap-guide-v";
      line.style.left = `${screenX}px`;
      line.style.top = "0";
      line.style.height = `${vh}px`;
      this.viewport.appendChild(line);
      this.guides.push(line);
    }

    for (const cy of horizontals) {
      const screenY = cy * scale + translate.y;
      const line = document.createElement("div");
      line.className = "snap-guide-h";
      line.style.top = `${screenY}px`;
      line.style.left = "0";
      line.style.width = `${vw}px`;
      this.viewport.appendChild(line);
      this.guides.push(line);
    }
  }

  /** Remove all guide line DOM elements */
  clearGuides() {
    for (const g of this.guides) g.remove();
    this.guides = [];
  }
}
