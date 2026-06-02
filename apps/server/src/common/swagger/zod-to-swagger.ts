/**
 * Zod → OpenAPI 元数据扩展
 * ============================================================================
 * 必须在任何使用 `@anatine/zod-openapi` 的 .openapi() 调用之前 import 本文件
 * 一次(通常在 main.ts 顶部)。它会把 z.ZodSchema 原型扩展出一个 `.openapi()`
 * 方法,让 Zod schema 能携带 OpenAPI metadata(标题/描述/example 等),
 * 进而被序列化到 Swagger 文档。
 *
 * 用法:
 *   import './common/swagger/zod-to-swagger';
 *   const S = z.object({ id: z.string().uuid() }).openapi('UserId');
 */
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { z };
