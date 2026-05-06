import type { Element, Block, ElementCategory } from './types';
import { getAllElements } from './registry';

export function getElementsByPeriod(period: 1 | 2 | 3 | 4 | 5 | 6 | 7): readonly Element[] {
  return getAllElements().filter((e) => e.period === period);
}

export function getElementsByGroup(group: number): readonly Element[] {
  return getAllElements().filter((e) => e.group === group);
}

export function getElementsByBlock(block: Block): readonly Element[] {
  return getAllElements().filter((e) => e.block === block);
}

export function getElementsByCategory(category: ElementCategory): readonly Element[] {
  return getAllElements().filter((e) => e.category === category);
}
