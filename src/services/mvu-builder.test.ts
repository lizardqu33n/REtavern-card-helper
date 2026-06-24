/**
 * MVU Builder Tests - 验证 .prefault() 默认值和 tavern_helper.variables 修复
 */
import { describe, it, expect } from 'vitest';
import { buildSchemaTs, buildMvuScriptBundle } from './mvu-builder';
import { createEmptyMvuConfig } from '../constants/defaults';
import type { MvuSchemaSection } from '../constants/defaults';

describe('MVU Builder - .prefault() 修复验证', () => {
  function makeTestSections(): MvuSchemaSection[] {
    return [
      {
        id: 'sec1',
        name: '基础属性',
        variables: [
          {
            id: 'v1',
            path: 'HP',
            name: '生命值',
            zodType: 'z.coerce.number()',
            initialValue: 100,
            range: { min: 0, max: 100 },
            prefix: '',
            description: '角色生命值',
          },
          {
            id: 'v2',
            path: 'MP',
            name: '魔法值',
            zodType: 'z.coerce.number()',
            initialValue: 50,
            prefix: '',
            description: '魔法值',
          },
          {
            id: 'v3',
            path: '名字',
            name: '名字',
            zodType: 'z.string()',
            initialValue: '艾伦',
            prefix: '',
            description: '角色名',
          },
          {
            id: 'v4',
            path: '存活',
            name: '存活状态',
            zodType: 'z.boolean()',
            initialValue: true,
            prefix: '',
            description: '是否存活',
          },
          {
            id: 'v5',
            path: '阵营',
            name: '阵营',
            zodType: 'z.enum(["守序善良","中立善良","混乱善良"])',
            initialValue: '守序善良',
            prefix: '',
            description: '人格阵营',
          },
        ],
      },
      {
        id: 'sec2',
        name: '嵌套属性',
        variables: [
          {
            id: 'v6',
            path: '属性.力量',
            name: '力量',
            zodType: 'z.coerce.number()',
            initialValue: 10,
            range: { min: 0, max: 20 },
            prefix: '',
            description: '力量属性',
          },
          {
            id: 'v7',
            path: '属性.敏捷',
            name: '敏捷',
            zodType: 'z.coerce.number()',
            initialValue: 12,
            range: { min: 0, max: 20 },
            prefix: '',
            description: '敏捷属性',
          },
          {
            id: 'v8',
            path: '属性.智力',
            name: '智力',
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

  describe('buildSchemaTs - 每个字段都应包含 .prefault()', () => {
    it('叶子数字字段应该有 .prefault(默认值)', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toContain('.prefault(100)');
      expect(schema).toContain('.prefault(50)');
    });

    it('字符串字段应该有 .prefault(\'默认值\')', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toContain(".prefault('艾伦')");
    });

    it('布尔字段应该有 .prefault(true/false)', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toContain('.prefault(true)');
    });

    it('枚举字段应该有 .prefault()', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toContain(".prefault('守序善良')");
    });

    it('嵌套 object 字段应该有 .prefault({...})', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toMatch(/属性:[\s\S]*\.prefault\(\{/);
    });

    it('根 z.object 应该有 .prefault({...}) 包含所有根字段默认值', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      expect(schema).toMatch(/\}\)\.prefault\(\{[\s\S]*HP:[\s\S]*MP:[\s\S]*名字:[\s\S]*存活:[\s\S]*阵营:[\s\S]*属性:/);
    });

    it('不应该存在没有 .prefault() 的叶子字段（验证完整性）', () => {
      const sections = makeTestSections();
      const schema = buildSchemaTs(sections);
      const zodLines = schema.split('\n').filter(l => l.includes('z.') && !l.trim().startsWith('//'));
      for (const line of zodLines) {
        if (line.includes('z.coerce.number()') || line.includes('z.string()') || line.includes('z.boolean()') || line.includes('z.enum(')) {
          expect(line).toContain('.prefault(');
        }
      }
    });
  });

  describe('buildMvuScriptBundle - 应始终从 schemaSections 重新生成（不使用旧缓存）', () => {
    it('即使 schemaTsContent 为空也能从 schemaSections 生成', () => {
      const mvu = createEmptyMvuConfig();
      mvu.enabled = true;
      mvu.schemaSections = makeTestSections();
      mvu.schemaTsContent = '';
      mvu.initvarYamlContent = '';
      mvu.updateRulesYamlContent = '';

      const bundle = buildMvuScriptBundle(mvu);
      expect(bundle.zodTxt).toContain('.prefault(100)');
      expect(bundle.zodTxt).toContain('registerMvuSchema');
    });

    it('即使 schemaTsContent 有旧内容（无prefault），也应重新生成包含prefault', () => {
      const mvu = createEmptyMvuConfig();
      mvu.enabled = true;
      mvu.schemaSections = makeTestSections();
      mvu.schemaTsContent = 'export const Schema = z.object({ HP: z.coerce.number() });';
      mvu.initvarYamlContent = '';
      mvu.updateRulesYamlContent = '';

      const bundle = buildMvuScriptBundle(mvu);
      expect(bundle.zodTxt).toContain('.prefault(100)');
      expect(bundle.zodTxt).toContain('.prefault(50)');
      expect(bundle.zodTxt).not.toContain('HP: z.coerce.number() });');
    });

    it('zodTxt 应包含完整的 Zod 4 schema 注册代码', () => {
      const mvu = createEmptyMvuConfig();
      mvu.enabled = true;
      mvu.schemaSections = makeTestSections();

      const bundle = buildMvuScriptBundle(mvu);
      expect(bundle.zodTxt).toContain("import { registerMvuSchema }");
      expect(bundle.zodTxt).toContain("registerMvuSchema(Schema)");
    });

    it('variableOutputFormat 应包含 update_variable_rules 和 status_bar_rule', () => {
      const mvu = createEmptyMvuConfig();
      mvu.enabled = true;
      mvu.schemaSections = makeTestSections();

      const bundle = buildMvuScriptBundle(mvu);
      expect(bundle.variableOutputFormat).toContain('<update_variable_rules>');
      expect(bundle.variableOutputFormat).toContain('<status_bar_rule>');
      expect(bundle.variableOutputFormat).toContain('StatusPlaceHolderImpl');
    });
  });
});
