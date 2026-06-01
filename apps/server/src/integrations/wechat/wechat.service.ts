// WechatService — 微信 API 统一封装 + Token 管理（Redis 分布式锁）
// 按架构文档 8.1 节设计
// ============================================================================
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

const WECHAT_API_BASE = 'https://api.weixin.qq.com';

export interface WechatApiResult {
  errcode: number;
  errmsg: string;
  [key: string]: unknown;
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private readonly http: AxiosInstance;
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');

    this.http = axios.create({ baseURL: WECHAT_API_BASE, timeout: 10_000 });
    axiosRetry(this.http, {
      retries: 2,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        err.response?.status === 429,
    });
  }

  // ── Component Access Token ───────────────────────────────────────────

  /** 获取 component_access_token（Redis 缓存 + 分布式锁） */
  async getComponentToken(componentAppId: string): Promise<string> {
    const cacheKey = `token:component:${componentAppId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    return this.refreshComponentToken(componentAppId);
  }

  /** 刷新 component_access_token */
  async refreshComponentToken(componentAppId: string): Promise<string> {
    const lockKey = `token:lock:component:${componentAppId}`;
    const lock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (!lock) {
      // 等待持锁者刷新完成
      await new Promise((r) => setTimeout(r, 200));
      const cached = await this.redis.get(`token:component:${componentAppId}`);
      if (cached) return cached;
      throw new InternalServerErrorException('Component token refresh timeout');
    }

    try {
      const app = await this.prisma.componentApp.findUnique({
        where: { id: componentAppId },
      });
      if (!app || !app.verifyTicket) {
        throw new InternalServerErrorException(
          `ComponentApp not found or verify_ticket missing: ${componentAppId}`,
        );
      }

      const { data } = await this.http.post<{
        component_access_token: string;
        expires_in: number;
      }>('/cgi-bin/component/api_component_token', {
        component_appid: app.appId,
        component_appsecret: app.appSecret,
        component_verify_ticket: app.verifyTicket,
      });

      const cacheKey = `token:component:${componentAppId}`;
      await this.redis.set(cacheKey, data.component_access_token, 'EX', 7000); // 提前 200s

      await this.prisma.componentApp.update({
        where: { id: componentAppId },
        data: {
          accessToken: data.component_access_token,
          tokenExpireAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      this.logger.log(`Component token refreshed for ${app.appId}`);
      return data.component_access_token;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Failed to refresh component token: ${(err as Error).message}`);
      throw new InternalServerErrorException('Component token refresh failed');
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // ── Authorizer Access Token ──────────────────────────────────────────

  /** 获取 authorizer_access_token（Redis 缓存 + 分布式锁） */
  async getAuthorizerToken(authorizerId: string): Promise<string> {
    const cacheKey = `token:authorizer:${authorizerId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    return this.refreshAuthorizerToken(authorizerId);
  }

  /** 刷新 authorizer_access_token */
  async refreshAuthorizerToken(authorizerId: string): Promise<string> {
    const lockKey = `token:lock:authorizer:${authorizerId}`;
    const lock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (!lock) {
      // 自旋等待持锁者完成
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 100 * (i + 1)));
        const cached = await this.redis.get(`token:authorizer:${authorizerId}`);
        if (cached) return cached;
      }
      throw new InternalServerErrorException(`Authorizer token refresh timeout: ${authorizerId}`);
    }

    try {
      const authorizer = await this.prisma.authorizer.findUnique({
        where: { id: authorizerId },
      });
      if (!authorizer || !authorizer.refreshToken) {
        throw new InternalServerErrorException(
          `Authorizer not found or refresh_token missing: ${authorizerId}`,
        );
      }

      const componentToken = await this.getComponentToken(authorizer.componentAppId);

      const { data } = await this.http.post<{
        authorizer_access_token: string;
        expires_in: number;
        authorizer_refresh_token: string;
      }>('/cgi-bin/component/api_authorizer_token', {
        component_appid: authorizer.componentAppId,
        component_access_token: componentToken,
        authorizer_appid: authorizer.appId,
        authorizer_refresh_token: authorizer.refreshToken,
      });

      const cacheKey = `token:authorizer:${authorizerId}`;
      await this.redis.set(cacheKey, data.authorizer_access_token, 'EX', 7000);

      await this.prisma.authorizer.update({
        where: { id: authorizerId },
        data: {
          accessToken: data.authorizer_access_token,
          refreshToken: data.authorizer_refresh_token,
          tokenExpireAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      this.logger.log(`Authorizer token refreshed: ${authorizer.appId}`);
      return data.authorizer_access_token;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Failed to refresh authorizer token: ${(err as Error).message}`);
      throw new InternalServerErrorException('Authorizer token refresh failed');
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // ── 通用 API 请求 ────────────────────────────────────────────────────

  /** 以授权方身份调用微信 API（自动注入 access_token，Token 过期自动重试） */
  async request<T = WechatApiResult>(
    authorizerId: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getAuthorizerToken(authorizerId);

    const res = await this.http.request<T>({
      method,
      url: `${path}${path.includes('?') ? '&' : '?'}access_token=${token}`,
      data: method === 'POST' ? body : undefined,
      params: method === 'GET' ? body as Record<string, unknown> : undefined,
    });

    const result = res.data as unknown as WechatApiResult;
    if (result.errcode && result.errcode !== 0) {
      this.logger.warn(`Wechat API error on ${path}: [${result.errcode}] ${result.errmsg}`);

      // Token 过期自动重试一次
      if ([40001, 40014, 42001, 61023].includes(result.errcode)) {
        await this.invalidateAuthorizerToken(authorizerId);
        const newToken = await this.getAuthorizerToken(authorizerId);
        const retryRes = await this.http.request<T>({
          method,
          url: `${path}${path.includes('?') ? '&' : '?'}access_token=${newToken}`,
          data: method === 'POST' ? body : undefined,
          params: method === 'GET' ? body as Record<string, unknown> : undefined,
        });
        return retryRes.data;
      }
    }

    return res.data;
  }

  /** 以 component 身份调用微信 API（统一错误检查 + Token 过期重试） */
  async requestComponent<T = WechatApiResult>(
    componentAppId: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getComponentToken(componentAppId);
    const res = await this.http.request<T>({
      method,
      url: `${path}${path.includes('?') ? '&' : '?'}access_token=${token}`,
      data: method === 'POST' ? body : undefined,
    });

    const result = res.data as unknown as WechatApiResult;
    if (result.errcode && result.errcode !== 0) {
      this.logger.warn(`Wechat Component API error on ${path}: [${result.errcode}] ${result.errmsg}`);

      // Token 过期自动重试一次
      if ([40001, 40014, 42001, 61023].includes(result.errcode)) {
        await this.invalidateComponentToken(componentAppId);
        const newToken = await this.getComponentToken(componentAppId);
        const retryRes = await this.http.request<T>({
          method,
          url: `${path}${path.includes('?') ? '&' : '?'}access_token=${newToken}`,
          data: method === 'POST' ? body : undefined,
        });
        const retryResult = retryRes.data as unknown as WechatApiResult;
        if (retryResult.errcode && retryResult.errcode !== 0) {
          throw new Error(`微信 API 错误: [${retryResult.errcode}] ${retryResult.errmsg}`);
        }
        return retryRes.data;
      }

      throw new Error(`微信 API 错误: [${result.errcode}] ${result.errmsg}`);
    }

    return res.data;
  }

  // ── Ticket 管理 ──────────────────────────────────────────────────────

  /** 存储 component_verify_ticket（Webhook 收到后调用） */
  async setTicket(componentAppId: string, ticket: string): Promise<void> {
    await this.prisma.componentApp.update({
      where: { id: componentAppId },
      data: { verifyTicket: ticket },
    });
    // 同时失效 Redis 缓存强制下次刷新
    await this.redis.del(`token:component:${componentAppId}`);
    this.logger.log(`Component verify ticket stored for ${componentAppId}`);
  }

  /** 使 authorizer token 失效（强制下次请求刷新） */
  async invalidateAuthorizerToken(authorizerId: string): Promise<void> {
    await this.redis.del(`token:authorizer:${authorizerId}`);
    await this.prisma.authorizer.update({
      where: { id: authorizerId },
      data: { tokenExpireAt: new Date(0) },
    });
  }

  /** 使 component token 失效 */
  async invalidateComponentToken(componentAppId: string): Promise<void> {
    await this.redis.del(`token:component:${componentAppId}`);
  }

  // ── 粉丝数据同步 ──────────────────────────────────────────────────

  /** 获取关注者 OpenID 列表（分页） */
  async getFollowers(authorizerId: string, nextOpenid?: string): Promise<{
    total: number; count: number; data: { openid: string[] }; next_openid: string;
  }> {
    return this.request(authorizerId, 'GET', '/cgi-bin/user/get', {
      next_openid: nextOpenid || '',
    });
  }

  /** 批量获取用户基本信息（最多 100 个） */
  async batchGetUserInfo(authorizerId: string, openids: string[]): Promise<{
    user_info_list: Array<{
      openid: string; nickname: string; sex: number; province: string;
      city: string; country: string; headimgurl: string;
      subscribe: number; subscribe_time: number; subscribe_scene: string;
      qr_scene: number; qr_scene_str: string; unionid?: string;
      remark: string; tagid_list: number[];
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/cgi-bin/user/info/batchget', {
      user_list: openids.map((o) => ({ openid: o, lang: 'zh_CN' })),
    });
  }

  // ── 数据分析 API（T+1 延迟）───────────────────────────────────────

  /** 获取用户增减数据（每日） */
  async getUserSummary(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; user_source: number; new_user: number; cancel_user: number;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getusersummary', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取累计用户数据（每日） */
  async getUserCumulate(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{ ref_date: string; cumulate_user: number }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getusercumulate', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取图文群发每日数据 */
  async getArticleSummary(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; msgid: string; title: string;
      int_page_read_user: number; int_page_read_count: number;
      ori_page_read_user: number; ori_page_read_count: number;
      share_user: number; share_count: number;
      add_to_fav_user: number; add_to_fav_count: number;
      int_page_from_session_read_user: number;
      int_page_from_hist_msg_read_user: number;
      int_page_from_feed_read_user: number;
      int_page_from_friends_read_user: number;
      int_page_from_other_read_user: number;
      feed_share_from_session_user: number;
      feed_share_from_feed_user: number;
      feed_share_from_other_user: number;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getarticlesummary', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取图文群发总数据 */
  async getArticleTotal(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; msgid: string; title: string;
      details: Array<{
        stat_date: string; target_user: number; int_page_read_user: number;
        int_page_read_count: number; ori_page_read_user: number;
        ori_page_read_count: number; share_user: number; share_count: number;
        add_to_fav_user: number; add_to_fav_count: number;
        int_page_from_session_read_user: number;
        int_page_from_hist_msg_read_user: number;
        int_page_from_feed_read_user: number;
        int_page_from_friends_read_user: number;
        int_page_from_other_read_user: number;
        feed_share_from_session_user: number;
        feed_share_from_feed_user: number;
        feed_share_from_other_user: number;
      }>;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getarticletotal', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取消息发送概况数据 */
  async getUpstreamMsg(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; msg_type: number; msg_user: number; msg_count: number;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getupstreammsg', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取消息发送分布数据 */
  async getUpstreamMsgDist(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; count_interval: number; msg_user: number;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getupstreammsgdist', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取消息发送周/月数据 */
  async getUpstreamMsgWeek(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{ ref_date: string; msg_type: number; msg_user: number; msg_count: number }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getupstreammsgweek', {
      begin_date: beginDate, end_date: endDate,
    });
  }

  /** 获取接口分析数据 */
  async getInterfaceSummary(authorizerId: string, beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string; callback_count: number; fail_count: number;
      total_time_cost: number; max_time_cost: number;
    }>;
  }> {
    return this.request(authorizerId, 'POST', '/datacube/getinterfacesummary', {
      begin_date: beginDate, end_date: endDate,
    });
  }
}
