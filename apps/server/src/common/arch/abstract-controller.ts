// apps/server/src/common/arch/abstract-controller.ts
// 控制器基类 + ProtectedController 装饰器
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export abstract class AbstractController {}

// 需要登录的控制器类装饰器
export const ProtectedController = () => UseGuards(JwtAuthGuard);
