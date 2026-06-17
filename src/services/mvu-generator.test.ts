/**
 * MVU Generator Tests - 确保修复后的核心逻辑不会回退
 */
import { describe, it, expect } from 'vitest';
import { buildStatusBarHtml } from './mvu-generator';
import type { MvuVariable } from '../constants/defaults';

// 直接测试 escapeJsString 功能（通过 buildStatusBarHtml 的 dynamic_js 模式间接验证）
describe('MVU Generator - escapeJsString', () => {
  // 创建变量的辅助函数
  const createVar = (overrides: Partial<MvuVariable> = {}): MvuVariable => ({
    id: 'v1',
    path: ['stat_data', 'test_var'],
    kind: 'string',
    defaultValue: 'test',
    description: '测试变量',
    hidden: false,
    readonly: false,
    ...overrides,
  });

  it('应该正确转义包含单引号的字符串', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '1',
        path: ['stat_data', 'var_with_quotes'],
        defaultValue: "value with 'quotes'",
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // HTML 应该包含转义后的单引号
    expect(html).toContain("value with \\'quotes\\'");
    // 检查 JS 代码块中的内容
    const jsMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    expect(jsMatch).not.toBeNull();
    const jsCode = jsMatch![1];

    // 单引号应该被转义
    expect(jsCode).toContain("\\'");
  });

  it('应该正确转义包含双引号的字符串', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '2',
        path: ['stat_data', 'var_with_dbl_quotes'],
        defaultValue: 'value with "double quotes"',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // HTML 应该包含转义后的双引号
    expect(html).toContain('value with \\"double quotes\\"');
  });

  it('应该正确转义包含反斜杠的字符串', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '3',
        path: ['stat_data', 'var_with_backslash'],
        defaultValue: 'path\\to\\file',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // 反斜杠应该被转义
    expect(html).toContain('\\\\');
  });

  it('应该正确转义包含换行符的字符串', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '4',
        path: ['stat_data', 'multiline'],
        defaultValue: 'line1\nline2',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // 换行符应该被转义
    expect(html).toContain('\\n');
  });

  it('应该正确转义包含尖括号的字符串（XSS防护）', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '5',
        path: ['stat_data', 'xss_test'],
        defaultValue: '<script>alert("xss")</script>',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // 尖括号应该被转义
    expect(html).toContain('\\x3c');
    expect(html).toContain('\\x3e');
  });

  it('应该处理空的默认值', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '6',
        path: ['stat_data', 'empty'],
        defaultValue: '',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');
    expect(html).toBeTruthy();
    // 不应该崩溃
  });

  it('应该处理数字类型的默认值', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '7',
        path: ['stat_data', 'number_val'],
        kind: 'number',
        defaultValue: 42,
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');
    expect(html).toContain('42');
  });

  it('应该处理包含特殊字符的路径', () => {
    const variables: MvuVariable[] = [
      createVar({
        id: '8',
        path: ['stat_data', "path.with.dots.and'quotes"],
        defaultValue: 'test',
      }),
    ];

    const html = buildStatusBarHtml(variables, 'dynamic_js');

    // 路径中的单引号应该被转义
    expect(html).toContain("\\'");
  });
});
