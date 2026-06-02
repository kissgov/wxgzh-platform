// apps/server/eslint-rules/no-any-input.js
// S2 invariant: 禁用 @Body()/@Query() 无类型或 any 入参,必须用 @ZodBody/@ZodQuery + Zod schema
// 豁免: 单字段提取 @Body('field') / @Query('name') / @Param('id')
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'S2 强制: @Body()/@Query()/@Param() 必须用 Zod 装饰器或带类型,禁止 any / 裸调用',
    },
    schema: [],
    messages: {
      bare: '必须使用 @ZodBody/@ZodQuery 装饰器代替 @Body()/@Query() (无 schema)',
      any: '禁止 any 类型入参; 使用 Zod schema',
      untyped: '@Body()/@Query() 必须接 schema,或单字段提取 @Body("fieldName")/@Query("name")',
    },
  },
  create(context) {
    return {
      Decorator(node) {
        const calleeName = node.expression?.callee?.name;
        if (!['Body', 'Query', 'Param'].includes(calleeName)) return;

        const args = node.expression.arguments || [];
        if (args.length === 0) {
          // @Body() / @Query() / @Param() — 完全无参
          context.report({ node, messageId: 'bare' });
          return;
        }

        const firstArg = args[0];

        // 允许: @Body('fieldName') / @Query('name') / @Param('id') — 单字段提取
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          return;
        }

        // 禁止: @Body() body: any (TSAnyKeyword)
        if (firstArg.type === 'TSAnyKeyword') {
          context.report({ node, messageId: 'any' });
          return;
        }

        // 禁止: @Body() body: any (TSTypeReference -> any)
        if (firstArg.type === 'TSTypeReference' && firstArg.typeName?.name === 'any') {
          context.report({ node, messageId: 'any' });
          return;
        }

        // 禁止: @Body() body: { inline type } 或 body: SomeDto (V1 DTO)
        if (firstArg.type === 'TSTypeLiteral' || firstArg.type === 'TSTypeReference') {
          context.report({ node, messageId: 'untyped' });
          return;
        }
      },
    };
  },
};
