/**
 * MVU Builder Tests - 验证 .prefault() 默认值修复
 */
import { describe, it, expect } from 'vitest';
import { buildSchemaTs, buildMvuScriptBundle } from './mvu-builder';
import { createEmptyMvuConfig } from '../constants/defaults';
import type { MvuSchemaSection } from '../constants/defaults';

describe('MVU Builder - .prefault() 修复验证', () => {
  function makeTestSections(): MvuSchemaSection[] {
    return [
      {
        name: '基础属性',
        variables: [
          {
            path: 'HP',
            zodType: 'z.coerce.number()',
            initialValue: 100,
            range: { min: 0, max: 100 },
            prefix: '',
            description: '角色生命值',
          },
          {
            path: 'MP',
            zodType: 'z.coerce.number()',
            initialValue: 50,
            prefix: '',
            description: '魔法值',
          },
          {
            path: '名字',
            zodType: 'z.string()',
            initialValue: '艾伦',
            prefix: '',
            description: '角色名',
          },
          {
            path: '存活',
            zodType: 'z.boolean()',
            initialValue: true,
            prefix: '',
            description: '是否存活',
          },
          {
            path: '阵营',
            zodType: 'z.enum(["守序善良","中立善良","混乱善良"])',
            initialValue: '守序善良',
            prefix: '',
            description: '人格阵营',
          },
        ],
      },
      {
        name: '嵌套属性',
        variables: [
          {
            path: '属性.力量',
            zodType: 'z.coerce.number()',
            initialValue: 10,
            range: { min: 0, max: 20 },
            prefix: '',
            description: '力量属性',
          },
          {
            path: '属性.敏捷',
            zodType: 'z.coerce.number()',
            initialValue: 12,
            range: { min: 0, max: 20 },
            prefix: '',
            description: '敏捷属性',
          },
          {
            path: '属性.智力',
            zodType: 'z.coerce.number()',
            initialValue: 14,
            range: { min: 0, max: 20 },
            prefix: '',
            description: '智力属性',
          },
        ],
      },
    ];
  }

  it('叶子数字字段应该有 .prefault(默认值)', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    expect(schema).toContain('.prefault(100)');
    expect(schema).toContain('.prefault(50)');
  });

  it('叶子字符串字段应该有 .prefault(默认值字符串)', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    expect(schema).toContain(".prefault('艾伦')");
  });

  it('叶子布尔字段应该有 .prefault(默认值)', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    expect(schema).toContain('.prefault(true)');
  });

  it('叶子枚举字段应该有 .prefault(默认值)', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    expect(schema).toContain(".prefault('守序善良')");
  });

  it('嵌套对象应该有 .prefault({...}) 包含完整默认值', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    expect(schema).toContain('.prefault({');
    expect(schema).toContain('力量: 10');
    expect(schema).toContain('敏捷: 12');
    expect(schema).toContain('智力: 14');
  });

  it('根级别z.object()不应该有.prefault()（匹配参考卡格式）', () => {
    const sections = makeTestSections();
    const schema = buildSchemaTs(sections);
    const lines = schema.split('\n');
    const lastObjectLine = lines.filter(l => l.includes('});')).pop();
    expect(lastObjectLine).toBe('});');
  });

  it('buildMvuScriptBundle 应该始终生成 updateRulesYaml', () => {
    const mvu = createEmptyMvuConfig();
    mvu.enabled = true;
    mvu.schemaSections = makeTestSections();
    const bundle = buildMvuScriptBundle(mvu);
    expect(bundle.updateRulesYaml).toBeTruthy();
    expect(bundle.updateRulesYaml).toContain('变量更新规则');
  });

  it('buildMvuScriptBundle 应该生成包含所有变量默认值的 initvarYaml', () => {
    const mvu = createEmptyMvuConfig();
    mvu.enabled = true;
    mvu.schemaSections = makeTestSections();
    const bundle = buildMvuScriptBundle(mvu);
    expect(bundle.initvarYaml).toContain('HP: 100');
    expect(bundle.initvarYaml).toContain('MP: 50');
    expect(bundle.initvarYaml).toContain('名字: 艾伦');
  });

  it('zodTxt应该包含registerMvuSchema导入和调用', () => {
    const mvu = createEmptyMvuConfig();
    mvu.enabled = true;
    mvu.schemaSections = makeTestSections();
    const bundle = buildMvuScriptBundle(mvu);
    expect(bundle.zodTxt).toContain("import { registerMvuSchema }");
    expect(bundle.zodTxt).toContain("registerMvuSchema(Schema)");
  });

  it('record类型字段应该有.prefault()默认值', () => {
    const sectionsWithRecord: MvuSchemaSection[] = [
      {
        name: '好感度',
        variables: [
          {
            path: '好感度',
            zodType: 'z.record(z.string(), z.coerce.number())',
            initialValue: { 'NPC1': 0, 'NPC2': 50 },
            prefix: '',
            description: 'NPC好感度',
          },
        ],
      },
    ];
    const schema = buildSchemaTs(sectionsWithRecord);
    expect(schema).toContain('.prefault({');
    expect(schema).toContain('NPC1');
  });
});
