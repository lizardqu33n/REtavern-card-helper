/**
 * MVU Validator Tests - 确保双向前缀检测修复不会回退
 */
import { describe, it, expect } from 'vitest';
import { validateMvuConfig } from './mvu-validator';
import type { MvuConfig, MvuVariable, MvuVariableKind } from '../constants/defaults';

describe('MVU Validator - 前缀冲突双检测', () => {
  const createConfig = (overrides: Partial<MvuConfig> = {}): MvuConfig => ({
    enabled: true, // 必须启用才能执行验证
    variables: [],
    schemaJs: '',
    initvarYaml: '',
    updateRulesYaml: '',
    variableListMd: '',
    outputFormatMd: '',
    statusBarEnabled: false,
    statusBarHtml: '',
    statusBarCss: '',
    statusBarMode: 'safe_macro',
    statusBarStylePrompt: '',
    statusBarCustomEnabled: false,
    storyBeautifyEnabled: false,
    storyBeautifyTag: '',
    storyBeautifyHtml: '',
    ...overrides,
  });

  // 创建变量的辅助函数，包含所有必需字段
  const createVar = (overrides: Partial<MvuVariable> = {}): MvuVariable => ({
    id: 'v1',
    path: ['stat_data', 'test_var'],
    kind: 'string' as MvuVariableKind,
    hidden: false,
    readonly: false,
    description: '测试变量描述',
    defaultValue: 'test',
    ...overrides,
  });

  describe('正向检测：前缀暗示属性', () => {
    it('应该警告：以 $ 开头但未标记 hidden', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '1',
            path: ['stat_data', '$hidden_var'],
            hidden: false, // 问题：$ 开头但 hidden 为 false
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      expect(issues.some(i => i.message.includes('以 $ 开头但未标记为隐藏'))).toBe(true);
    });

    it('应该警告：以 _ 开头但未标记 readonly', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '2',
            path: ['stat_data', '_readonly_var'],
            readonly: false, // 问题：_ 开头但 readonly 为 false
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      expect(issues.some(i => i.message.includes('以 _ 开头但未标记为只读'))).toBe(true);
    });
  });

  describe('反向检测：属性暗示前缀', () => {
    it('应该警告：已标记 hidden 但路径不以 $ 开头（修复后的逻辑）', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '3',
            path: ['stat_data', 'hidden_var'],
            hidden: true, // 问题：标记为隐藏但路径不以 $ 开头
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      expect(issues.some(i => i.message.includes('已标记为隐藏但路径不以 $ 开头'))).toBe(true);
    });

    it('应该警告：已标记 readonly 但路径不以 _ 开头（修复后的逻辑）', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '4',
            path: ['stat_data', 'readonly_var'],
            readonly: true, // 问题：标记为只读但路径不以 _ 开头
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      expect(issues.some(i => i.message.includes('已标记为只读但路径不以 _ 开头'))).toBe(true);
    });
  });

  describe('正常情况：前缀和属性匹配', () => {
    it('应该通过：$ 开头且 hidden=true', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '5',
            path: ['stat_data', '$hidden_var'],
            hidden: true,
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      // 不应该有前缀相关的警告
      const prefixIssues = issues.filter(i => i.category === '前缀不一致');
      expect(prefixIssues.length).toBe(0);
    });

    it('应该通过：_ 开头且 readonly=true', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '6',
            path: ['stat_data', '_readonly_var'],
            readonly: true,
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      // 不应该有前缀相关的警告
      const prefixIssues = issues.filter(i => i.category === '前缀不一致');
      expect(prefixIssues.length).toBe(0);
    });

    it('应该通过：普通变量（无前缀，无特殊属性）', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '7',
            path: ['stat_data', 'normal_var'],
            hidden: false,
            readonly: false,
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      // 不应该有前缀相关的警告
      const prefixIssues = issues.filter(i => i.category === '前缀不一致');
      expect(prefixIssues.length).toBe(0);
    });
  });

  describe('回归测试：确保修复前的单方向检测仍然存在', () => {
    it('修复前的问题场景：$ 开头但 hidden=false（正向检测）', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '8',
            path: ['stat_data', '$wrong_hidden'],
            hidden: false,
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      // 正向检测应该仍然工作
      expect(issues.some(i => i.message.includes('以 $ 开头但未标记为隐藏'))).toBe(true);
    });

    it('修复前的问题场景：_ 开头但 readonly=false（正向检测）', () => {
      const config = createConfig({
        variables: [
          createVar({
            id: '9',
            path: ['stat_data', '_wrong_readonly'],
            readonly: false,
          }),
        ],
      });

      const issues = validateMvuConfig(config);

      // 正向检测应该仍然工作
      expect(issues.some(i => i.message.includes('以 _ 开头但未标记为只读'))).toBe(true);
    });
  });
});
