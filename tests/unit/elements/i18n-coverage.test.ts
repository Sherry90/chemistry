import { describe, it, expect } from 'vitest';
import { getAllElements } from '@/chemistry/elements';
import enChemistry from '@/i18n/resources/en/chemistry.json';
import koChemistry from '@/i18n/resources/ko/chemistry.json';

describe('i18n coverage for elements', () => {
  const elements = getAllElements();

  it('all 118 element numbers have English names in chemistry.json', () => {
    for (const el of elements) {
      const key = String(el.number) as keyof typeof enChemistry.element;
      expect(enChemistry.element[key]).toBeDefined();
      expect(enChemistry.element[key]?.name).toBeTruthy();
    }
  });

  it('all 118 element numbers have Korean names in chemistry.json', () => {
    for (const el of elements) {
      const key = String(el.number) as keyof typeof koChemistry.element;
      expect(koChemistry.element[key]).toBeDefined();
      expect(koChemistry.element[key]?.name).toBeTruthy();
    }
  });

  it('English names match element data nameEn', () => {
    for (const el of elements) {
      const key = String(el.number) as keyof typeof enChemistry.element;
      expect(enChemistry.element[key]?.name).toBe(el.nameEn);
    }
  });

  it('Korean names match element data nameKo', () => {
    for (const el of elements) {
      const key = String(el.number) as keyof typeof koChemistry.element;
      expect(koChemistry.element[key]?.name).toBe(el.nameKo);
    }
  });

  it('all category keys exist in both locales', () => {
    const categories = [
      'alkali-metal',
      'alkaline-earth-metal',
      'transition-metal',
      'post-transition-metal',
      'metalloid',
      'reactive-nonmetal',
      'noble-gas',
      'lanthanide',
      'actinide',
      'unknown',
    ];
    for (const cat of categories) {
      expect(enChemistry.category[cat as keyof typeof enChemistry.category]).toBeTruthy();
      expect(koChemistry.category[cat as keyof typeof koChemistry.category]).toBeTruthy();
    }
  });

  it('all block keys exist in both locales', () => {
    const blocks = ['s', 'p', 'd', 'f'];
    for (const b of blocks) {
      expect(enChemistry.block[b as keyof typeof enChemistry.block]).toBeTruthy();
      expect(koChemistry.block[b as keyof typeof koChemistry.block]).toBeTruthy();
    }
  });
});
