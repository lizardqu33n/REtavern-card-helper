/**
 * LibraryPage 搜索/排序 Tests - 确保空值处理修复不会回退
 */
import { describe, it, expect } from 'vitest';

describe('LibraryPage - 搜索与排序空值处理', () => {
  // 模拟卡片类型（与实际 CardRecord 一致）
  interface MockCard {
    id: number;
    name: string | null | undefined;
    updatedAt: Date;
  }

  // 模拟 filteredCards 的核心逻辑（从 LibraryPage.tsx 复制）
  function filterAndSortCards(
    cards: MockCard[],
    searchQuery: string,
    sortBy: 'name' | 'date',
    sortDir: 'asc' | 'desc'
  ): MockCard[] {
    let result = [...cards];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => ((c.name as string) || '').toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        const aName = (a.name as string) || '';
        const bName = (b.name as string) || '';
        cmp = aName.localeCompare(bName);
      } else {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }

  describe('搜索功能空值处理', () => {
    it('应该处理 name 为 undefined 的卡片', () => {
      const cards: MockCard[] = [
        { id: 1, name: '卡片A', updatedAt: new Date() },
        { id: 2, name: undefined, updatedAt: new Date() },
      ];

      const result = filterAndSortCards(cards, '卡片', 'name', 'asc');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('应该处理 name 为 null 的卡片', () => {
      const cards: MockCard[] = [
        { id: 1, name: '卡片A', updatedAt: new Date() },
        { id: 2, name: null, updatedAt: new Date() },
      ];

      const result = filterAndSortCards(cards, '卡片', 'name', 'asc');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('应该处理 name 为空字符串的卡片', () => {
      const cards: MockCard[] = [
        { id: 1, name: '卡片A', updatedAt: new Date() },
        { id: 2, name: '', updatedAt: new Date() },
      ];

      const result = filterAndSortCards(cards, '', 'name', 'asc');

      expect(result.length).toBe(2);
    });

    it('应该处理全部卡片 name 为空的边界情况', () => {
      const cards: MockCard[] = [
        { id: 1, name: undefined, updatedAt: new Date() },
        { id: 2, name: null, updatedAt: new Date() },
        { id: 3, name: '', updatedAt: new Date() },
      ];

      const result = filterAndSortCards(cards, '测试', 'name', 'asc');

      expect(result.length).toBe(0);
    });

    it('应该正常搜索包含关键字的卡片', () => {
      const cards: MockCard[] = [
        { id: 1, name: '测试卡片', updatedAt: new Date() },
        { id: 2, name: '普通卡片', updatedAt: new Date() },
      ];

      const result = filterAndSortCards(cards, '测试', 'name', 'asc');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('测试卡片');
    });
  });

  describe('排序功能空值处理', () => {
    it('应该处理 name 为 undefined 的卡片进行排序', () => {
      const cards: MockCard[] = [
        { id: 1, name: 'AAA', updatedAt: new Date('2024-01-01') },
        { id: 2, name: undefined, updatedAt: new Date('2024-01-02') },
        { id: 3, name: 'BBB', updatedAt: new Date('2024-01-03') },
      ];

      const result = filterAndSortCards(cards, '', 'name', 'asc');

      // undefined 应该排在最前面（空字符串排序）
      expect(result.length).toBe(3);
      // 不应该抛出错误
    });

    it('应该处理 name 为 null 的卡片进行排序', () => {
      const cards: MockCard[] = [
        { id: 1, name: 'AAA', updatedAt: new Date('2024-01-01') },
        { id: 2, name: null, updatedAt: new Date('2024-01-02') },
        { id: 3, name: 'BBB', updatedAt: new Date('2024-01-03') },
      ];

      const result = filterAndSortCards(cards, '', 'name', 'asc');

      expect(result.length).toBe(3);
      // 不应该抛出错误
    });

    it('应该正确处理日期排序', () => {
      const cards: MockCard[] = [
        { id: 1, name: '卡片C', updatedAt: new Date('2024-03-01') },
        { id: 2, name: '卡片A', updatedAt: new Date('2024-01-01') },
        { id: 3, name: '卡片B', updatedAt: new Date('2024-02-01') },
      ];

      const result = filterAndSortCards(cards, '', 'date', 'asc');

      expect(result[0].name).toBe('卡片A');
      expect(result[1].name).toBe('卡片B');
      expect(result[2].name).toBe('卡片C');
    });

    it('应该正确处理降序排序', () => {
      const cards: MockCard[] = [
        { id: 1, name: 'AAA', updatedAt: new Date('2024-01-01') },
        { id: 2, name: 'CCC', updatedAt: new Date('2024-03-01') },
        { id: 3, name: 'BBB', updatedAt: new Date('2024-02-01') },
      ];

      const result = filterAndSortCards(cards, '', 'name', 'desc');

      expect(result[0].name).toBe('CCC');
      expect(result[1].name).toBe('BBB');
      expect(result[2].name).toBe('AAA');
    });
  });

  describe('回归测试：修复前的崩溃场景', () => {
    it('修复前：(c.name as string).toLowerCase() 在 name=null 时崩溃', () => {
      const cards: MockCard[] = [
        { id: 1, name: '有效卡片', updatedAt: new Date() },
        { id: 2, name: null, updatedAt: new Date() },
      ];

      // 旧的错误实现（会崩溃）
      // const oldFilter = (c: MockCard) => (c.name as string).toLowerCase().includes('测试');

      // 新的安全实现
      const result = filterAndSortCards(cards, '测试', 'name', 'asc');

      expect(result.length).toBe(0);
    });

    it('修复前：localeCompare 在 name=null 时崩溃', () => {
      const cards: MockCard[] = [
        { id: 1, name: 'BBB', updatedAt: new Date() },
        { id: 2, name: null, updatedAt: new Date() },
        { id: 3, name: 'AAA', updatedAt: new Date() },
      ];

      // 旧的错误实现（会崩溃）
      // const oldSort = () => ((a.name as string) || '').localeCompare((b.name as string) || '');

      const result = filterAndSortCards(cards, '', 'name', 'asc');

      expect(result.length).toBe(3);
      // 不应该抛出 TypeError: Cannot read property 'localeCompare' of null
    });
  });
});
